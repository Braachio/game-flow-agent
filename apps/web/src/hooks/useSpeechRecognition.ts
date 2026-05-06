"use client";

import { useRef, useState, useCallback, useEffect } from "react";

interface UseSpeechRecognitionOptions {
  onResult: (transcript: string, speechStartTime: number) => void;
  onInterim?: (transcript: string) => void;
  lang?: string;
}

export function useSpeechRecognition({
  onResult,
  onInterim,
  lang = "ko-KR",
}: UseSpeechRecognitionOptions) {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const speechStartRef = useRef<number>(0);
  const shouldBeListening = useRef(false);
  const retryCount = useRef(0);

  // Use refs for callbacks to avoid stale closures
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const onInterimRef = useRef(onInterim);
  onInterimRef.current = onInterim;

  const createRecognition = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Web Speech API is not supported in this browser.");
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const last = event.results[event.results.length - 1];
      const transcript = last[0].transcript.trim();

      if (!last.isFinal) {
        if (speechStartRef.current === 0) {
          speechStartRef.current = performance.now();
        }
        setInterimText(transcript);
        onInterimRef.current?.(transcript);
      } else {
        const startTime = speechStartRef.current || performance.now();
        speechStartRef.current = 0;
        setInterimText("");
        onResultRef.current(transcript, startTime);
      }
    };

    recognition.onerror = (event) => {
      console.error(`[Speech] Error: ${event.error}`);

      if (event.error === "no-speech") {
        // Normal — just no input detected, will restart via onend
        return;
      }

      if (event.error === "network") {
        setError("네트워크 오류 — 재연결 시도 중...");
        return;
      }

      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("마이크 권한이 필요합니다.");
        shouldBeListening.current = false;
        setIsListening(false);
        return;
      }

      // For other errors, will retry via onend
      setError(`음성 인식 오류: ${event.error}`);
    };

    recognition.onend = () => {
      if (shouldBeListening.current) {
        // Auto-reconnect
        retryCount.current++;
        const delay = Math.min(retryCount.current * 500, 3000);

        if (retryCount.current > 1) {
          console.log(`[Speech] Reconnecting (attempt ${retryCount.current}, delay ${delay}ms)...`);
        }

        setTimeout(() => {
          if (shouldBeListening.current && recognitionRef.current) {
            try {
              recognitionRef.current.start();
              setError(null);
              retryCount.current = 0;
            } catch (e) {
              console.error("[Speech] Reconnect failed:", e);
              // Will try again on next onend
            }
          }
        }, delay);
      }
    };

    recognition.addEventListener("start", () => {
      retryCount.current = 0;
      setError(null);
    });

    return recognition;
  }, [lang]);

  const start = useCallback(() => {
    if (shouldBeListening.current) return;

    const recognition = createRecognition();
    if (!recognition) return;

    recognitionRef.current = recognition;
    shouldBeListening.current = true;
    retryCount.current = 0;

    try {
      recognition.start();
      setIsListening(true);
      setError(null);
    } catch (e) {
      console.error("[Speech] Start failed:", e);
      setError("음성 인식 시작 실패");
    }
  }, [createRecognition]);

  const stop = useCallback(() => {
    shouldBeListening.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimText("");
    setError(null);
    speechStartRef.current = 0;
    retryCount.current = 0;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldBeListening.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  return { isListening, interimText, error, start, stop };
}

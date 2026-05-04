"use client";

import { useRef, useState, useCallback } from "react";

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
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const speechStartRef = useRef<number>(0);

  const start = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Web Speech API is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const last = event.results[event.results.length - 1];
      const transcript = last[0].transcript.trim();

      if (!last.isFinal) {
        // Interim result — track speech start time on first interim
        if (speechStartRef.current === 0) {
          speechStartRef.current = performance.now();
        }
        setInterimText(transcript);
        onInterim?.(transcript);
      } else {
        // Final result — use the speech start time for latency measurement
        const startTime = speechStartRef.current || performance.now();
        speechStartRef.current = 0;
        setInterimText("");
        onResult(transcript, startTime);
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      if (event.error !== "no-speech") {
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      if (recognitionRef.current) {
        recognition.start();
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [lang, onResult, onInterim]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimText("");
    speechStartRef.current = 0;
  }, []);

  return { isListening, interimText, start, stop };
}

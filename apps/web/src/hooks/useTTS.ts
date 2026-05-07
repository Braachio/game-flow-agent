"use client";

import { useCallback, useRef, useState } from "react";

interface UseTTSOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
}

export function useTTS({ lang = "ko-KR", rate = 1.1, pitch = 1.0 }: UseTTSOptions = {}) {
  const [speaking, setSpeaking] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const queueRef = useRef<string[]>([]);
  const speakingRef = useRef(false);

  const processQueue = useCallback(() => {
    if (speakingRef.current || queueRef.current.length === 0) return;
    if (!enabled) { queueRef.current = []; return; }

    const text = queueRef.current.shift()!;
    const synth = window.speechSynthesis;
    if (!synth) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.pitch = pitch;

    // Try to find a Korean voice
    const voices = synth.getVoices();
    const koreanVoice = voices.find((v) => v.lang.startsWith("ko"));
    if (koreanVoice) utterance.voice = koreanVoice;

    utterance.onstart = () => {
      speakingRef.current = true;
      setSpeaking(true);
    };

    utterance.onend = () => {
      speakingRef.current = false;
      setSpeaking(false);
      processQueue(); // Process next in queue
    };

    utterance.onerror = () => {
      speakingRef.current = false;
      setSpeaking(false);
      processQueue();
    };

    synth.speak(utterance);
  }, [lang, rate, pitch, enabled]);

  const speak = useCallback((text: string) => {
    if (!enabled) return;
    queueRef.current.push(text);
    processQueue();
  }, [enabled, processQueue]);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    queueRef.current = [];
    speakingRef.current = false;
    setSpeaking(false);
  }, []);

  const toggle = useCallback(() => {
    setEnabled((v) => {
      if (v) stop(); // If disabling, stop current speech
      return !v;
    });
  }, [stop]);

  return { speak, stop, speaking, enabled, toggle };
}

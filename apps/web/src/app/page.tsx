"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useObs } from "@/hooks/useObs";
import { useClipSound } from "@/hooks/useClipSound";
import { useEventStream } from "@/hooks/useEventStream";
import Link from "next/link";
import type { VoiceEvent, SessionReport } from "@likelion/shared";

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:3001";

const CATEGORY_DISPLAY: Record<string, { label: string; color: string; bg: string }> = {
  excitement: { label: "흥분", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30" },
  frustration: { label: "짜증", color: "text-red-400", bg: "bg-red-500/10 border-red-500/30" },
  surprise: { label: "놀람", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/30" },
  victory: { label: "승리", color: "text-green-400", bg: "bg-green-500/10 border-green-500/30" },
  defeat: { label: "패배", color: "text-gray-400", bg: "bg-gray-500/10 border-gray-500/30" },
  neutral: { label: "일반", color: "text-gray-500", bg: "bg-gray-500/10 border-gray-500/30" },
};

export default function Home() {
  const [events, setEvents] = useState<VoiceEvent[]>([]);
  const eventsRef = useRef<VoiceEvent[]>([]);
  eventsRef.current = events;
  const [sessionActive, setSessionActive] = useState(false);
  const [lastEvent, setLastEvent] = useState<VoiceEvent | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [voiceFeedback, setVoiceFeedback] = useState<string | null>(null);
  const [clipCount, setClipCount] = useState(0);
  const [sessionSummary, setSessionSummary] = useState<VoiceEvent[] | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const obs = useObs();
  const playClipSound = useClipSound();
  const { connected: sseConnected } = useEventStream();

  // --- Session control ---

  const startSession = useCallback(async (providedSessionId?: string) => {
    let sid = providedSessionId;
    if (!sid) {
      try {
        const res = await fetch(`${AGENT_URL}/sessions/start`, { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          sid = data.sessionId;
        }
      } catch {}
    }
    if (!sid) sid = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    sessionIdRef.current = sid;
    setSessionActive(true);
    setSessionSummary(null);
    setEvents([]);
    setClipCount(0);
    setLastEvent(null);
  }, []);

  const endSession = useCallback(() => {
    setSessionActive(false);
    setSessionSummary([...eventsRef.current]);
  }, []);

  // --- Transcript handling ---

  const sendTranscript = useCallback(async (transcript: string, _speechStartTime: number) => {
    setDetecting(true);
    try {
      const res = await fetch(`${AGENT_URL}/events/voice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, sessionId: sessionIdRef.current }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.command) {
          if (data.intent === "START_SESSION" && data.sessionId) {
            setVoiceFeedback("세션 시작됨");
            startSession(data.sessionId);
          } else if (data.intent === "END_SESSION") {
            setVoiceFeedback("세션 종료됨");
            endSession();
          }
          setTimeout(() => setVoiceFeedback(null), 2500);
        } else if (data.event) {
          setEvents((prev) => [...prev, data.event]);
          setLastEvent(data.event);
          if (data.event.clipSaved) {
            setClipCount((c) => c + 1);
            playClipSound();
          }
        }
      }
    } catch {} finally {
      setDetecting(false);
    }
  }, [startSession, endSession, playClipSound]);

  const handleInterim = useCallback((_t: string) => {}, []);

  const { isListening, interimText, error: speechError, start, stop } = useSpeechRecognition({
    onResult: sendTranscript,
    onInterim: handleInterim,
    lang: "ko-KR",
  });

  const handleStartSession = useCallback(async () => {
    await startSession();
    if (!isListening) start();
  }, [startSession, isListening, start]);

  const handleEndSession = useCallback(() => {
    endSession();
  }, [endSession]);

  const handleEnableVoice = useCallback(() => { start(); }, [start]);
  const handleDisableVoice = useCallback(() => {
    stop();
    if (sessionActive) endSession();
  }, [stop, sessionActive, endSession]);

  const handleSaveReport = useCallback(async () => {
    if (!sessionSummary) return;
    const clipped = sessionSummary.filter((e) => e.clipSaved);
    const report: SessionReport = {
      sessionId: sessionIdRef.current || "",
      startedAt: sessionSummary[0]?.timestamp || new Date().toISOString(),
      endedAt: sessionSummary[sessionSummary.length - 1]?.timestamp || new Date().toISOString(),
      totalReactions: sessionSummary.length,
      clipsSaved: clipped.length,
      byCategory: {
        excitement: sessionSummary.filter((e) => e.category === "excitement").length,
        frustration: sessionSummary.filter((e) => e.category === "frustration").length,
        surprise: sessionSummary.filter((e) => e.category === "surprise").length,
        victory: sessionSummary.filter((e) => e.category === "victory").length,
        defeat: sessionSummary.filter((e) => e.category === "defeat").length,
        neutral: sessionSummary.filter((e) => e.category === "neutral").length,
      },
      interpretation: "",
      sessionFolderPath: sessionSummary.find((e) => e.sessionFolderPath)?.sessionFolderPath,
      clips: clipped.map((e) => ({
        filename: e.clipFilename || "unknown",
        path: e.renamedFilePath || "",
        category: e.category,
        transcript: e.transcript,
        detectedAt: e.timestamp,
        action: e.action || "SAVE_CLIP",
      })),
    };
    try {
      await fetch(`${AGENT_URL}/sessions/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report),
      });
    } catch {}
    setSessionSummary(null);
  }, [sessionSummary]);

  // Auto-connect OBS (only once on mount, non-blocking)
  const obsConnectAttempted = useRef(false);
  useEffect(() => {
    if (!obsConnectAttempted.current) {
      obsConnectAttempted.current = true;
      obs.connect();
    }
  }, [obs.connect]);

  // Derive state for the big visual indicator
  const lastCat = lastEvent ? CATEGORY_DISPLAY[lastEvent.category] : null;
  const recentClips = events.filter((e) => e.clipSaved).slice(-5).reverse();

  return (
    <div className="min-h-screen flex flex-col bg-gray-950">
      {/* Top bar */}
      <header className="h-12 flex items-center justify-between px-5 border-b border-gray-800/50">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-300">GameFlow</span>
          {sessionActive && (
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Recording" />
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className={`w-1.5 h-1.5 rounded-full ${obs.status?.connected ? "bg-green-500" : "bg-gray-700"}`} />
            OBS
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className={`w-1.5 h-1.5 rounded-full ${isListening ? "bg-blue-500" : "bg-gray-700"}`} />
            Mic
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className={`w-1.5 h-1.5 rounded-full ${sseConnected ? "bg-emerald-500" : "bg-gray-700"}`} />
            Live
          </div>
          <Link href="/dev" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
            Dev
          </Link>
        </div>
      </header>

      {/* Main area */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 relative">
        {/* Voice feedback toast */}
        {voiceFeedback && (
          <div className="absolute top-6 animate-fade-in">
            <div className="px-5 py-2 bg-indigo-600 rounded-lg text-sm text-white font-medium shadow-lg">
              {voiceFeedback}
            </div>
          </div>
        )}

        {/* Big center display */}
        <div className="flex flex-col items-center gap-6 -mt-12">
          {/* Status ring */}
          <div className={`w-48 h-48 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
            detecting
              ? "border-yellow-500/50 bg-yellow-500/5"
              : lastEvent && sessionActive
                ? `${lastCat?.bg || "border-gray-700 bg-gray-900"} border`
                : sessionActive
                  ? "border-green-800/50 bg-green-900/10"
                  : isListening
                    ? "border-blue-800/50 bg-blue-900/10"
                    : "border-gray-800 bg-gray-900/50"
          }`}>
            <div className="text-center">
              {detecting ? (
                <div className="text-yellow-400 text-lg animate-pulse">분석 중</div>
              ) : lastEvent && sessionActive ? (
                <>
                  <div className={`text-3xl font-bold ${lastCat?.color}`}>
                    {lastCat?.label}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {Math.round(lastEvent.confidence * 100)}%
                  </div>
                  {lastEvent.clipSaved && (
                    <div className="text-xs text-green-400 mt-1">clip saved</div>
                  )}
                </>
              ) : sessionActive ? (
                <div className="text-green-400/60 text-sm">감지 중...</div>
              ) : isListening ? (
                <div className="text-blue-400/60 text-sm text-center leading-relaxed">
                  &quot;세션 시작&quot;<br />대기 중
                </div>
              ) : (
                <div className="text-gray-600 text-sm">대기</div>
              )}
            </div>
          </div>

          {/* Interim text */}
          {interimText && (
            <p className="text-blue-300/70 text-sm italic animate-fade-in">
              &quot;{interimText}&quot;
            </p>
          )}

          {/* Speech error */}
          {speechError && (
            <p className="text-red-400/80 text-xs animate-fade-in">
              {speechError}
            </p>
          )}

          {/* Last transcript */}
          {lastEvent && !interimText && !speechError && (
            <p className="text-gray-500 text-sm max-w-sm text-center truncate">
              &quot;{lastEvent.transcript}&quot;
            </p>
          )}
        </div>

        {/* Clip counter (bottom-left) */}
        {sessionActive && (
          <div className="absolute bottom-24 left-6 text-left">
            <div className="text-3xl font-bold text-white">{clipCount}</div>
            <div className="text-xs text-gray-500">clips saved</div>
          </div>
        )}

        {/* Recent clips (bottom-right) */}
        {recentClips.length > 0 && sessionActive && (
          <div className="absolute bottom-24 right-6 text-right">
            <div className="space-y-1">
              {recentClips.map((e) => (
                <div key={e.id} className="text-xs text-gray-500">
                  <span className={CATEGORY_DISPLAY[e.category]?.color}>{CATEGORY_DISPLAY[e.category]?.label}</span>
                  {" "}
                  <span className="text-gray-600">{e.transcript.slice(0, 15)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Event count */}
        {sessionActive && (
          <div className="absolute bottom-24 text-center">
            <span className="text-xs text-gray-600">{events.length} reactions</span>
          </div>
        )}
      </main>

      {/* Session summary overlay */}
      {sessionSummary && sessionSummary.length > 0 && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-md w-full animate-fade-in">
            <h2 className="text-lg font-bold mb-4">Session Complete</h2>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold">{sessionSummary.length}</div>
                <div className="text-xs text-gray-500">reactions</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-400">
                  {sessionSummary.filter((e) => e.clipSaved).length}
                </div>
                <div className="text-xs text-gray-500">clips</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-400">
                  {sessionSummary.length > 0
                    ? Math.round((sessionSummary.filter((e) => e.clipSaved).length / sessionSummary.length) * 100)
                    : 0}%
                </div>
                <div className="text-xs text-gray-500">clip rate</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {Object.entries(
                sessionSummary.reduce<Record<string, number>>((acc, e) => {
                  acc[e.category] = (acc[e.category] || 0) + 1;
                  return acc;
                }, {})
              )
                .filter(([, c]) => c > 0)
                .sort(([, a], [, b]) => b - a)
                .map(([cat, count]) => (
                  <span key={cat} className="text-xs bg-gray-800 px-2 py-1 rounded">
                    <span className={CATEGORY_DISPLAY[cat]?.color}>{CATEGORY_DISPLAY[cat]?.label}</span>
                    {" "}{count}
                  </span>
                ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveReport}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
              >
                Save Report
              </button>
              <button
                onClick={() => setSessionSummary(null)}
                className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom control bar */}
      <div className="border-t border-gray-800/50 px-5 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-center gap-3">
          {/* Voice toggle */}
          <button
            onClick={isListening ? handleDisableVoice : handleEnableVoice}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              isListening
                ? "bg-blue-600/20 text-blue-400 border border-blue-800"
                : "bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600"
            }`}
          >
            {isListening ? "Voice On" : "Enable Voice"}
          </button>

          {/* Session button */}
          {!sessionActive ? (
            <button
              onClick={handleStartSession}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-green-600 hover:bg-green-500 text-white transition-colors"
            >
              Start Session
            </button>
          ) : (
            <button
              onClick={handleEndSession}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-red-600/80 hover:bg-red-500 text-white transition-colors"
            >
              End Session
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

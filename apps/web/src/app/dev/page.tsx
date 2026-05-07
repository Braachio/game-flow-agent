"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useObs } from "@/hooks/useObs";
import { useClipSound } from "@/hooks/useClipSound";
import { useEventStream } from "@/hooks/useEventStream";
import { DemoBanner } from "@/components/DemoBanner";
import { Timeline } from "@/components/Timeline";
import { TestButtons } from "@/components/TestButtons";
import { TranscriptPanel } from "@/components/TranscriptPanel";
import { EventLogPanel } from "@/components/EventLogPanel";
import { StatsCard } from "@/components/StatsCard";
import { ObsCard } from "@/components/ObsCard";
import { SettingsPanel } from "@/components/SettingsPanel";
import { EvaluationCard } from "@/components/EvaluationCard";
import { SessionSummaryCard } from "@/components/SessionSummaryCard";
import type { VoiceEvent, EventStats, EvaluationMetrics, UserFeedback, SessionReport } from "@likelion/shared";

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:3001";

export default function Home() {
  const [events, setEvents] = useState<VoiceEvent[]>([]);
  const eventsRef = useRef<VoiceEvent[]>([]);
  eventsRef.current = events;
  const [transcripts, setTranscripts] = useState<string[]>([]);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [metrics, setMetrics] = useState<EvaluationMetrics | null>(null);
  const [showDevTools, setShowDevTools] = useState(false);
  const [lastEvent, setLastEvent] = useState<VoiceEvent | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionSummary, setSessionSummary] = useState<VoiceEvent[] | null>(null);
  const [voiceCommandFeedback, setVoiceCommandFeedback] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const obs = useObs();
  const playClipSound = useClipSound();

  // SSE: sync state across tabs
  const handleSSE = useCallback((event: { type: string; payload: unknown }) => {
    if (event.type === "voice_event") {
      const e = event.payload as VoiceEvent;
      if (!sessionIdRef.current || e.sessionId === sessionIdRef.current) {
        setEvents((prev) => {
          if (prev.some((p) => p.id === e.id)) return prev;
          return [...prev, e];
        });
        setLastEvent(e);
        if (e.clipSaved) playClipSound();
      }
    } else if (event.type === "session_start") {
      const p = event.payload as { sessionId: string };
      if (!sessionIdRef.current) {
        sessionIdRef.current = p.sessionId;
        setSessionActive(true);
      }
    } else if (event.type === "session_end") {
      if (sessionIdRef.current) {
        setSessionActive(false);
        setSessionSummary([...eventsRef.current]);
      }
    }
  }, [playClipSound]);

  const { connected: sseConnected } = useEventStream({ onEvent: handleSSE });

  // --- Data fetching ---

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${AGENT_URL}/events/stats`);
      if (res.ok) setStats(await res.json());
    } catch {}
  }, []);

  const fetchMetrics = useCallback(async () => {
    try {
      const url = sessionIdRef.current
        ? `${AGENT_URL}/events/evaluation?sessionId=${sessionIdRef.current}`
        : `${AGENT_URL}/events/evaluation`;
      const res = await fetch(url);
      if (res.ok) setMetrics(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    fetchStats();
    fetchMetrics();
  }, [fetchStats, fetchMetrics]);

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
      } catch (err) {
        console.error("Failed to start session on backend:", err);
      }
    }
    if (!sid) {
      sid = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
    sessionIdRef.current = sid;
    setSessionActive(true);
    setSessionSummary(null);
    setEvents([]);
    setTranscripts([]);
    setLastEvent(null);
    setLatencyMs(null);
  }, []);

  const endSession = useCallback(() => {
    setSessionActive(false);
    setSessionSummary([...eventsRef.current]);
  }, []);

  // --- Transcript handling ---

  const sendTranscript = useCallback(async (transcript: string, speechStartTime: number) => {
    setTranscripts((prev) => [...prev, transcript]);
    setDetecting(true);

    try {
      const res = await fetch(`${AGENT_URL}/events/voice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          sessionId: sessionIdRef.current,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const elapsed = Math.round(performance.now() - speechStartTime);
        setLatencyMs(elapsed);

        if (data.command) {
          if (data.intent === "START_SESSION" && data.sessionId) {
            setVoiceCommandFeedback("Session started by voice");
            startSession(data.sessionId);
          } else if (data.intent === "END_SESSION") {
            setVoiceCommandFeedback("Session ended by voice");
            endSession();
          }
          setTimeout(() => setVoiceCommandFeedback(null), 3000);
        } else if (data.event) {
          setEvents((prev) => [...prev, data.event]);
          setLastEvent(data.event);
          if (data.event.clipSaved) {
            playClipSound();
          }
        }
        fetchStats();
        fetchMetrics();
      }
    } catch (err) {
      console.error("Failed to send transcript:", err);
    } finally {
      setDetecting(false);
    }
  }, [fetchStats, fetchMetrics, startSession, endSession, playClipSound]);

  const sendTestTranscript = useCallback((transcript: string) => {
    sendTranscript(transcript, performance.now());
  }, [sendTranscript]);

  const handleInterim = useCallback((_transcript: string) => {}, []);

  const handleFeedback = useCallback(async (eventId: string, feedback: UserFeedback) => {
    try {
      const res = await fetch(`${AGENT_URL}/events/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, feedback }),
      });
      if (res.ok) {
        const data = await res.json();
        setEvents((prev) =>
          prev.map((e) => (e.id === eventId ? data.event : e))
        );
        fetchMetrics();
      }
    } catch {}
  }, [fetchMetrics]);

  const handleMissedMoment = useCallback(async () => {
    try {
      await fetch(`${AGENT_URL}/events/false-negative`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionIdRef.current }),
      });
      fetchMetrics();
    } catch {}
  }, [fetchMetrics]);

  const { isListening, interimText, error: speechError, start, stop } = useSpeechRecognition({
    onResult: sendTranscript,
    onInterim: handleInterim,
    lang: "ko-KR",
  });

  // --- Button handlers ---

  const handleEnableVoice = useCallback(() => { start(); }, [start]);

  const handleDisableVoice = useCallback(() => {
    stop();
    if (sessionActive) endSession();
  }, [stop, sessionActive, endSession]);

  const handleStartSessionButton = useCallback(async () => {
    await startSession();
    if (!isListening) start();
  }, [startSession, isListening, start]);

  const handleEndSessionButton = useCallback(() => { endSession(); }, [endSession]);

  const handleSaveReport = useCallback(async (report: SessionReport) => {
    try {
      await fetch(`${AGENT_URL}/sessions/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report),
      });
    } catch (err) {
      console.error("Failed to save session report:", err);
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold tracking-tight">GameFlow Agent</h1>
            {sessionActive && (
              <span className="text-xs bg-green-900/60 text-green-400 border border-green-800 px-2 py-0.5 rounded-full">
                LIVE
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            {/* Connection indicators */}
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className={`w-2 h-2 rounded-full ${obs.status?.connected ? "bg-green-500" : "bg-gray-600"}`} />
              <span>OBS</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500" title={speechError || undefined}>
              <span className={`w-2 h-2 rounded-full ${speechError ? "bg-red-500" : isListening ? "bg-blue-500 animate-pulse-ring" : "bg-gray-600"}`} />
              <span>Mic</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className={`w-2 h-2 rounded-full ${sseConnected ? "bg-emerald-500" : "bg-gray-600"}`} />
              <span>Live</span>
            </div>
            <Link href="/" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
              Live View
            </Link>
            <button
              onClick={() => setShowDevTools((v) => !v)}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              {showDevTools ? "Hide Dev" : "Dev Tools"}
            </button>
          </div>
        </div>
      </header>

      {/* Voice command feedback toast */}
      {voiceCommandFeedback && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg shadow-lg text-sm font-medium">
            {voiceCommandFeedback}
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
        {/* Control bar */}
        <section className="mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-wrap items-center gap-3">
            {/* Voice toggle */}
            <button
              onClick={isListening ? handleDisableVoice : handleEnableVoice}
              className={`relative px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isListening
                  ? "bg-blue-600/20 text-blue-400 border border-blue-700 hover:bg-blue-600/30"
                  : "bg-gray-800 text-gray-300 border border-gray-700 hover:border-gray-600"
              }`}
            >
              {isListening && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse" />
              )}
              {isListening ? "Voice On" : "Enable Voice"}
            </button>

            {/* Divider */}
            <div className="w-px h-8 bg-gray-700" />

            {/* Session control */}
            {!sessionActive ? (
              <button
                onClick={handleStartSessionButton}
                className="px-4 py-2.5 rounded-lg text-sm font-medium bg-green-600 hover:bg-green-500 text-white transition-colors"
              >
                Start Session
              </button>
            ) : (
              <button
                onClick={handleEndSessionButton}
                className="px-4 py-2.5 rounded-lg text-sm font-medium bg-red-600/90 hover:bg-red-500 text-white transition-colors"
              >
                End Session
              </button>
            )}

            {/* Status text */}
            <div className="flex items-center gap-3 ml-auto text-sm">
              {isListening && !sessionActive && !interimText && !detecting && (
                <span className="text-blue-400/80">
                  &quot;세션 시작&quot; 대기 중...
                </span>
              )}
              {isListening && sessionActive && !interimText && !detecting && (
                <span className="text-green-400/80">감지 중...</span>
              )}
              {interimText && (
                <span className="text-blue-300 italic truncate max-w-[200px]">
                  &quot;{interimText}&quot;
                </span>
              )}
              {detecting && (
                <span className="text-yellow-400 animate-pulse">분석 중...</span>
              )}
              {latencyMs !== null && !detecting && (
                <span className="text-gray-600 text-xs">{latencyMs}ms</span>
              )}
              {sessionActive && sessionIdRef.current && (
                <span className="text-xs text-gray-600 font-mono">
                  {sessionIdRef.current.slice(8, 21)}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Demo banner */}
        {showDevTools && (
          <section className="mb-6">
            <DemoBanner
              isListening={isListening}
              lastEvent={lastEvent}
              interimText={interimText}
              detecting={detecting}
              latencyMs={latencyMs}
            />
          </section>
        )}

        {/* Session summary overlay */}
        {sessionSummary && (
          <section className="mb-6">
            <SessionSummaryCard
              events={sessionSummary}
              sessionId={sessionIdRef.current || ""}
              onDismiss={() => setSessionSummary(null)}
              onSave={handleSaveReport}
            />
          </section>
        )}

        {/* Primary content: Timeline + Event Log */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <Timeline events={events} onFeedback={handleFeedback} />
          </div>
          <div>
            <EventLogPanel events={events} />
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          <StatsCard stats={stats} />
          <ObsCard
            status={obs.status}
            onConnect={obs.connect}
            onDisconnect={obs.disconnect}
            onStartReplay={obs.startReplay}
            onSaveReplay={obs.saveReplay}
            loading={obs.loading}
          />
          <EvaluationCard metrics={metrics} onMissedMoment={handleMissedMoment} />
        </div>

        {/* Dev tools section */}
        {showDevTools && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <TestButtons onSend={sendTestTranscript} />
            <TranscriptPanel transcripts={transcripts} />
            <SettingsPanel />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between text-xs text-gray-600">
          <span>GameFlow Agent v0.1</span>
          <span>Voice Reactive Game Flow System</span>
        </div>
      </footer>
    </div>
  );
}

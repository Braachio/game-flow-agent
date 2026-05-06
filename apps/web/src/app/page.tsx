"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useObs } from "@/hooks/useObs";
import { useClipSound } from "@/hooks/useClipSound";
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
  const [transcripts, setTranscripts] = useState<string[]>([]);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [metrics, setMetrics] = useState<EvaluationMetrics | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [lastEvent, setLastEvent] = useState<VoiceEvent | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionSummary, setSessionSummary] = useState<VoiceEvent[] | null>(null);
  const [voiceCommandFeedback, setVoiceCommandFeedback] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const obs = useObs();
  const playClipSound = useClipSound();

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

  // --- Session control helpers ---

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
    setSessionSummary([...events]);
  }, [events]);

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
          console.log(`[Latency] speech→event: ${elapsed}ms`);
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

  const { isListening, interimText, start, stop } = useSpeechRecognition({
    onResult: sendTranscript,
    onInterim: handleInterim,
    lang: "ko-KR",
  });

  // --- Button handlers ---

  const handleEnableVoice = useCallback(() => {
    start();
  }, [start]);

  const handleDisableVoice = useCallback(() => {
    stop();
    if (sessionActive) {
      endSession();
    }
  }, [stop, sessionActive, endSession]);

  const handleStartSessionButton = useCallback(async () => {
    await startSession();
    if (!isListening) {
      start();
    }
  }, [startSession, isListening, start]);

  const handleEndSessionButton = useCallback(() => {
    endSession();
  }, [endSession]);

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
    <main className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Voice Reactive Game Flow Agent</h1>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-sm text-gray-400">Demo Mode</span>
          <input
            type="checkbox"
            checked={demoMode}
            onChange={(e) => setDemoMode(e.target.checked)}
            className="w-5 h-5 rounded bg-gray-700 border-gray-600"
          />
        </label>
      </div>

      {demoMode && (
        <div className="mb-6">
          <DemoBanner
            isListening={isListening}
            lastEvent={lastEvent}
            interimText={interimText}
            detecting={detecting}
            latencyMs={latencyMs}
          />
        </div>
      )}

      {sessionSummary && (
        <SessionSummaryCard
          events={sessionSummary}
          sessionId={sessionIdRef.current || ""}
          onDismiss={() => setSessionSummary(null)}
          onSave={handleSaveReport}
        />
      )}

      <div className="mb-6 flex items-center gap-4">
        {/* Voice Control toggle */}
        <button
          onClick={isListening ? handleDisableVoice : handleEnableVoice}
          className={`px-5 py-3 rounded-lg font-semibold transition-colors ${
            isListening
              ? "bg-gray-600 hover:bg-gray-700 text-gray-200"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {isListening ? "Disable Voice" : "Enable Voice"}
        </button>

        {/* Session control */}
        {!sessionActive ? (
          <button
            onClick={handleStartSessionButton}
            className="px-5 py-3 rounded-lg font-semibold bg-green-600 hover:bg-green-700 transition-colors"
          >
            Start Session
          </button>
        ) : (
          <button
            onClick={handleEndSessionButton}
            className="px-5 py-3 rounded-lg font-semibold bg-red-600 hover:bg-red-700 transition-colors"
          >
            End Session
          </button>
        )}

        {/* Status indicators */}
        {isListening && !sessionActive && !interimText && !detecting && (
          <span className="text-blue-400 text-sm animate-pulse">
            Listening for &quot;세션 시작&quot;...
          </span>
        )}
        {isListening && sessionActive && !interimText && !detecting && (
          <span className="text-green-400 animate-pulse">Listening...</span>
        )}
        {interimText && (
          <span className="text-blue-300 text-sm italic">&quot;{interimText}&quot;</span>
        )}
        {detecting && (
          <span className="text-yellow-300 animate-pulse">Detecting...</span>
        )}
        {latencyMs !== null && !detecting && (
          <span className="text-xs text-gray-500">{latencyMs}ms</span>
        )}
        {sessionIdRef.current && sessionActive && (
          <span className="text-xs text-gray-600">
            {sessionIdRef.current.slice(8, 21)}
          </span>
        )}
      </div>

      {voiceCommandFeedback && (
        <div className="mb-4 px-4 py-2 bg-indigo-600/80 text-white rounded-lg text-center font-medium animate-pulse">
          {voiceCommandFeedback}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <StatsCard stats={stats} />
        <ObsCard
          status={obs.status}
          onConnect={obs.connect}
          onDisconnect={obs.disconnect}
          onStartReplay={obs.startReplay}
          onSaveReplay={obs.saveReplay}
          loading={obs.loading}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <TestButtons onSend={sendTestTranscript} />
        <EvaluationCard metrics={metrics} onMissedMoment={handleMissedMoment} />
      </div>

      <div className="mb-6">
        <Timeline events={events} onFeedback={handleFeedback} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TranscriptPanel transcripts={transcripts} />
        <SettingsPanel />
      </div>
    </main>
  );
}

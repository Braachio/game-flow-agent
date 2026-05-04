"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useObs } from "@/hooks/useObs";
import { DemoBanner } from "@/components/DemoBanner";
import { Timeline } from "@/components/Timeline";
import { TestButtons } from "@/components/TestButtons";
import { TranscriptPanel } from "@/components/TranscriptPanel";
import { EventLogPanel } from "@/components/EventLogPanel";
import { StatsCard } from "@/components/StatsCard";
import { ObsCard } from "@/components/ObsCard";
import { SettingsPanel } from "@/components/SettingsPanel";
import { EvaluationCard } from "@/components/EvaluationCard";
import type { VoiceEvent, EventStats, EvaluationMetrics, UserFeedback } from "@likelion/shared";

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:3001";

function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function Home() {
  const [events, setEvents] = useState<VoiceEvent[]>([]);
  const [transcripts, setTranscripts] = useState<string[]>([]);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [metrics, setMetrics] = useState<EvaluationMetrics | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [lastEvent, setLastEvent] = useState<VoiceEvent | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const obs = useObs();

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

        if (data.event) {
          setEvents((prev) => [...prev, data.event]);
          setLastEvent(data.event);
          console.log(`[Latency] speech→event: ${elapsed}ms`);
        }
        fetchStats();
        fetchMetrics();
      }
    } catch (err) {
      console.error("Failed to send transcript:", err);
    } finally {
      setDetecting(false);
    }
  }, [fetchStats, fetchMetrics]);

  // Wrapper for test buttons (no speechStartTime)
  const sendTestTranscript = useCallback((transcript: string) => {
    sendTranscript(transcript, performance.now());
  }, [sendTranscript]);

  const handleInterim = useCallback((_transcript: string) => {
    // Interim results shown via interimText from the hook
  }, []);

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

  const handleStart = useCallback(() => {
    sessionIdRef.current = generateSessionId();
    start();
  }, [start]);

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

      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={isListening ? stop : handleStart}
          className={`px-6 py-3 rounded-lg font-semibold text-lg transition-colors ${
            isListening
              ? "bg-red-600 hover:bg-red-700"
              : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {isListening ? "Stop Listening" : "Start Listening"}
        </button>
        {isListening && !interimText && !detecting && (
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
        {sessionIdRef.current && (
          <span className="text-xs text-gray-600">
            {sessionIdRef.current.slice(8, 21)}
          </span>
        )}
      </div>

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

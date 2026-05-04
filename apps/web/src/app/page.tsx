"use client";

import { useState, useEffect, useCallback } from "react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { TranscriptPanel } from "@/components/TranscriptPanel";
import { EventLogPanel } from "@/components/EventLogPanel";
import { StatsCard } from "@/components/StatsCard";
import type { VoiceEvent, EventStats } from "@likelion/shared";

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:3001";

export default function Home() {
  const [events, setEvents] = useState<VoiceEvent[]>([]);
  const [transcripts, setTranscripts] = useState<string[]>([]);
  const [stats, setStats] = useState<EventStats | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${AGENT_URL}/events/stats`);
      if (res.ok) {
        setStats(await res.json());
      }
    } catch {
      // agent not reachable
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleTranscript = async (transcript: string) => {
    setTranscripts((prev) => [...prev, transcript]);

    try {
      const res = await fetch(`${AGENT_URL}/events/voice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.event) {
          setEvents((prev) => [...prev, data.event]);
          fetchStats();
        }
        // data.ignored === true means event was filtered (duplicate/cooldown/low confidence)
      }
    } catch (err) {
      console.error("Failed to send transcript:", err);
    }
  };

  const { isListening, start, stop } = useSpeechRecognition({
    onResult: handleTranscript,
    lang: "ko-KR",
  });

  return (
    <main className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">
        Voice Reactive Game Flow Agent
      </h1>

      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={isListening ? stop : start}
          className={`px-6 py-3 rounded-lg font-semibold text-lg transition-colors ${
            isListening
              ? "bg-red-600 hover:bg-red-700"
              : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {isListening ? "Stop Listening" : "Start Listening"}
        </button>
        {isListening && (
          <span className="text-green-400 animate-pulse">Listening...</span>
        )}
      </div>

      <div className="mb-6">
        <StatsCard stats={stats} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TranscriptPanel transcripts={transcripts} />
        <EventLogPanel events={events} />
      </div>
    </main>
  );
}

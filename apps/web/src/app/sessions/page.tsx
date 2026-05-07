"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { SessionReport, ReactionCategory, VoiceEvent } from "@likelion/shared";
import { SessionTimeline } from "@/components/SessionTimeline";

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:3001";

const CATEGORY_LABELS: Record<string, string> = {
  excitement: "흥분",
  frustration: "짜증",
  surprise: "놀람",
  victory: "승리",
  defeat: "패배",
  neutral: "기타",
};

const CATEGORY_COLORS: Record<string, string> = {
  excitement: "text-yellow-400",
  frustration: "text-red-400",
  surprise: "text-purple-400",
  victory: "text-green-400",
  defeat: "text-gray-400",
  neutral: "text-gray-500",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}초`;
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  return `${min}분 ${remSec}초`;
}

export default function SessionsPage() {
  const [reports, setReports] = useState<SessionReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SessionReport | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${AGENT_URL}/sessions/reports`);
        if (res.ok) {
          const data = await res.json();
          setReports(data.reverse()); // newest first
        }
      } catch {} finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="h-12 flex items-center justify-between px-5 border-b border-gray-800/50">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm font-semibold text-gray-300 hover:text-white transition-colors">
            GameFlow
          </Link>
          <span className="text-gray-700">/</span>
          <span className="text-sm text-gray-400">Sessions</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dev" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
            Dev
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6">
        <h1 className="text-xl font-bold mb-6">Session History</h1>

        {loading ? (
          <p className="text-gray-500 text-sm">Loading...</p>
        ) : reports.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500">No sessions recorded yet.</p>
            <Link href="/" className="text-blue-400 text-sm mt-2 inline-block hover:underline">
              Start a session
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* List */}
            <div className="lg:col-span-1 space-y-2 max-h-[70vh] overflow-y-auto">
              {reports.map((report) => (
                <button
                  key={report.sessionId}
                  onClick={() => setSelected(report)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selected?.sessionId === report.sessionId
                      ? "bg-gray-800 border-blue-700"
                      : "bg-gray-900 border-gray-800 hover:border-gray-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{formatDate(report.startedAt)}</span>
                    <span className="text-xs text-gray-500">
                      {report.totalReactions} reactions
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-green-400">{report.clipsSaved} clips</span>
                    <span className="text-xs text-gray-600">
                      {formatDuration(report.startedAt, report.endedAt)}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Detail */}
            <div className="lg:col-span-2">
              {selected ? (
                <SessionDetail report={selected} />
              ) : (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
                  <p className="text-gray-500 text-sm">Select a session to view details.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function SessionDetail({ report }: { report: SessionReport }) {
  const [events, setEvents] = useState<VoiceEvent[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${AGENT_URL}/events/by-session?sessionId=${report.sessionId}`);
        if (res.ok) setEvents(await res.json());
        else setEvents([]);
      } catch { setEvents([]); }
    })();
  }, [report.sessionId]);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-5">
      {/* Timeline visualization */}
      {events.length > 0 && (
        <SessionTimeline events={events} startedAt={report.startedAt} endedAt={report.endedAt} />
      )}

      {/* Header */}
      <div>
        <h2 className="text-lg font-bold">{formatDate(report.startedAt)}</h2>
        <p className="text-xs text-gray-500 font-mono mt-1">{report.sessionId}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-gray-800 rounded-lg p-3 text-center">
          <div className="text-xl font-bold">{report.totalReactions}</div>
          <div className="text-xs text-gray-500">reactions</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-green-400">{report.clipsSaved}</div>
          <div className="text-xs text-gray-500">clips</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-blue-400">
            {report.totalReactions > 0
              ? Math.round((report.clipsSaved / report.totalReactions) * 100)
              : 0}%
          </div>
          <div className="text-xs text-gray-500">clip rate</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-gray-300">
            {formatDuration(report.startedAt, report.endedAt)}
          </div>
          <div className="text-xs text-gray-500">duration</div>
        </div>
      </div>

      {/* Category breakdown */}
      <div>
        <h3 className="text-sm font-semibold text-gray-400 mb-2">Category Breakdown</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(report.byCategory)
            .filter(([, count]) => count > 0)
            .sort(([, a], [, b]) => b - a)
            .map(([cat, count]) => (
              <span key={cat} className="bg-gray-800 px-3 py-1 rounded text-sm">
                <span className={CATEGORY_COLORS[cat]}>{CATEGORY_LABELS[cat]}</span>
                {" "}<span className="font-bold">{count}</span>
              </span>
            ))}
        </div>
      </div>

      {/* Interpretation */}
      {report.interpretation && (
        <div>
          <h3 className="text-sm font-semibold text-gray-400 mb-1">Interpretation</h3>
          <p className="text-sm text-gray-300">{report.interpretation}</p>
        </div>
      )}

      {/* Clips */}
      {report.clips && report.clips.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-400 mb-2">Clips ({report.clips.length})</h3>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {report.clips.map((clip, i) => (
              <div key={i} className="bg-gray-800 rounded px-3 py-2 text-xs flex items-center gap-3">
                <span className={`font-medium ${CATEGORY_COLORS[clip.category]}`}>
                  {CATEGORY_LABELS[clip.category]}
                </span>
                <span className="text-gray-300 flex-1 truncate">{clip.transcript}</span>
                <span className="text-blue-400 truncate max-w-[180px]" title={clip.path}>
                  {clip.filename}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Memo */}
      {report.memo && (
        <div>
          <h3 className="text-sm font-semibold text-gray-400 mb-1">Memo</h3>
          <p className="text-sm text-gray-300 bg-gray-800 rounded p-3">{report.memo}</p>
        </div>
      )}

      {/* Highlight Reel */}
      <HighlightButton sessionId={report.sessionId} />

      {/* Session folder */}
      {report.sessionFolderPath && (
        <p className="text-xs text-gray-600 truncate" title={report.sessionFolderPath}>
          Folder: {report.sessionFolderPath}
        </p>
      )}
    </div>
  );
}

function HighlightButton({ sessionId }: { sessionId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ clips: Array<{ filename: string; score: number; reason: string; category: string; transcript: string }>; outputPath?: string; error?: string } | null>(null);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${AGENT_URL}/sessions/highlight`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, maxClips: 5 }),
      });
      if (res.ok) setResult(await res.json());
    } catch {} finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {!result ? (
        <button
          onClick={generate}
          disabled={loading}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
        >
          {loading ? "Generating..." : "Generate Highlight Reel"}
        </button>
      ) : (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-400">Highlights (Top {result.clips.length})</h3>
          {result.error && (
            <p className="text-xs text-yellow-500">{result.error}</p>
          )}
          {result.outputPath && (
            <p className="text-xs text-green-400 truncate" title={result.outputPath}>
              Reel: {result.outputPath}
            </p>
          )}
          <div className="space-y-1">
            {result.clips.map((c, i) => (
              <div key={i} className="bg-gray-800 rounded px-3 py-1.5 text-xs flex items-center gap-2">
                <span className="font-bold text-purple-400">#{i + 1}</span>
                <span className={CATEGORY_COLORS[c.category]}>{CATEGORY_LABELS[c.category]}</span>
                <span className="text-gray-300 flex-1 truncate">{c.transcript}</span>
                <span className="text-gray-500" title={c.reason}>{c.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

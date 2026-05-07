import type { VoiceEvent } from "@likelion/shared";

interface SessionTimelineProps {
  events: VoiceEvent[];
  startedAt: string;
  endedAt: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  excitement: "#facc15",
  frustration: "#f87171",
  surprise: "#c084fc",
  victory: "#4ade80",
  defeat: "#9ca3af",
  neutral: "#6b7280",
};

const CATEGORY_LABELS: Record<string, string> = {
  excitement: "흥분",
  frustration: "짜증",
  surprise: "놀람",
  victory: "승리",
  defeat: "패배",
  neutral: "일반",
};

export function SessionTimeline({ events, startedAt, endedAt }: SessionTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Timeline</h3>
        <p className="text-gray-600 text-sm text-center py-8">No events to display.</p>
      </div>
    );
  }

  const sessionStart = new Date(startedAt).getTime();
  const sessionEnd = new Date(endedAt).getTime();
  const duration = sessionEnd - sessionStart;

  // Position each event as percentage along the timeline
  const positioned = events.map((e) => {
    const t = new Date(e.timestamp).getTime();
    const pct = duration > 0 ? ((t - sessionStart) / duration) * 100 : 0;
    return { ...e, pct: Math.max(0, Math.min(100, pct)) };
  });

  // Detect peak segments (3+ events within 10% of timeline)
  const peaks = detectPeaks(positioned);

  // Format duration
  const totalSec = Math.round(duration / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  const durationLabel = min > 0 ? `${min}분 ${sec}초` : `${sec}초`;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Timeline</h3>
        <span className="text-xs text-gray-600">{durationLabel}</span>
      </div>

      {/* Timeline bar */}
      <div className="relative h-16 mb-2">
        {/* Background track */}
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-800 -translate-y-1/2" />

        {/* Peak zones */}
        {peaks.map((peak, i) => (
          <div
            key={i}
            className="absolute top-1/2 -translate-y-1/2 h-10 bg-white/5 rounded border border-white/10"
            style={{ left: `${peak.start}%`, width: `${peak.end - peak.start}%` }}
            title="Peak zone"
          />
        ))}

        {/* Event dots */}
        {positioned.map((e) => {
          const isTurning = e.metadata && (e.metadata as Record<string, unknown>).isTurningPoint;
          const isClip = e.clipSaved;
          const size = isClip ? "w-3 h-3" : "w-2 h-2";
          const ring = isTurning ? "ring-2 ring-white/40" : "";

          return (
            <div
              key={e.id}
              className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full ${size} ${ring} transition-all`}
              style={{
                left: `${e.pct}%`,
                backgroundColor: CATEGORY_COLORS[e.category] || CATEGORY_COLORS.neutral,
              }}
              title={`${CATEGORY_LABELS[e.category]} "${e.transcript}" (${Math.round(e.confidence * 100)}%)${isClip ? " — clip saved" : ""}${isTurning ? " — turning point" : ""}`}
            />
          );
        })}
      </div>

      {/* Time labels */}
      <div className="flex justify-between text-xs text-gray-600">
        <span>0:00</span>
        {min > 0 && <span>{Math.floor(min / 2)}:{String(Math.floor(sec / 2)).padStart(2, "0")}</span>}
        <span>{min}:{String(sec).padStart(2, "0")}</span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3">
        {Object.entries(CATEGORY_COLORS)
          .filter(([cat]) => events.some((e) => e.category === cat))
          .map(([cat, color]) => (
            <div key={cat} className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              {CATEGORY_LABELS[cat]}
            </div>
          ))}
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-3 h-3 rounded-full bg-gray-500 ring-2 ring-white/40" />
          turning point
        </div>
      </div>
    </div>
  );
}

interface PositionedEvent {
  pct: number;
  [key: string]: unknown;
}

interface Peak {
  start: number;
  end: number;
}

function detectPeaks(events: PositionedEvent[]): Peak[] {
  if (events.length < 3) return [];

  const peaks: Peak[] = [];
  const windowSize = 10; // 10% of timeline

  for (let i = 0; i <= 90; i += 5) {
    const inWindow = events.filter((e) => e.pct >= i && e.pct <= i + windowSize);
    if (inWindow.length >= 3) {
      // Merge with previous peak if overlapping
      const last = peaks[peaks.length - 1];
      if (last && last.end >= i) {
        last.end = i + windowSize;
      } else {
        peaks.push({ start: i, end: i + windowSize });
      }
    }
  }

  return peaks;
}

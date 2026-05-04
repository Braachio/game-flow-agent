import type { VoiceEvent, ReactionCategory } from "@likelion/shared";

interface SessionSummaryCardProps {
  events: VoiceEvent[];
  onDismiss: () => void;
}

function generateInterpretation(
  total: number,
  breakdown: Record<string, number>,
  clipsSaved: number
): string {
  if (total === 0) return "이번 세션에서는 반응이 감지되지 않았습니다.";

  const dominant = Object.entries(breakdown)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)[0];

  const parts: string[] = [];

  if (dominant) {
    const [cat, count] = dominant;
    const pct = Math.round((count / total) * 100);
    const labels: Record<string, string> = {
      excitement: "흥분",
      frustration: "짜증",
      surprise: "놀람",
      victory: "승리",
      defeat: "패배",
    };
    parts.push(`주된 반응: ${labels[cat] || cat} (${pct}%)`);
  }

  if (clipsSaved > 0) {
    parts.push(`${clipsSaved}개의 하이라이트 클립이 자동 저장되었습니다.`);
  } else {
    parts.push("클립 저장은 없었습니다.");
  }

  const positiveCount = (breakdown.excitement || 0) + (breakdown.victory || 0) + (breakdown.surprise || 0);
  const negativeCount = (breakdown.frustration || 0) + (breakdown.defeat || 0);

  if (positiveCount > negativeCount * 2) {
    parts.push("전반적으로 긍정적인 게임 경험이었습니다! 🎮");
  } else if (negativeCount > positiveCount * 2) {
    parts.push("힘든 경기였던 것 같습니다. 다음엔 더 잘 될 거예요!");
  } else if (total >= 5) {
    parts.push("다양한 반응이 감지된 역동적인 세션이었습니다.");
  }

  return parts.join(" ");
}

export function SessionSummaryCard({ events, onDismiss }: SessionSummaryCardProps) {
  const total = events.length;
  const clipsSaved = events.filter((e) => e.clipSaved === true).length;

  const breakdown: Record<string, number> = {
    excitement: 0,
    frustration: 0,
    surprise: 0,
    victory: 0,
    defeat: 0,
    neutral: 0,
  };
  for (const e of events) {
    breakdown[e.category] = (breakdown[e.category] || 0) + 1;
  }

  const interpretation = generateInterpretation(total, breakdown, clipsSaved);

  const categoryLabels: Record<string, string> = {
    excitement: "흥분",
    frustration: "짜증",
    surprise: "놀람",
    victory: "승리",
    defeat: "패배",
    neutral: "기타",
  };

  return (
    <div className="bg-gray-800 border border-blue-700 rounded-lg p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Session Summary</h2>
        <button
          onClick={onDismiss}
          className="text-gray-400 hover:text-white text-sm"
        >
          Dismiss
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-gray-700 rounded p-3 text-center">
          <div className="text-2xl font-bold">{total}</div>
          <div className="text-xs text-gray-400">Total Reactions</div>
        </div>
        <div className="bg-gray-700 rounded p-3 text-center">
          <div className="text-2xl font-bold text-green-400">{clipsSaved}</div>
          <div className="text-xs text-gray-400">Clips Saved</div>
        </div>
        <div className="bg-gray-700 rounded p-3 text-center">
          <div className="text-2xl font-bold text-blue-400">
            {total > 0 ? Math.round((clipsSaved / total) * 100) : 0}%
          </div>
          <div className="text-xs text-gray-400">Clip Rate</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {Object.entries(breakdown)
          .filter(([, count]) => count > 0)
          .sort(([, a], [, b]) => b - a)
          .map(([cat, count]) => (
            <span
              key={cat}
              className="bg-gray-700 px-3 py-1 rounded text-sm"
            >
              {categoryLabels[cat] || cat}{" "}
              <span className="font-bold">{count}</span>
            </span>
          ))}
      </div>

      <p className="text-sm text-gray-300 leading-relaxed">{interpretation}</p>
    </div>
  );
}

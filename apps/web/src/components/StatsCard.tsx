import type { EventStats } from "@likelion/shared";

interface StatsCardProps {
  stats: EventStats | null;
}

const categoryLabels: Record<string, string> = {
  excitement: "Excitement",
  frustration: "Frustration",
  surprise: "Surprise",
  victory: "Victory",
  defeat: "Defeat",
  neutral: "Neutral",
};

export function StatsCard({ stats }: StatsCardProps) {
  if (!stats) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-xl font-semibold mb-3">Stats</h2>
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-xl font-semibold mb-3">Stats</h2>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-gray-700 rounded p-2">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-xs text-gray-400">Total</div>
        </div>
        {Object.entries(stats.byCategory)
          .filter(([, count]) => count > 0)
          .map(([cat, count]) => (
            <div key={cat} className="bg-gray-700 rounded p-2">
              <div className="text-2xl font-bold">{count}</div>
              <div className="text-xs text-gray-400">{categoryLabels[cat] || cat}</div>
            </div>
          ))}
      </div>
      {stats.lastEventTime && (
        <p className="text-xs text-gray-500 mt-3">
          Last event: {new Date(stats.lastEventTime).toLocaleTimeString("ko-KR")}
        </p>
      )}
    </div>
  );
}

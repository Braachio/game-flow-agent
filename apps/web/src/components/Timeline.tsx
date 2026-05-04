import type { VoiceEvent } from "@likelion/shared";

interface TimelineProps {
  events: VoiceEvent[];
}

const categoryColors: Record<string, string> = {
  excitement: "border-yellow-500",
  frustration: "border-red-500",
  surprise: "border-purple-500",
  victory: "border-green-500",
  defeat: "border-gray-500",
  neutral: "border-gray-600",
};

export function Timeline({ events }: TimelineProps) {
  const recent = [...events].reverse().slice(0, 10);

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-xl font-semibold mb-3">Recent Events</h2>
      {recent.length === 0 ? (
        <p className="text-gray-500 text-sm">No events yet.</p>
      ) : (
        <div className="space-y-2">
          {recent.map((event) => (
            <div
              key={event.id}
              className={`border-l-4 ${categoryColors[event.category] || "border-gray-600"} bg-gray-700 rounded-r px-3 py-2`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">{event.transcript}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400">{event.category}</span>
                    <span className="text-xs text-gray-500">{Math.round(event.confidence * 100)}%</span>
                    {event.clipSaved === true && (
                      <span className="text-xs text-green-400">clip saved</span>
                    )}
                    {event.clipSaved === false && event.obsError && (
                      <span className="text-xs text-red-400">no clip</span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-gray-500 ml-2 whitespace-nowrap">
                  {new Date(event.timestamp).toLocaleTimeString("ko-KR")}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

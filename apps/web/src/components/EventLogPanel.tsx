import type { VoiceEvent } from "@likelion/shared";

interface EventLogPanelProps {
  events: VoiceEvent[];
}

const categoryColors: Record<string, string> = {
  excitement: "text-yellow-400",
  frustration: "text-red-400",
  surprise: "text-purple-400",
  victory: "text-green-400",
  defeat: "text-gray-400",
  neutral: "text-gray-500",
};

export function EventLogPanel({ events }: EventLogPanelProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 h-96 flex flex-col">
      <h2 className="text-xl font-semibold mb-3">Event Log</h2>
      <div className="flex-1 overflow-y-auto space-y-2">
        {events.length === 0 ? (
          <p className="text-gray-500">No events yet.</p>
        ) : (
          [...events].reverse().map((event) => (
            <div key={event.id} className="bg-gray-700 rounded px-3 py-2 text-sm">
              <div className="flex justify-between items-center">
                <span className={`font-medium ${categoryColors[event.category] || ""}`}>
                  {event.category}
                </span>
                <div className="flex items-center gap-2">
                  {event.clipSaved === true && (
                    <span className="bg-green-700 text-green-200 text-xs px-2 py-0.5 rounded">
                      clip saved
                    </span>
                  )}
                  {event.clipSaved === false && event.obsError && (
                    <span className="bg-red-900 text-red-300 text-xs px-2 py-0.5 rounded">
                      OBS not ready
                    </span>
                  )}
                  {event.clipRenameError && (
                    <span className="bg-orange-900 text-orange-300 text-xs px-2 py-0.5 rounded">
                      rename failed
                    </span>
                  )}
                  <span className="text-gray-400 text-xs">
                    {Math.round(event.confidence * 100)}%
                  </span>
                </div>
              </div>
              <p className="text-gray-300 mt-1">{event.transcript}</p>
              {event.clipFilename && (
                <p className="text-xs text-blue-400 mt-1 truncate" title={event.clipFilename}>
                  {event.clipFilename}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

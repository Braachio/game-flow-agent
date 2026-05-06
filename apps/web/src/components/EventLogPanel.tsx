import type { VoiceEvent, AgentAction } from "@likelion/shared";

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

const actionBadgeStyles: Record<AgentAction, string> = {
  SAVE_CLIP: "bg-green-700 text-green-200",
  TAG_EVENT: "bg-blue-700 text-blue-200",
  IGNORE: "bg-gray-600 text-gray-300",
  START_SESSION: "bg-indigo-700 text-indigo-200",
  END_SESSION: "bg-indigo-700 text-indigo-200",
};

export function EventLogPanel({ events }: EventLogPanelProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 h-96 flex flex-col">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Event Log</h2>
      <div className="flex-1 overflow-y-auto space-y-2">
        {events.length === 0 ? (
          <p className="text-gray-500">No events yet.</p>
        ) : (
          [...events].reverse().map((event) => (
            <div key={event.id} className="bg-gray-700 rounded px-3 py-2 text-sm">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${categoryColors[event.category] || ""}`}>
                    {event.category}
                  </span>
                  {event.action && (
                    <span className={`text-xs px-2 py-0.5 rounded ${actionBadgeStyles[event.action]}`}>
                      {event.action}
                    </span>
                  )}
                </div>
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
              {event.actionReason && (
                <p className="text-xs text-gray-500 mt-0.5">{event.actionReason}</p>
              )}
              {event.clipFilename && (
                <p className="text-xs text-blue-400 mt-1 truncate" title={event.renamedFilePath || event.clipFilename}>
                  {event.sessionFolderPath
                    ? `${event.sessionFolderPath.split("/").pop()}/${event.clipFilename}`
                    : event.clipFilename}
                </p>
              )}
              {event.clipMoveError && (
                <span className="text-xs text-orange-400">move failed: {event.clipMoveError}</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

import type { VoiceEvent, UserFeedback } from "@likelion/shared";
import { HighlightedText } from "./HighlightedText";
import { ConfidenceBar } from "./ConfidenceBar";

interface TimelineProps {
  events: VoiceEvent[];
  onFeedback: (eventId: string, feedback: UserFeedback) => void;
}

const categoryColors: Record<string, string> = {
  excitement: "border-yellow-500",
  frustration: "border-red-500",
  surprise: "border-purple-500",
  victory: "border-green-500",
  defeat: "border-gray-500",
  neutral: "border-gray-600",
};

export function Timeline({ events, onFeedback }: TimelineProps) {
  const recent = [...events].reverse().slice(0, 10);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Recent Events</h2>
      {recent.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-gray-600 text-sm">No events yet.</p>
          <p className="text-gray-700 text-xs mt-1">Events will appear here when a session is active.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {recent.map((event, idx) => (
            <div
              key={event.id}
              className={`border-l-4 ${categoryColors[event.category] || "border-gray-600"} bg-gray-700 rounded-r px-3 py-2 ${idx === 0 ? "animate-flash" : ""}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200">
                    <HighlightedText
                      text={event.transcript}
                      keywords={event.matchedKeywords || []}
                    />
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400">{event.category}</span>
                    <ConfidenceBar confidence={event.confidence} />
                    {event.clipSaved === true && (
                      <span className="text-xs text-green-400">clip saved</span>
                    )}
                    {event.clipSaved === false && event.obsError && (
                      <span className="text-xs text-red-400">no clip</span>
                    )}
                    {event.feedback === "false_positive" && (
                      <span className="text-xs bg-red-800 text-red-200 px-1 rounded">FP</span>
                    )}
                    {event.feedback === "useful" && (
                      <span className="text-xs bg-green-800 text-green-200 px-1 rounded">useful</span>
                    )}
                  </div>
                  {event.matchedKeywords && event.matchedKeywords.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      matched: {event.matchedKeywords.map((k) => `"${k}"`).join(", ")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 ml-2">
                  {!event.feedback && (
                    <>
                      <button
                        onClick={() => onFeedback(event.id, "useful")}
                        title="Mark as Useful"
                        className="text-xs px-1.5 py-0.5 bg-green-800 hover:bg-green-700 text-green-200 rounded transition-colors"
                      >
                        Good
                      </button>
                      <button
                        onClick={() => onFeedback(event.id, "false_positive")}
                        title="Mark as False Positive"
                        className="text-xs px-1.5 py-0.5 bg-red-800 hover:bg-red-700 text-red-200 rounded transition-colors"
                      >
                        FP
                      </button>
                    </>
                  )}
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {new Date(event.timestamp).toLocaleTimeString("ko-KR")}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import type { VoiceEvent } from "@likelion/shared";

interface DemoBannerProps {
  isListening: boolean;
  lastEvent: VoiceEvent | null;
}

const categoryEmoji: Record<string, string> = {
  excitement: "🔥",
  frustration: "😤",
  surprise: "😲",
  victory: "🏆",
  defeat: "💀",
  neutral: "💬",
};

export function DemoBanner({ isListening, lastEvent }: DemoBannerProps) {
  let statusText = "Idle";
  let statusColor = "text-gray-400";
  let bgColor = "bg-gray-800";

  if (isListening && !lastEvent) {
    statusText = "Listening...";
    statusColor = "text-green-400";
    bgColor = "bg-gray-800 border border-green-800";
  } else if (lastEvent) {
    const emoji = categoryEmoji[lastEvent.category] || "";
    statusText = `${emoji} Detected: ${lastEvent.category}`;
    statusColor = "text-white";

    if (lastEvent.clipSaved === true) {
      statusText += " — Clip saved!";
      bgColor = "bg-green-900 border border-green-600";
    } else if (lastEvent.clipSaved === false && lastEvent.obsError) {
      statusText += " — OBS not ready";
      bgColor = "bg-yellow-900 border border-yellow-600";
    } else {
      bgColor = "bg-blue-900 border border-blue-600";
    }
  }

  return (
    <div className={`${bgColor} rounded-lg p-6 text-center transition-all duration-300`}>
      <p className={`text-2xl font-bold ${statusColor}`}>{statusText}</p>
      {lastEvent && (
        <p className="text-gray-400 text-sm mt-2">
          &quot;{lastEvent.transcript}&quot; — {Math.round(lastEvent.confidence * 100)}%
        </p>
      )}
    </div>
  );
}

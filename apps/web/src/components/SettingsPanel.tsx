import { COOLDOWN_MS, CONFIDENCE_THRESHOLD, DUPLICATE_WINDOW_MS } from "@likelion/shared";

const HIGH_VALUE_CATEGORIES = ["excitement", "victory", "surprise"];

export function SettingsPanel() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Settings</h2>
      <div className="space-y-3 text-sm">
        <div>
          <h3 className="text-gray-400 font-medium mb-1">Confidence Threshold</h3>
          <p className="text-white">{CONFIDENCE_THRESHOLD * 100}%</p>
        </div>
        <div>
          <h3 className="text-gray-400 font-medium mb-1">Duplicate Window</h3>
          <p className="text-white">{DUPLICATE_WINDOW_MS / 1000}s</p>
        </div>
        <div>
          <h3 className="text-gray-400 font-medium mb-1">Cooldowns</h3>
          <div className="grid grid-cols-2 gap-1">
            {Object.entries(COOLDOWN_MS).map(([cat, ms]) => (
              <div key={cat} className="flex justify-between text-gray-300">
                <span>{cat}</span>
                <span className="text-gray-500">{ms / 1000}s</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-gray-400 font-medium mb-1">Auto-clip Categories</h3>
          <div className="flex gap-2">
            {HIGH_VALUE_CATEGORIES.map((cat) => (
              <span key={cat} className="bg-gray-700 px-2 py-0.5 rounded text-xs text-green-300">
                {cat}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

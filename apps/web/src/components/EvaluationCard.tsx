import type { EvaluationMetrics } from "@likelion/shared";

interface EvaluationCardProps {
  metrics: EvaluationMetrics | null;
  onMissedMoment: () => void;
}

export function EvaluationCard({ metrics, onMissedMoment }: EvaluationCardProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Evaluation</h2>
        <button
          onClick={onMissedMoment}
          className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 rounded text-sm font-medium transition-colors"
        >
          Missed Moment
        </button>
      </div>
      {!metrics ? (
        <p className="text-gray-500 text-sm">No data yet.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className="bg-gray-700 rounded p-2">
            <div className="text-lg font-bold">{metrics.totalTranscripts}</div>
            <div className="text-xs text-gray-400">Transcripts</div>
          </div>
          <div className="bg-gray-700 rounded p-2">
            <div className="text-lg font-bold">{metrics.detectedEvents}</div>
            <div className="text-xs text-gray-400">Detected</div>
          </div>
          <div className="bg-gray-700 rounded p-2">
            <div className="text-lg font-bold">{metrics.clippedEvents}</div>
            <div className="text-xs text-gray-400">Clipped</div>
          </div>
          <div className="bg-gray-700 rounded p-2">
            <div className="text-lg font-bold">{metrics.ignoredEvents}</div>
            <div className="text-xs text-gray-400">Ignored</div>
          </div>
          <div className="bg-gray-700 rounded p-2">
            <div className="text-lg font-bold text-red-400">{metrics.falsePositives}</div>
            <div className="text-xs text-gray-400">False Pos</div>
          </div>
          <div className="bg-gray-700 rounded p-2">
            <div className="text-lg font-bold text-orange-400">{metrics.falseNegatives}</div>
            <div className="text-xs text-gray-400">False Neg</div>
          </div>
          {metrics.precision !== null && (
            <div className="bg-gray-700 rounded p-2 col-span-3">
              <div className="text-lg font-bold text-blue-400">
                {(metrics.precision * 100).toFixed(0)}%
              </div>
              <div className="text-xs text-gray-400">
                Precision (useful / judged)
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

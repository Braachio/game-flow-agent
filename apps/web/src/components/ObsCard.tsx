import type { ObsStatus } from "@likelion/shared";

interface ObsCardProps {
  status: ObsStatus | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onStartReplay: () => void;
  onSaveReplay: () => void;
  loading: boolean;
}

export function ObsCard({
  status,
  onConnect,
  onDisconnect,
  onStartReplay,
  onSaveReplay,
  loading,
}: ObsCardProps) {
  const connected = status?.connected ?? false;
  const replayActive = status?.replayBufferActive ?? false;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">OBS Control</h2>

      <div className="flex items-center gap-3 mb-3">
        <span
          className={`inline-block w-3 h-3 rounded-full ${
            connected ? "bg-green-500" : "bg-red-500"
          }`}
        />
        <span className="text-sm">
          {connected ? "Connected" : "Disconnected"}
        </span>
        {connected && (
          <>
            <span className="text-gray-600">|</span>
            <span
              className={`text-sm ${replayActive ? "text-green-400" : "text-gray-400"}`}
            >
              Replay Buffer: {replayActive ? "Active" : "Inactive"}
            </span>
          </>
        )}
      </div>

      {status?.error && (
        <div className="bg-red-900/30 border border-red-700 rounded px-3 py-2 mb-3 text-sm text-red-300">
          {status.error}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {!connected ? (
          <button
            onClick={onConnect}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded text-sm font-medium transition-colors"
          >
            {loading ? "Connecting..." : "Connect"}
          </button>
        ) : (
          <>
            <button
              onClick={onDisconnect}
              disabled={loading}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-700 rounded text-sm font-medium transition-colors"
            >
              Disconnect
            </button>
            {!replayActive && (
              <button
                onClick={onStartReplay}
                disabled={loading}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded text-sm font-medium transition-colors"
              >
                Start Replay Buffer
              </button>
            )}
            {replayActive && (
              <button
                onClick={onSaveReplay}
                disabled={loading}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 rounded text-sm font-medium transition-colors"
              >
                Save Replay
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

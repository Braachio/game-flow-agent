import type { VoiceEvent } from "@likelion/shared";

/**
 * TODO: OBS WebSocket integration
 *
 * This service will connect to OBS via obs-websocket (v5) to:
 * 1. Save replay buffer clips when high-confidence reactions are detected
 * 2. Trigger scene transitions based on reaction category
 * 3. Toggle source visibility for overlays
 *
 * Dependencies to add:
 *   npm install obs-websocket-js
 *
 * Connection config (env vars):
 *   OBS_WS_URL=ws://localhost:4455
 *   OBS_WS_PASSWORD=your-password
 *
 * Implementation plan:
 *   - Connect to OBS on startup with auto-reconnect
 *   - On high-confidence event (>= 0.7), call SaveReplayBuffer
 *   - Map reaction categories to scene/source actions
 *   - Queue events to avoid rapid-fire triggers (debounce ~3s)
 */

export async function onVoiceEvent(_event: VoiceEvent): Promise<void> {
  // TODO: Implement OBS replay buffer save
  // if (event.confidence >= 0.7) {
  //   await obs.call('SaveReplayBuffer');
  // }
}

export async function connectObs(): Promise<void> {
  // TODO: Establish OBS WebSocket connection
}

export async function disconnectObs(): Promise<void> {
  // TODO: Clean disconnect
}

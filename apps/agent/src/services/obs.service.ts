import OBSWebSocket from "obs-websocket-js";
import type { VoiceEvent, ObsStatus, ReactionCategory } from "@likelion/shared";

const CLIP_CATEGORIES: ReactionCategory[] = ["excitement", "victory", "surprise"];

export interface ObsClipResult {
  clipSaved: boolean;
  obsTriggeredAt?: string;
  obsError?: string;
}

class ObsService {
  private obs = new OBSWebSocket();
  private _connected = false;
  private _replayBufferActive = false;
  private _error: string | undefined;

  get connected() {
    return this._connected;
  }

  get replayBufferActive() {
    return this._replayBufferActive;
  }

  async connect(): Promise<ObsStatus> {
    const host = process.env.OBS_HOST || "localhost";
    const port = process.env.OBS_PORT || "4455";
    const password = process.env.OBS_PASSWORD || undefined;
    const url = `ws://${host}:${port}`;

    try {
      const connectPromise = this.obs.connect(url, password);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("ETIMEDOUT")), 5000)
      );
      await Promise.race([connectPromise, timeoutPromise]);
      this._connected = true;
      this._error = undefined;
      console.log(`[OBS] Connected to ${url}`);

      // Check if replay buffer is already active
      try {
        const rbStatus = await this.obs.call("GetReplayBufferStatus");
        this._replayBufferActive = rbStatus.outputActive;
      } catch {
        this._replayBufferActive = false;
      }

      // Listen for disconnect
      this.obs.on("ConnectionClosed", () => {
        console.log("[OBS] Connection closed");
        this._connected = false;
        this._replayBufferActive = false;
      });

      this.obs.on("ReplayBufferStateChanged", (data) => {
        this._replayBufferActive = data.outputActive;
        console.log(`[OBS] Replay buffer ${data.outputActive ? "started" : "stopped"}`);
      });

      return this.getStatus();
    } catch (err: unknown) {
      this._connected = false;
      this._error = this.formatError(err);
      console.error(`[OBS] Connection failed: ${this._error}`);
      return this.getStatus();
    }
  }

  async disconnect(): Promise<ObsStatus> {
    try {
      await this.obs.disconnect();
    } catch {
      // already disconnected
    }
    this._connected = false;
    this._replayBufferActive = false;
    this._error = undefined;
    console.log("[OBS] Disconnected");
    return this.getStatus();
  }

  getStatus(): ObsStatus {
    return {
      connected: this._connected,
      replayBufferActive: this._replayBufferActive,
      error: this._error,
    };
  }

  async startReplayBuffer(): Promise<ObsStatus> {
    if (!this._connected) {
      this._error = "Not connected to OBS";
      return this.getStatus();
    }
    try {
      await this.obs.call("StartReplayBuffer");
      this._replayBufferActive = true;
      this._error = undefined;
      console.log("[OBS] Replay buffer started");
    } catch (err: unknown) {
      this._error = this.formatError(err);
      console.error(`[OBS] Failed to start replay buffer: ${this._error}`);
    }
    return this.getStatus();
  }

  async saveReplayBuffer(): Promise<ObsStatus> {
    if (!this._connected) {
      this._error = "Not connected to OBS";
      return this.getStatus();
    }
    if (!this._replayBufferActive) {
      this._error = "Replay buffer is not active. Start it first.";
      return this.getStatus();
    }
    try {
      await this.obs.call("SaveReplayBuffer");
      this._error = undefined;
      console.log("[OBS] Replay buffer saved");
    } catch (err: unknown) {
      this._error = this.formatError(err);
      console.error(`[OBS] Failed to save replay buffer: ${this._error}`);
    }
    return this.getStatus();
  }

  shouldTriggerClip(category: ReactionCategory): boolean {
    return CLIP_CATEGORIES.includes(category);
  }

  async triggerClipForEvent(event: VoiceEvent): Promise<ObsClipResult> {
    if (!this.shouldTriggerClip(event.category)) {
      console.log(
        `[OBS] Replay save skipped: category "${event.category}" is not clip-worthy`
      );
      return { clipSaved: false };
    }

    console.log(
      `[VoiceEvent] Detected high-value event: "${event.transcript}" → ${event.category} (${(event.confidence * 100).toFixed(0)}%)`
    );

    const triggeredAt = new Date().toISOString();

    if (!this._connected) {
      const reason = "OBS not connected";
      console.log(`[OBS] Replay save skipped: ${reason}`);
      return { clipSaved: false, obsTriggeredAt: triggeredAt, obsError: reason };
    }

    if (!this._replayBufferActive) {
      const reason = "Replay buffer not active";
      console.log(`[OBS] Replay save skipped: ${reason}`);
      return { clipSaved: false, obsTriggeredAt: triggeredAt, obsError: reason };
    }

    try {
      await this.obs.call("SaveReplayBuffer");
      console.log(`[OBS] Replay saved for event ${event.id}`);
      return { clipSaved: true, obsTriggeredAt: triggeredAt };
    } catch (err: unknown) {
      const reason = this.formatError(err);
      console.error(`[OBS] Replay save failed for event ${event.id}: ${reason}`);
      return { clipSaved: false, obsTriggeredAt: triggeredAt, obsError: reason };
    }
  }

  private formatError(err: unknown): string {
    if (err instanceof Error) {
      const msg = err.message;
      if (msg.includes("ECONNREFUSED")) {
        return "OBS is not running or WebSocket server is not enabled. Enable it in OBS → Tools → WebSocket Server Settings.";
      }
      if (msg.includes("Authentication") || msg.includes("authentication")) {
        return "OBS WebSocket requires a password. Set OBS_PASSWORD in your .env file.";
      }
      if (msg.includes("ETIMEDOUT") || msg.includes("ENOTFOUND")) {
        return `Cannot reach OBS at the configured host/port. Check OBS_HOST and OBS_PORT.`;
      }
      return msg;
    }
    return String(err);
  }
}

export const obsService = new ObsService();

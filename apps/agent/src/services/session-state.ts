import { mkdir } from "node:fs/promises";
import { join } from "node:path";

/**
 * Tracks active session state for voice command guards and clip folder organization.
 */
class SessionState {
  private active = false;
  private sessionId: string | null = null;
  private folderPath: string | null = null;

  isActive(): boolean {
    return this.active;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  getFolderPath(): string | null {
    return this.folderPath;
  }

  async start(sessionId: string): Promise<void> {
    this.active = true;
    this.sessionId = sessionId;
    this.folderPath = null;

    const recordingDir = process.env.OBS_RECORDING_DIR;
    if (!recordingDir) {
      console.log("[Session] OBS_RECORDING_DIR not set, skipping folder creation");
      return;
    }

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const shortId = sessionId.slice(-6);
    const folderName = `session_${ts}_${shortId}`;
    const folderPath = join(recordingDir, folderName);

    try {
      await mkdir(folderPath, { recursive: true });
      this.folderPath = folderPath;
      console.log(`[Session] Created session folder: ${folderPath}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Session] Failed to create session folder: ${msg}`);
      // Session still starts, just without folder organization
    }
  }

  end(): void {
    this.active = false;
    this.sessionId = null;
    this.folderPath = null;
  }
}

export const sessionState = new SessionState();

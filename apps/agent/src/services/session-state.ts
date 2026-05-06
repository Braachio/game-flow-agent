/**
 * Tracks active session state for voice command guards.
 */
class SessionState {
  private active = false;
  private sessionId: string | null = null;

  isActive(): boolean {
    return this.active;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  start(sessionId: string): void {
    this.active = true;
    this.sessionId = sessionId;
  }

  end(): void {
    this.active = false;
    this.sessionId = null;
  }
}

export const sessionState = new SessionState();

/**
 * Simple in-process event bus for broadcasting real-time events to SSE clients.
 */

export type BusEvent =
  | { type: "voice_event"; payload: unknown }
  | { type: "voice_command"; payload: unknown }
  | { type: "obs_status"; payload: unknown }
  | { type: "session_start"; payload: { sessionId: string } }
  | { type: "session_end"; payload: { sessionId: string } };

type Listener = (event: BusEvent) => void;

class EventBus {
  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: BusEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Don't let one bad listener break others
      }
    }
  }

  get clientCount(): number {
    return this.listeners.size;
  }
}

export const eventBus = new EventBus();

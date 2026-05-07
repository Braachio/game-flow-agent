"use client";

import { useEffect, useRef, useCallback, useState } from "react";

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:3001";

export interface StreamEvent {
  type: string;
  payload: unknown;
}

interface UseEventStreamOptions {
  onEvent?: (event: StreamEvent) => void;
}

export function useEventStream({ onEvent }: UseEventStreamOptions = {}) {
  const [connected, setConnected] = useState(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const esRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (esRef.current) return;

    const es = new EventSource(`${AGENT_URL}/events/stream`);
    esRef.current = es;

    es.addEventListener("connected", () => {
      setConnected(true);
    });

    es.addEventListener("voice_event", (e) => {
      onEventRef.current?.({ type: "voice_event", payload: JSON.parse(e.data) });
    });

    es.addEventListener("voice_command", (e) => {
      onEventRef.current?.({ type: "voice_command", payload: JSON.parse(e.data) });
    });

    es.addEventListener("obs_status", (e) => {
      onEventRef.current?.({ type: "obs_status", payload: JSON.parse(e.data) });
    });

    es.addEventListener("session_start", (e) => {
      onEventRef.current?.({ type: "session_start", payload: JSON.parse(e.data) });
    });

    es.addEventListener("session_end", (e) => {
      onEventRef.current?.({ type: "session_end", payload: JSON.parse(e.data) });
    });

    es.addEventListener("agent_speak", (e) => {
      onEventRef.current?.({ type: "agent_speak", payload: JSON.parse(e.data) });
    });

    es.onerror = () => {
      setConnected(false);
      // EventSource auto-reconnects
    };

    es.onopen = () => {
      setConnected(true);
    };
  }, []);

  const disconnect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => { disconnect(); };
  }, [connect, disconnect]);

  return { connected, connect, disconnect };
}

"use client";

import { useState, useCallback, useEffect } from "react";
import type { ObsStatus } from "@likelion/shared";

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:3001";

export function useObs() {
  const [status, setStatus] = useState<ObsStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${AGENT_URL}/obs/status`);
      if (res.ok) {
        setStatus(await res.json());
      }
    } catch {
      // agent not reachable
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const callObs = useCallback(async (endpoint: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${AGENT_URL}${endpoint}`, { method: "POST" });
      if (res.ok) {
        setStatus(await res.json());
      }
    } catch {
      // agent not reachable
    } finally {
      setLoading(false);
    }
  }, []);

  const connect = useCallback(() => callObs("/obs/connect"), [callObs]);
  const disconnect = useCallback(() => callObs("/obs/disconnect"), [callObs]);
  const startReplay = useCallback(() => callObs("/obs/replay/start"), [callObs]);
  const saveReplay = useCallback(() => callObs("/obs/replay/save"), [callObs]);

  return { status, loading, connect, disconnect, startReplay, saveReplay };
}

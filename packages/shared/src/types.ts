export type ReactionCategory =
  | "excitement"
  | "frustration"
  | "surprise"
  | "victory"
  | "defeat"
  | "neutral";

export interface VoiceEvent {
  id: string;
  timestamp: string;
  transcript: string;
  category: ReactionCategory;
  confidence: number;
  clipSaved?: boolean;
  obsTriggeredAt?: string;
  obsError?: string;
  metadata?: Record<string, unknown>;
}

export interface VoiceEventRequest {
  transcript: string;
  timestamp?: string;
}

export interface VoiceEventResponse {
  event: VoiceEvent;
}

export interface VoiceEventIgnoredResponse {
  ignored: true;
  reason: "duplicate" | "cooldown" | "low_confidence";
}

export interface HealthResponse {
  status: "ok";
  uptime: number;
  version: string;
}

export interface ClassificationResult {
  category: ReactionCategory;
  confidence: number;
  matchedKeywords: string[];
}

export interface EventStats {
  total: number;
  byCategory: Record<ReactionCategory, number>;
  lastEventTime: string | null;
}

export interface ObsStatus {
  connected: boolean;
  replayBufferActive: boolean;
  error?: string;
}

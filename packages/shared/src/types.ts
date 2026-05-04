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
  metadata?: Record<string, unknown>;
}

export interface VoiceEventRequest {
  transcript: string;
  timestamp?: string;
}

export interface VoiceEventResponse {
  event: VoiceEvent;
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

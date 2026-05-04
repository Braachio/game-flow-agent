export type ReactionCategory =
  | "excitement"
  | "frustration"
  | "surprise"
  | "victory"
  | "defeat"
  | "neutral";

export type UserFeedback = "false_positive" | "useful" | null;

export interface VoiceEvent {
  id: string;
  sessionId?: string;
  timestamp: string;
  transcript: string;
  category: ReactionCategory;
  confidence: number;
  matchedKeywords?: string[];
  clipSaved?: boolean;
  obsTriggeredAt?: string;
  obsError?: string;
  feedback?: UserFeedback;
  metadata?: Record<string, unknown>;
}

export interface VoiceEventRequest {
  transcript: string;
  sessionId?: string;
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
  debug?: ClassificationDebug;
}

export interface ClassificationDebug {
  rawScore: number;
  phraseMatches: string[];
  keywordMatches: string[];
  repetitionBoost: number;
  intensityBoost: number;
  filtered: boolean;
  filterReason?: string;
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

export interface EvaluationMetrics {
  totalTranscripts: number;
  detectedEvents: number;
  clippedEvents: number;
  ignoredEvents: number;
  falsePositives: number;
  falseNegatives: number;
  useful: number;
  precision: number | null;
  sessionId: string | null;
}

export interface FalseNegativeEvent {
  id: string;
  sessionId?: string;
  timestamp: string;
  note?: string;
}

export interface SessionReport {
  sessionId: string;
  startedAt: string;
  endedAt: string;
  totalReactions: number;
  clipsSaved: number;
  byCategory: Record<ReactionCategory, number>;
  interpretation: string;
  memo?: string;
}

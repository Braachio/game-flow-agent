import type { AgentAction, ReactionCategory, VoiceIntent, VoiceEvent } from "@likelion/shared";

export interface DecisionInput {
  transcript: string;
  intent?: VoiceIntent;
  category: ReactionCategory;
  confidence: number;
  sessionActive: boolean;
  recentEvents?: VoiceEvent[];
}

export interface DecisionOutput {
  action: AgentAction;
  actionReason: string;
}

export function decideAction(input: DecisionInput): DecisionOutput {
  const { intent, category, confidence, sessionActive } = input;

  // Session control intents take priority
  if (intent === "START_SESSION" && !sessionActive) {
    return { action: "START_SESSION", actionReason: "voice intent: start session" };
  }
  if (intent === "END_SESSION" && sessionActive) {
    return { action: "END_SESSION", actionReason: "voice intent: end session" };
  }

  // Guard: ignore invalid session commands
  if (intent === "START_SESSION" && sessionActive) {
    return { action: "IGNORE", actionReason: "session already active" };
  }
  if (intent === "END_SESSION" && !sessionActive) {
    return { action: "IGNORE", actionReason: "no active session" };
  }

  // Low confidence → ignore
  if (confidence < 0.6) {
    return { action: "IGNORE", actionReason: `low confidence (${Math.round(confidence * 100)}%)` };
  }

  // Category-based decisions
  if (category === "excitement" || category === "victory") {
    return { action: "SAVE_CLIP", actionReason: `high-value moment: ${category}` };
  }

  if (category === "surprise") {
    if (confidence >= 0.75) {
      return { action: "SAVE_CLIP", actionReason: `surprise with high confidence (${Math.round(confidence * 100)}%)` };
    }
    return { action: "TAG_EVENT", actionReason: `surprise but confidence below clip threshold (${Math.round(confidence * 100)}%)` };
  }

  if (category === "frustration" || category === "defeat") {
    return { action: "TAG_EVENT", actionReason: `negative moment: ${category}` };
  }

  // neutral or anything else
  return { action: "IGNORE", actionReason: "neutral — no action needed" };
}

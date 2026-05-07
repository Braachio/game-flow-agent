import type { AgentAction, ReactionCategory, VoiceIntent, VoiceEvent } from "@likelion/shared";
import { flowTracker, type FlowContext } from "./flow-tracker.js";

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
  flowContext?: FlowContext;
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

  // Get flow context for smarter decisions
  const flow = flowTracker.analyze(category, confidence);

  // Use adaptive threshold instead of fixed 0.6
  if (confidence < flow.adaptiveThreshold) {
    return {
      action: "IGNORE",
      actionReason: `below adaptive threshold (${Math.round(confidence * 100)}% < ${Math.round(flow.adaptiveThreshold * 100)}%)`,
      flowContext: flow,
    };
  }

  // Apply silence boost to effective confidence
  const effectiveConfidence = Math.min(confidence + flow.silenceBoost, 1);

  // Category-based decisions with flow awareness
  if (category === "excitement" || category === "victory") {
    // Suppress if sustained same category (avoid 3 identical clips in a row)
    if (flow.suppressClip) {
      return {
        action: "TAG_EVENT",
        actionReason: `sustained ${category} — tagging instead of clipping (${flow.categoryRepeatCount}x repeat)`,
        flowContext: flow,
      };
    }

    // Turning point bonus: switch from negative to positive = likely a comeback
    const reason = flow.isTurningPoint
      ? `turning point: ${category} after negative (silence ${Math.round(flow.silenceSec)}s)`
      : flow.silenceBoost > 0
        ? `high-value moment: ${category} (silence boost +${Math.round(flow.silenceBoost * 100)}%)`
        : `high-value moment: ${category}`;

    return { action: "SAVE_CLIP", actionReason: reason, flowContext: flow };
  }

  if (category === "surprise") {
    if (effectiveConfidence >= 0.75) {
      if (flow.suppressClip) {
        return {
          action: "TAG_EVENT",
          actionReason: `sustained surprise — tagging (${flow.categoryRepeatCount}x)`,
          flowContext: flow,
        };
      }
      return {
        action: "SAVE_CLIP",
        actionReason: `surprise with effective confidence ${Math.round(effectiveConfidence * 100)}%`,
        flowContext: flow,
      };
    }
    return {
      action: "TAG_EVENT",
      actionReason: `surprise but below clip threshold (${Math.round(effectiveConfidence * 100)}%)`,
      flowContext: flow,
    };
  }

  if (category === "frustration" || category === "defeat") {
    // Turning point (positive → negative) after a streak = meaningful moment
    if (flow.isTurningPoint && flow.silenceBoost > 0.1) {
      return {
        action: "SAVE_CLIP",
        actionReason: `dramatic reversal: ${category} after positive streak`,
        flowContext: flow,
      };
    }
    return {
      action: "TAG_EVENT",
      actionReason: `negative moment: ${category}`,
      flowContext: flow,
    };
  }

  return { action: "IGNORE", actionReason: "neutral — no action needed", flowContext: flow };
}

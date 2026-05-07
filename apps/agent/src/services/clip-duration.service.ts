import type { FlowContext } from "./flow-tracker.js";

/**
 * Determines the optimal clip duration (in seconds) based on event importance.
 * OBS Replay Buffer captures the last N seconds — so this tells us how far back
 * we want the clip to go.
 */

const DEFAULT_DURATION = 15;
const MIN_DURATION = 10;
const MAX_DURATION = 45;

export interface ClipDurationRecommendation {
  durationSec: number;
  reason: string;
}

export function recommendClipDuration(flowContext?: FlowContext | null): ClipDurationRecommendation {
  if (!flowContext) {
    return { durationSec: DEFAULT_DURATION, reason: "default (no flow context)" };
  }

  let duration = DEFAULT_DURATION;
  const reasons: string[] = [];

  // Turning point: need more context before and after
  if (flowContext.isTurningPoint) {
    duration += 10;
    reasons.push("turning point +10s");
  }

  // Long silence before: the buildup matters
  if (flowContext.silenceSec > 20) {
    duration += 10;
    reasons.push("long silence buildup +10s");
  } else if (flowContext.silenceSec > 10) {
    duration += 5;
    reasons.push("silence buildup +5s");
  }

  // Peak phase: rapid events, shorter clip is fine
  if (flowContext.phase === "peak" && !flowContext.isTurningPoint) {
    duration -= 5;
    reasons.push("peak phase -5s");
  }

  // Sustained: we've been clipping a lot, keep it short
  if (flowContext.categoryRepeatCount >= 3) {
    duration = MIN_DURATION;
    reasons.push("sustained — minimum");
  }

  duration = Math.max(MIN_DURATION, Math.min(MAX_DURATION, duration));

  return {
    durationSec: duration,
    reason: reasons.length > 0 ? reasons.join(", ") : `default ${DEFAULT_DURATION}s`,
  };
}

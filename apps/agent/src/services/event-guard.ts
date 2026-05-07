import type { ReactionCategory } from "@likelion/shared";
import { runtimeConfig } from "./runtime-config.js";

type RejectReason = "duplicate" | "cooldown" | "low_confidence";

interface GuardResult {
  allowed: boolean;
  reason?: RejectReason;
}

export class EventGuard {
  private lastTranscript: string | null = null;
  private lastTranscriptTime = 0;
  private lastCategoryTime: Map<ReactionCategory, number> = new Map();

  check(transcript: string, category: ReactionCategory, confidence: number): GuardResult {
    const now = Date.now();
    const config = runtimeConfig.getCached();

    // 1. Low confidence check
    if (confidence < config.confidenceThreshold) {
      console.log(
        `[EventGuard] IGNORED (low_confidence): "${transcript}" → ${category} (${(confidence * 100).toFixed(0)}% < ${config.confidenceThreshold * 100}%)`
      );
      return { allowed: false, reason: "low_confidence" };
    }

    // 2. Duplicate transcript check (same text within window)
    if (
      this.lastTranscript === transcript &&
      now - this.lastTranscriptTime < config.duplicateWindowMs
    ) {
      console.log(
        `[EventGuard] IGNORED (duplicate): "${transcript}" — same transcript within ${config.duplicateWindowMs}ms`
      );
      return { allowed: false, reason: "duplicate" };
    }

    // 3. Same category within duplicate window
    const lastTime = this.lastCategoryTime.get(category) || 0;
    if (now - lastTime < config.duplicateWindowMs) {
      console.log(
        `[EventGuard] IGNORED (duplicate): "${transcript}" — same category "${category}" within ${config.duplicateWindowMs}ms`
      );
      return { allowed: false, reason: "duplicate" };
    }

    // 4. Category cooldown check
    if (now - lastTime < config.cooldownMs) {
      const remaining = config.cooldownMs - (now - lastTime);
      console.log(
        `[EventGuard] IGNORED (cooldown): "${transcript}" → ${category} — ${remaining}ms remaining`
      );
      return { allowed: false, reason: "cooldown" };
    }

    // Passed all checks — update state
    this.lastTranscript = transcript;
    this.lastTranscriptTime = now;
    this.lastCategoryTime.set(category, now);

    return { allowed: true };
  }
}

export const eventGuard = new EventGuard();

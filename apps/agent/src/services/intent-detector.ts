import { INTENT_RULES, INTENT_CONFIDENCE_THRESHOLD } from "@likelion/shared";
import type { VoiceIntent } from "@likelion/shared";

export interface IntentResult {
  detected: boolean;
  intent?: VoiceIntent;
  confidence: number;
  matchedPhrase?: string;
}

export function detectIntent(transcript: string): IntentResult {
  const normalized = transcript.trim();

  for (const rule of INTENT_RULES) {
    for (const phrase of rule.phrases) {
      if (normalized.includes(phrase)) {
        // Confidence based on how much of the transcript is the command
        const ratio = phrase.length / normalized.length;
        const confidence = Math.min(0.5 + ratio * 0.5, 1.0);

        if (confidence >= INTENT_CONFIDENCE_THRESHOLD) {
          return {
            detected: true,
            intent: rule.intent,
            confidence,
            matchedPhrase: phrase,
          };
        }
      }
    }
  }

  return { detected: false, confidence: 0 };
}

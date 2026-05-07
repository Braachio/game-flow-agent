import { INTENT_RULES, INTENT_CONFIDENCE_THRESHOLD } from "@likelion/shared";
import type { VoiceIntent } from "@likelion/shared";

export interface IntentResult {
  detected: boolean;
  intent?: VoiceIntent;
  confidence: number;
  matchedPhrase?: string;
}

/** Remove all whitespace for comparison (Korean STT often varies spacing) */
function stripSpaces(s: string): string {
  return s.replace(/\s+/g, "");
}

export function detectIntent(transcript: string): IntentResult {
  const normalized = transcript.trim();
  const normalizedNoSpace = stripSpaces(normalized);

  for (const rule of INTENT_RULES) {
    for (const phrase of rule.phrases) {
      const phraseNoSpace = stripSpaces(phrase);

      // Match with original spacing or without spacing
      if (normalized.includes(phrase) || normalizedNoSpace.includes(phraseNoSpace)) {
        // Confidence based on how much of the transcript is the command
        const ratio = phraseNoSpace.length / normalizedNoSpace.length;
        const confidence = Math.min(0.5 + ratio * 0.5, 1.0);

        if (confidence >= INTENT_CONFIDENCE_THRESHOLD) {
          console.log(`[Intent] Detected: "${transcript}" → ${rule.intent} (matched "${phrase}", conf ${(confidence * 100).toFixed(0)}%)`);
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

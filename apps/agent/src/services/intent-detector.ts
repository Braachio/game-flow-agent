import { INTENT_RULES, INTENT_CONFIDENCE_THRESHOLD } from "@likelion/shared";
import type { VoiceIntent } from "@likelion/shared";

export interface IntentResult {
  detected: boolean;
  intent?: VoiceIntent;
  confidence: number;
  matchedPhrase?: string;
}

/** Common Korean STT misrecognition patterns → corrected form */
const STT_CORRECTIONS: Record<string, string> = {
  // 세션 시작 variants
  "패션 시작": "세션 시작",
  "패션시작": "세션시작",
  "새션 시작": "세션 시작",
  "세선 시작": "세션 시작",
  "세션 시자": "세션 시작",
  "쎄션 시작": "세션 시작",
  // 세션 종료 variants
  "세션 종류": "세션 종료",
  "세션종류": "세션종료",
  "세션 종로": "세션 종료",
  "세선 종료": "세션 종료",
  "패션 종료": "세션 종료",
  // 시작/종료 단축
  "시작할께": "시작할게",
  "종료할께": "종료할게",
  "끝낼께": "끝낼게",
};

/** Remove all whitespace for comparison */
function stripSpaces(s: string): string {
  return s.replace(/\s+/g, "");
}

/** Levenshtein edit distance */
function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/** Apply known STT corrections */
function correctSTT(transcript: string): string {
  let corrected = transcript;
  for (const [wrong, right] of Object.entries(STT_CORRECTIONS)) {
    if (corrected.includes(wrong)) {
      corrected = corrected.replace(wrong, right);
    }
  }
  return corrected;
}

export function detectIntent(transcript: string): IntentResult {
  const normalized = transcript.trim();

  // Apply STT corrections first
  const corrected = correctSTT(normalized);
  if (corrected !== normalized) {
    console.log(`[Intent] STT corrected: "${normalized}" → "${corrected}"`);
  }

  const correctedNoSpace = stripSpaces(corrected);

  for (const rule of INTENT_RULES) {
    for (const phrase of rule.phrases) {
      const phraseNoSpace = stripSpaces(phrase);

      // Exact match (with or without spaces)
      if (corrected.includes(phrase) || correctedNoSpace.includes(phraseNoSpace)) {
        const ratio = phraseNoSpace.length / correctedNoSpace.length;
        const confidence = Math.min(0.5 + ratio * 0.5, 1.0);

        if (confidence >= INTENT_CONFIDENCE_THRESHOLD) {
          console.log(`[Intent] Detected: "${transcript}" → ${rule.intent} (matched "${phrase}", conf ${(confidence * 100).toFixed(0)}%)`);
          return { detected: true, intent: rule.intent, confidence, matchedPhrase: phrase };
        }
      }

      // Fuzzy match — allow 1 character difference for short phrases
      const dist = editDistance(correctedNoSpace, phraseNoSpace);
      const maxDist = phraseNoSpace.length <= 4 ? 1 : 2;
      if (dist <= maxDist && dist > 0) {
        const confidence = Math.max(0.8 - dist * 0.1, 0.7);
        console.log(`[Intent] Fuzzy match: "${transcript}" ≈ "${phrase}" (dist=${dist}, conf ${(confidence * 100).toFixed(0)}%)`);
        return { detected: true, intent: rule.intent, confidence, matchedPhrase: phrase };
      }
    }
  }

  return { detected: false, confidence: 0 };
}

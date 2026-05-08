/**
 * Response cache for common reactions.
 * Pre-generates multiple varied responses per category using LLM,
 * then picks randomly for instant replies.
 */

interface CachedReaction {
  action: "SAVE" | "ASK" | "SKIP";
  speech: string;
}

// Pre-built varied responses per category
const RESPONSE_POOL: Record<string, CachedReaction[]> = {
  excitement: [
    { action: "SAVE", speech: "오 대박 저장!" },
    { action: "SAVE", speech: "ㅋㅋ 미쳤다 저장함" },
    { action: "SAVE", speech: "진짜 좋은데? 저장!" },
    { action: "SAVE", speech: "와 이거 저장해야지" },
    { action: "SAVE", speech: "쩐다 ㅋㅋ 저장" },
    { action: "SAVE", speech: "개쩔어 저장!" },
    { action: "SAVE", speech: "ㄹㅇ 대박 저장함" },
    { action: "SAVE", speech: "방금 거 미쳤다 저장" },
  ],
  victory: [
    { action: "SAVE", speech: "이겼다! 저장!" },
    { action: "SAVE", speech: "ㅋㅋ 승리 저장함" },
    { action: "SAVE", speech: "개잘했어 저장!" },
    { action: "SAVE", speech: "나이스 저장해둘게" },
    { action: "SAVE", speech: "MVP 클립 저장!" },
    { action: "SAVE", speech: "역시 잘한다 저장" },
  ],
  frustration: [
    { action: "ASK", speech: "뭐였어?" },
    { action: "ASK", speech: "왜 짜증나?" },
    { action: "ASK", speech: "무슨 일이야?" },
    { action: "ASK", speech: "뭔데?" },
    { action: "ASK", speech: "어떤 상황?" },
    { action: "ASK", speech: "뭐가 문제야?" },
  ],
  defeat: [
    { action: "ASK", speech: "아 졌어?" },
    { action: "ASK", speech: "뭐였어?" },
    { action: "ASK", speech: "저장할까?" },
    { action: "ASK", speech: "어떻게 된 거야?" },
  ],
  surprise: [
    { action: "ASK", speech: "뭐야 뭐야?" },
    { action: "ASK", speech: "뭐였어?!" },
    { action: "ASK", speech: "방금 뭐야?" },
    { action: "ASK", speech: "저장할까?" },
  ],
};

// Track recently used indices to avoid immediate repeats
const recentIndices: Record<string, number[]> = {};

/**
 * Get a cached response for a category. Returns null if no cache available.
 * Avoids repeating the last 3 responses.
 */
export function getCachedReaction(category: string): CachedReaction | null {
  const pool = RESPONSE_POOL[category];
  if (!pool || pool.length === 0) return null;

  // Track recent to avoid repeats
  if (!recentIndices[category]) recentIndices[category] = [];
  const recent = recentIndices[category];

  // Pick random index not in recent
  let idx: number;
  let attempts = 0;
  do {
    idx = Math.floor(Math.random() * pool.length);
    attempts++;
  } while (recent.includes(idx) && attempts < 10);

  // Update recent
  recent.push(idx);
  if (recent.length > 3) recent.shift();

  return pool[idx];
}

/**
 * Check if we should use cache (fast path) or LLM (slow path).
 * Use cache for high-confidence, common categories.
 * Use LLM for turning points, low confidence, or rare situations.
 */
export function shouldUseCache(context: {
  category: string;
  confidence: number;
  isTurningPoint?: boolean;
}): boolean {
  // Always use LLM for special moments
  if (context.isTurningPoint) return false;

  // Low confidence = ambiguous, need LLM
  if (context.confidence < 0.5) return false;

  // Only cache for known categories
  return context.category in RESPONSE_POOL;
}

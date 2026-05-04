import { KEYWORD_RULES, type ClassificationResult } from "@likelion/shared";

export function classify(transcript: string): ClassificationResult {
  const results: { category: ClassificationResult["category"]; matches: string[]; score: number }[] = [];

  for (const rule of KEYWORD_RULES) {
    const matches: string[] = [];
    for (const keyword of rule.keywords) {
      if (transcript.includes(keyword)) {
        matches.push(keyword);
      }
    }
    if (matches.length > 0) {
      results.push({
        category: rule.category,
        matches,
        score: matches.length * rule.weight,
      });
    }
  }

  if (results.length === 0) {
    return { category: "neutral", confidence: 0, matchedKeywords: [] };
  }

  results.sort((a, b) => b.score - a.score);
  const best = results[0];
  const confidence = Math.min(best.score / 3, 1);

  return {
    category: best.category,
    confidence,
    matchedKeywords: best.matches,
  };
}

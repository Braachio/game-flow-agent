import {
  KEYWORD_RULES,
  PHRASE_RULES,
  NOISE_WORDS,
  INTENSITY_WORDS,
  type ClassificationResult,
  type ClassificationDebug,
  type ReactionCategory,
} from "@likelion/shared";
import { feedbackLearner } from "./feedback-learner.js";

const DEBUG = process.env.CLASSIFIER_DEBUG === "true";

interface ScoredCategory {
  category: ReactionCategory;
  score: number;
  phraseMatches: string[];
  keywordMatches: string[];
}

export function classify(transcript: string): ClassificationResult {
  const debug: ClassificationDebug = {
    rawScore: 0,
    phraseMatches: [],
    keywordMatches: [],
    repetitionBoost: 0,
    intensityBoost: 0,
    filtered: false,
  };

  // 1. Noise filter — check if transcript is meaningless
  if (shouldFilter(transcript, debug)) {
    const result: ClassificationResult = {
      category: "neutral",
      confidence: 0,
      matchedKeywords: [],
    };
    if (DEBUG) {
      result.debug = debug;
      logDebug(transcript, result);
    }
    return result;
  }

  // 2. Check for repeated noise words that indicate a category
  const repetitionCategory = detectRepetitionCategory(transcript);
  if (repetitionCategory) {
    const repBoost = calcRepetitionBoost(transcript);
    // Repetition patterns get base score of 2 (like a phrase match)
    const confidence = Math.min((2 + repBoost) / 3, 1);
    debug.rawScore = 2;
    debug.repetitionBoost = repBoost;
    debug.keywordMatches = [repetitionCategory.match];

    const result: ClassificationResult = {
      category: repetitionCategory.category,
      confidence,
      matchedKeywords: [repetitionCategory.match],
    };
    if (DEBUG) {
      result.debug = debug;
      logDebug(transcript, result);
    }
    return result;
  }

  // 3. Score each category
  const scores: ScoredCategory[] = [];

  for (const rule of PHRASE_RULES) {
    const matches: string[] = [];
    for (const phrase of rule.phrases) {
      if (transcript.includes(phrase)) {
        matches.push(phrase);
      }
    }
    if (matches.length > 0) {
      const existing = scores.find((s) => s.category === rule.category);
      if (existing) {
        existing.score += matches.length * rule.weight;
        existing.phraseMatches.push(...matches);
      } else {
        scores.push({
          category: rule.category,
          score: matches.length * rule.weight,
          phraseMatches: matches,
          keywordMatches: [],
        });
      }
    }
  }

  for (const rule of KEYWORD_RULES) {
    const matches: string[] = [];
    for (const keyword of rule.keywords) {
      if (transcript.includes(keyword)) {
        matches.push(keyword);
      }
    }
    if (matches.length > 0) {
      const existing = scores.find((s) => s.category === rule.category);
      if (existing) {
        existing.score += matches.length * rule.weight;
        existing.keywordMatches.push(...matches);
      } else {
        scores.push({
          category: rule.category,
          score: matches.length * rule.weight,
          phraseMatches: [],
          keywordMatches: matches,
        });
      }
    }
  }

  if (scores.length === 0) {
    const result: ClassificationResult = {
      category: "neutral",
      confidence: 0,
      matchedKeywords: [],
    };
    if (DEBUG) {
      result.debug = debug;
      logDebug(transcript, result);
    }
    return result;
  }

  // 3. Pick best category
  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];

  // 4. Repetition boost — repeated words increase confidence
  const repetitionBoost = calcRepetitionBoost(transcript);

  // 5. Intensity boost — strong modifier words
  const intensityBoost = calcIntensityBoost(transcript);

  // 6. Feedback-learned weight adjustment
  const allMatched = [...best.phraseMatches, ...best.keywordMatches];
  const feedbackAdjustment = feedbackLearner.getScoreAdjustment(allMatched);

  const totalScore = best.score + repetitionBoost + intensityBoost + feedbackAdjustment;
  const confidence = Math.max(0, Math.min(totalScore / 3, 1));

  const allMatches = allMatched;

  debug.rawScore = best.score;
  debug.phraseMatches = best.phraseMatches;
  debug.keywordMatches = best.keywordMatches;
  debug.repetitionBoost = repetitionBoost;
  debug.intensityBoost = intensityBoost;

  const result: ClassificationResult = {
    category: best.category,
    confidence,
    matchedKeywords: allMatches,
  };

  if (DEBUG) {
    result.debug = debug;
    logDebug(transcript, result);
  }

  return result;
}

function shouldFilter(transcript: string, debug: ClassificationDebug): boolean {
  const trimmed = transcript.trim();

  // Empty or very short
  if (trimmed.length === 0) {
    debug.filtered = true;
    debug.filterReason = "empty transcript";
    return true;
  }

  // Tokenize by spaces
  const tokens = trimmed.split(/\s+/).filter((t) => t.length > 0);

  // Single token that is a noise word and NOT repeated
  if (tokens.length === 1) {
    const token = tokens[0];
    if (NOISE_WORDS.has(token)) {
      debug.filtered = true;
      debug.filterReason = `single noise word: "${token}"`;
      return true;
    }
    // Single syllable (1 char) that's not a known strong keyword
    if (token.length === 1 && !isStrongSingleChar(token)) {
      debug.filtered = true;
      debug.filterReason = `single syllable: "${token}"`;
      return true;
    }
  }

  // All tokens are noise words
  const meaningfulTokens = tokens.filter((t) => !NOISE_WORDS.has(t));
  if (meaningfulTokens.length === 0) {
    // Unless it's a repetition pattern (e.g., "아 아 아")
    if (!hasRepetition(tokens)) {
      debug.filtered = true;
      debug.filterReason = "all noise words, no repetition";
      return true;
    }
  }

  // Minimum: need 2+ meaningful tokens OR a repeated pattern
  if (meaningfulTokens.length < 2 && !hasRepetition(tokens)) {
    // Allow through if the single meaningful token is multi-syllable (2+ chars)
    if (meaningfulTokens.length === 1 && meaningfulTokens[0].length >= 2) {
      return false;
    }
    debug.filtered = true;
    debug.filterReason = `insufficient tokens: ${meaningfulTokens.length} meaningful, no repetition`;
    return true;
  }

  return false;
}

function hasRepetition(tokens: string[]): boolean {
  if (tokens.length < 2) return false;
  const counts = new Map<string, number>();
  for (const t of tokens) {
    counts.set(t, (counts.get(t) || 0) + 1);
  }
  for (const count of counts.values()) {
    if (count >= 2) return true;
  }
  return false;
}

function calcRepetitionBoost(transcript: string): number {
  const tokens = transcript.split(/\s+/);
  const counts = new Map<string, number>();
  for (const t of tokens) {
    counts.set(t, (counts.get(t) || 0) + 1);
  }
  let boost = 0;
  for (const [, count] of counts) {
    if (count >= 3) boost += 0.6;
    else if (count >= 2) boost += 0.3;
  }
  return Math.min(boost, 1.0);
}

function calcIntensityBoost(transcript: string): number {
  let boost = 0;
  for (const word of INTENSITY_WORDS) {
    if (transcript.includes(word)) {
      boost += 0.2;
    }
  }
  // Exclamation-like patterns (끝에 ! or repeated vowels)
  if (transcript.includes("!")) boost += 0.1;
  return Math.min(boost, 0.6);
}

/** Map repeated noise words to categories */
const REPETITION_MAP: { word: string; category: ReactionCategory }[] = [
  { word: "와", category: "excitement" },
  { word: "오", category: "excitement" },
  { word: "아", category: "frustration" },
  { word: "하", category: "frustration" },
  { word: "어", category: "surprise" },
];

function detectRepetitionCategory(transcript: string): { category: ReactionCategory; match: string } | null {
  const tokens = transcript.split(/\s+/);
  if (tokens.length < 2) return null;

  for (const { word, category } of REPETITION_MAP) {
    const count = tokens.filter((t) => t === word).length;
    if (count >= 2) {
      return { category, match: `${word} (x${count})` };
    }
  }
  return null;
}

function isStrongSingleChar(char: string): boolean {
  // Single chars that are meaningful keywords on their own (when not noise)
  const strong = new Set(["킬", "겟"]);
  return strong.has(char);
}

function logDebug(transcript: string, result: ClassificationResult) {
  const d = result.debug!;
  const parts = [
    `[Classifier] "${transcript}" → ${result.category} (${(result.confidence * 100).toFixed(0)}%)`,
  ];
  if (d.filtered) {
    parts.push(`  FILTERED: ${d.filterReason}`);
  } else {
    if (d.phraseMatches.length > 0) parts.push(`  phrases: [${d.phraseMatches.join(", ")}]`);
    if (d.keywordMatches.length > 0) parts.push(`  keywords: [${d.keywordMatches.join(", ")}]`);
    if (d.repetitionBoost > 0) parts.push(`  repetition: +${d.repetitionBoost.toFixed(1)}`);
    if (d.intensityBoost > 0) parts.push(`  intensity: +${d.intensityBoost.toFixed(1)}`);
    parts.push(`  score: ${d.rawScore} + ${d.repetitionBoost.toFixed(1)} + ${d.intensityBoost.toFixed(1)} = ${(d.rawScore + d.repetitionBoost + d.intensityBoost).toFixed(1)}`);
  }
  console.log(parts.join("\n"));
}

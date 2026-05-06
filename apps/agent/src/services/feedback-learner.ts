import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { VoiceEvent } from "@likelion/shared";

const DATA_DIR = join(process.cwd(), "data");
const WEIGHTS_FILE = join(DATA_DIR, "keyword-weights.json");

/**
 * Keyword weight adjustments learned from user feedback.
 * Positive = keyword is reliable (user marked "useful")
 * Negative = keyword triggers false positives (user marked "false_positive")
 */
export interface KeywordWeights {
  [keyword: string]: number;
}

class FeedbackLearner {
  private weights: KeywordWeights = {};
  private initialized = false;

  private async init() {
    if (this.initialized) return;
    try {
      await mkdir(DATA_DIR, { recursive: true });
      const data = await readFile(WEIGHTS_FILE, "utf-8");
      this.weights = JSON.parse(data);
    } catch {
      this.weights = {};
    }
    this.initialized = true;
  }

  private async persist() {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(WEIGHTS_FILE, JSON.stringify(this.weights, null, 2));
  }

  /**
   * Process feedback for an event and adjust keyword weights.
   */
  async learn(event: VoiceEvent): Promise<void> {
    await this.init();

    const keywords = event.matchedKeywords || [];
    if (keywords.length === 0) return;

    const delta = event.feedback === "useful" ? 0.05 : -0.1;

    for (const kw of keywords) {
      const current = this.weights[kw] ?? 0;
      const updated = Math.max(-0.5, Math.min(0.5, current + delta));
      this.weights[kw] = Math.round(updated * 1000) / 1000;
    }

    await this.persist();

    const direction = event.feedback === "useful" ? "boosted" : "penalized";
    console.log(`[FeedbackLearner] ${direction} keywords: [${keywords.join(", ")}]`);
  }

  /**
   * Get weight adjustment for a keyword. Returns 0 if no feedback data.
   */
  getAdjustment(keyword: string): number {
    return this.weights[keyword] ?? 0;
  }

  /**
   * Get total weight adjustment for a set of keywords.
   */
  getScoreAdjustment(keywords: string[]): number {
    let total = 0;
    for (const kw of keywords) {
      total += this.getAdjustment(kw);
    }
    return total;
  }

  /**
   * Get keywords that have been penalized below a threshold (likely bad keywords).
   */
  getPenalizedKeywords(threshold = -0.2): Array<{ keyword: string; weight: number }> {
    return Object.entries(this.weights)
      .filter(([, w]) => w <= threshold)
      .map(([keyword, weight]) => ({ keyword, weight }))
      .sort((a, b) => a.weight - b.weight);
  }

  /**
   * Get all learned weights (for API/debug).
   */
  async getWeights(): Promise<KeywordWeights> {
    await this.init();
    return { ...this.weights };
  }
}

export const feedbackLearner = new FeedbackLearner();

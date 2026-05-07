import type { ReactionCategory, VoiceEvent } from "@likelion/shared";

interface FlowEvent {
  category: ReactionCategory;
  confidence: number;
  timestamp: number; // epoch ms
}

export interface FlowContext {
  /** Seconds since last event (silence duration) */
  silenceSec: number;
  /** Importance multiplier from silence (longer silence = more important) */
  silenceBoost: number;
  /** Current flow phase */
  phase: "idle" | "buildup" | "peak" | "sustained" | "cooldown";
  /** Whether this event breaks a pattern (e.g., frustration after excitement) */
  isTurningPoint: boolean;
  /** How many events of same category in recent window */
  categoryRepeatCount: number;
  /** Whether clip should be suppressed (too many similar clips recently) */
  suppressClip: boolean;
  /** Adaptive confidence threshold for this session */
  adaptiveThreshold: number;
}

const WINDOW_SIZE = 10;
const SILENCE_BOOST_MIN_SEC = 10;
const SILENCE_BOOST_MAX = 0.4;
const SUSTAINED_THRESHOLD = 1; // after N consecutive same-category clips → suppress next
const CLIP_COOLDOWN_SEC = 15; // suppress same-category clips within N seconds of last clip

class FlowTracker {
  private window: FlowEvent[] = [];
  private lastClipTime = 0;
  private categoryCounts: Record<string, number> = {};
  private totalEvents = 0;

  reset(): void {
    this.window = [];
    this.lastClipTime = 0;
    this.categoryCounts = {};
    this.totalEvents = 0;
  }

  /**
   * Analyze the flow context for an incoming event.
   * Call this BEFORE deciding on an action.
   */
  analyze(category: ReactionCategory, confidence: number): FlowContext {
    const now = Date.now();
    const lastEvent = this.window[this.window.length - 1];
    const silenceMs = lastEvent ? now - lastEvent.timestamp : 0;
    const silenceSec = silenceMs / 1000;

    // Silence boost: longer silence → moment is more significant
    const silenceBoost = silenceSec >= SILENCE_BOOST_MIN_SEC
      ? Math.min((silenceSec - SILENCE_BOOST_MIN_SEC) / 30, SILENCE_BOOST_MAX)
      : 0;

    // Category repeat count: consecutive same-category events from the end
    let recentSameCategory = 0;
    for (let i = this.window.length - 1; i >= 0; i--) {
      if (this.window[i].category === category) recentSameCategory++;
      else break;
    }

    // Detect phase
    const phase = this.detectPhase(category, silenceSec, recentSameCategory);

    // Turning point: category shift from positive→negative or vice versa
    const isTurningPoint = this.isTurningPoint(category);

    // Suppress clip if same-category clips are firing too fast
    const timeSinceLastClip = (now - this.lastClipTime) / 1000;
    const suppressClip = recentSameCategory >= SUSTAINED_THRESHOLD && timeSinceLastClip < CLIP_COOLDOWN_SEC;

    // Adaptive threshold: if a category fires too often, raise threshold
    const adaptiveThreshold = this.getAdaptiveThreshold(category);

    return {
      silenceSec,
      silenceBoost,
      phase,
      isTurningPoint,
      categoryRepeatCount: recentSameCategory,
      suppressClip,
      adaptiveThreshold,
    };
  }

  /**
   * Record an event into the flow window. Call AFTER event is accepted.
   */
  record(category: ReactionCategory, confidence: number, wasClipped: boolean): void {
    const now = Date.now();
    this.window.push({ category, confidence, timestamp: now });
    if (this.window.length > WINDOW_SIZE) {
      this.window.shift();
    }
    this.categoryCounts[category] = (this.categoryCounts[category] || 0) + 1;
    this.totalEvents++;
    if (wasClipped) {
      this.lastClipTime = now;
    }
  }

  private detectPhase(
    category: ReactionCategory,
    silenceSec: number,
    recentSameCount: number,
  ): FlowContext["phase"] {
    if (this.window.length === 0) return "idle";
    if (silenceSec > 30) return "idle";
    if (silenceSec > 15) return "cooldown";
    if (recentSameCount >= SUSTAINED_THRESHOLD) return "sustained";

    // Check if we're in a buildup (increasing intensity)
    const recent3 = this.window.slice(-3);
    if (recent3.length >= 3) {
      const avgConf = recent3.reduce((s, e) => s + e.confidence, 0) / recent3.length;
      if (avgConf > 0.7) return "peak";
    }

    return "buildup";
  }

  private isTurningPoint(category: ReactionCategory): boolean {
    if (this.window.length < 2) return false;
    const prev = this.window[this.window.length - 1];

    const positive = new Set<ReactionCategory>(["excitement", "victory"]);
    const negative = new Set<ReactionCategory>(["frustration", "defeat"]);

    const prevPositive = positive.has(prev.category);
    const prevNegative = negative.has(prev.category);
    const curPositive = positive.has(category);
    const curNegative = negative.has(category);

    return (prevPositive && curNegative) || (prevNegative && curPositive);
  }

  private getAdaptiveThreshold(category: ReactionCategory): number {
    if (this.totalEvents < 5) return 0.6; // not enough data

    const catCount = this.categoryCounts[category] || 0;
    const ratio = catCount / this.totalEvents;

    // If this category fires > 40% of the time, raise threshold
    if (ratio > 0.4) return 0.75;
    if (ratio > 0.3) return 0.7;
    return 0.6;
  }
}

export const flowTracker = new FlowTracker();

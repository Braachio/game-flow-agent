import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  VoiceEvent,
  ReactionCategory,
  EventStats,
  EvaluationMetrics,
  UserFeedback,
  FalseNegativeEvent,
} from "@likelion/shared";

const DATA_DIR = join(process.cwd(), "data");
const EVENTS_FILE = join(DATA_DIR, "events.json");
const FN_FILE = join(DATA_DIR, "false-negatives.json");

interface EventInput {
  transcript: string;
  sessionId?: string;
  timestamp: string;
  category: ReactionCategory;
  confidence: number;
  matchedKeywords: string[];
}

class EventRepository {
  private events: VoiceEvent[] = [];
  private falseNegatives: FalseNegativeEvent[] = [];
  private ignoredCount = 0;
  private transcriptCount = 0;
  private initialized = false;

  private async init() {
    if (this.initialized) return;
    try {
      await mkdir(DATA_DIR, { recursive: true });
      const data = await readFile(EVENTS_FILE, "utf-8");
      this.events = JSON.parse(data);
    } catch {
      this.events = [];
    }
    try {
      const data = await readFile(FN_FILE, "utf-8");
      this.falseNegatives = JSON.parse(data);
    } catch {
      this.falseNegatives = [];
    }
    this.initialized = true;
  }

  incrementTranscriptCount() {
    this.transcriptCount++;
  }

  incrementIgnoredCount() {
    this.ignoredCount++;
  }

  async save(input: EventInput): Promise<VoiceEvent> {
    await this.init();
    const event: VoiceEvent = {
      id: randomUUID(),
      sessionId: input.sessionId,
      timestamp: input.timestamp,
      transcript: input.transcript,
      category: input.category,
      confidence: input.confidence,
    };
    this.events.push(event);
    await writeFile(EVENTS_FILE, JSON.stringify(this.events, null, 2));
    return event;
  }

  async update(event: VoiceEvent): Promise<void> {
    await this.init();
    const idx = this.events.findIndex((e) => e.id === event.id);
    if (idx !== -1) {
      this.events[idx] = event;
      await writeFile(EVENTS_FILE, JSON.stringify(this.events, null, 2));
    }
  }

  async markFeedback(eventId: string, feedback: UserFeedback): Promise<VoiceEvent | null> {
    await this.init();
    const event = this.events.find((e) => e.id === eventId);
    if (!event) return null;
    event.feedback = feedback;
    await writeFile(EVENTS_FILE, JSON.stringify(this.events, null, 2));
    return event;
  }

  async addFalseNegative(sessionId?: string, note?: string): Promise<FalseNegativeEvent> {
    await this.init();
    const fn: FalseNegativeEvent = {
      id: randomUUID(),
      sessionId,
      timestamp: new Date().toISOString(),
      note,
    };
    this.falseNegatives.push(fn);
    await writeFile(FN_FILE, JSON.stringify(this.falseNegatives, null, 2));
    return fn;
  }

  async getAll(): Promise<VoiceEvent[]> {
    await this.init();
    return this.events;
  }

  async getRecent(limit = 50): Promise<VoiceEvent[]> {
    await this.init();
    return this.events.slice(-limit);
  }

  async getStats(): Promise<EventStats> {
    await this.init();
    const byCategory: Record<ReactionCategory, number> = {
      excitement: 0,
      frustration: 0,
      surprise: 0,
      victory: 0,
      defeat: 0,
      neutral: 0,
    };
    for (const event of this.events) {
      byCategory[event.category]++;
    }
    const lastEvent = this.events[this.events.length - 1];
    return {
      total: this.events.length,
      byCategory,
      lastEventTime: lastEvent?.timestamp ?? null,
    };
  }

  async getEvaluation(sessionId?: string): Promise<EvaluationMetrics> {
    await this.init();
    const events = sessionId
      ? this.events.filter((e) => e.sessionId === sessionId)
      : this.events;
    const fns = sessionId
      ? this.falseNegatives.filter((e) => e.sessionId === sessionId)
      : this.falseNegatives;

    const detectedEvents = events.length;
    const clippedEvents = events.filter((e) => e.clipSaved === true).length;
    const falsePositives = events.filter((e) => e.feedback === "false_positive").length;
    const useful = events.filter((e) => e.feedback === "useful").length;
    const falseNegatives = fns.length;

    // Precision = useful / (useful + false_positives)
    const totalJudged = useful + falsePositives;
    const precision = totalJudged > 0 ? useful / totalJudged : null;

    return {
      totalTranscripts: this.transcriptCount,
      detectedEvents,
      clippedEvents,
      ignoredEvents: this.ignoredCount,
      falsePositives,
      falseNegatives,
      useful,
      precision,
      sessionId: sessionId || null,
    };
  }
}

export const eventRepository = new EventRepository();

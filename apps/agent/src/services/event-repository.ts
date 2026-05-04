import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { VoiceEvent, ReactionCategory, EventStats } from "@likelion/shared";

const DATA_DIR = join(process.cwd(), "data");
const EVENTS_FILE = join(DATA_DIR, "events.json");

interface EventInput {
  transcript: string;
  timestamp: string;
  category: ReactionCategory;
  confidence: number;
  matchedKeywords: string[];
}

class EventRepository {
  private events: VoiceEvent[] = [];
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
    this.initialized = true;
  }

  async save(input: EventInput): Promise<VoiceEvent> {
    await this.init();
    const event: VoiceEvent = {
      id: randomUUID(),
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
}

export const eventRepository = new EventRepository();

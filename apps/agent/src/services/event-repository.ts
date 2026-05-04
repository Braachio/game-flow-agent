import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { VoiceEvent, ReactionCategory } from "@likelion/shared";

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

  async getAll(): Promise<VoiceEvent[]> {
    await this.init();
    return this.events;
  }

  async getRecent(limit = 50): Promise<VoiceEvent[]> {
    await this.init();
    return this.events.slice(-limit);
  }
}

export const eventRepository = new EventRepository();

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const DATA_DIR = join(process.cwd(), "data");
const CONFIG_FILE = join(DATA_DIR, "runtime-config.json");

export interface RuntimeConfig {
  /** Minimum confidence to accept an event (0-1) */
  confidenceThreshold: number;
  /** Cooldown between same-category events (ms) */
  cooldownMs: number;
  /** Duplicate detection window (ms) */
  duplicateWindowMs: number;
  /** Categories that trigger clip save */
  clipCategories: string[];
  /** Default replay buffer duration (seconds) */
  defaultClipDuration: number;
  /** Max replay buffer duration (seconds) */
  maxClipDuration: number;
  /** Flow tracker: sustained repeat threshold (count) */
  sustainedThreshold: number;
  /** Flow tracker: silence boost minimum seconds */
  silenceBoostMinSec: number;
}

const DEFAULTS: RuntimeConfig = {
  confidenceThreshold: 0.6,
  cooldownMs: 5000,
  duplicateWindowMs: 3000,
  clipCategories: ["excitement", "victory", "surprise"],
  defaultClipDuration: 15,
  maxClipDuration: 45,
  sustainedThreshold: 3,
  silenceBoostMinSec: 10,
};

class RuntimeConfigService {
  private config: RuntimeConfig = { ...DEFAULTS };
  private initialized = false;

  private async init() {
    if (this.initialized) return;
    try {
      await mkdir(DATA_DIR, { recursive: true });
      const data = await readFile(CONFIG_FILE, "utf-8");
      const saved = JSON.parse(data);
      this.config = { ...DEFAULTS, ...saved };
    } catch {
      this.config = { ...DEFAULTS };
    }
    this.initialized = true;
  }

  private async persist() {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(CONFIG_FILE, JSON.stringify(this.config, null, 2));
  }

  async get(): Promise<RuntimeConfig> {
    await this.init();
    return { ...this.config };
  }

  async update(partial: Partial<RuntimeConfig>): Promise<RuntimeConfig> {
    await this.init();

    // Validate
    if (partial.confidenceThreshold !== undefined) {
      partial.confidenceThreshold = Math.max(0, Math.min(1, partial.confidenceThreshold));
    }
    if (partial.cooldownMs !== undefined) {
      partial.cooldownMs = Math.max(0, Math.min(30000, partial.cooldownMs));
    }
    if (partial.duplicateWindowMs !== undefined) {
      partial.duplicateWindowMs = Math.max(0, Math.min(10000, partial.duplicateWindowMs));
    }
    if (partial.defaultClipDuration !== undefined) {
      partial.defaultClipDuration = Math.max(5, Math.min(60, partial.defaultClipDuration));
    }
    if (partial.maxClipDuration !== undefined) {
      partial.maxClipDuration = Math.max(10, Math.min(120, partial.maxClipDuration));
    }

    this.config = { ...this.config, ...partial };
    await this.persist();
    console.log(`[Config] Updated:`, JSON.stringify(partial));
    return { ...this.config };
  }

  async reset(): Promise<RuntimeConfig> {
    this.config = { ...DEFAULTS };
    await this.persist();
    console.log(`[Config] Reset to defaults`);
    return { ...this.config };
  }

  /** Synchronous getter for hot path (uses cached value) */
  getCached(): RuntimeConfig {
    return this.config;
  }
}

export const runtimeConfig = new RuntimeConfigService();

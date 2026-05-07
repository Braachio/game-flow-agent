import { exec } from "node:child_process";
import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { obsService } from "./obs.service.js";

const execAsync = promisify(exec);
const TEMP_DIR = join(process.cwd(), "data");

export interface ScreenContext {
  /** Raw OCR text extracted from screenshot */
  rawText?: string;
  /** Parsed game events from the screen */
  gameEvents: string[];
  /** Detected score/round info */
  scoreInfo?: string;
  /** Screenshot capture timestamp */
  capturedAt: string;
  /** Error if capture/OCR failed */
  error?: string;
}

/**
 * Captures a screenshot from OBS and extracts text via Tesseract OCR.
 * Returns game context that can be attached to voice events.
 *
 * Requires: tesseract CLI installed on the system.
 * Gracefully returns empty context if unavailable.
 */
export async function captureScreenContext(): Promise<ScreenContext> {
  const capturedAt = new Date().toISOString();

  if (!obsService.connected) {
    return { gameEvents: [], capturedAt, error: "OBS not connected" };
  }

  // 1. Capture screenshot from OBS
  let imageBase64: string;
  try {
    const result = await obsService.rawSocket.call(
      "GetSourceScreenshot",
      {
        sourceName: process.env.OBS_GAME_SOURCE || "Game Capture",
        imageFormat: "png",
        imageWidth: 1280,
        imageHeight: 720,
      }
    ) as unknown as { imageData: string };
    imageBase64 = result.imageData;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { gameEvents: [], capturedAt, error: `Screenshot failed: ${msg}` };
  }

  // 2. Save to temp file
  const imagePath = join(TEMP_DIR, "screen-capture.png");
  try {
    // imageData from OBS comes as "data:image/png;base64,..."
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    await writeFile(imagePath, Buffer.from(base64Data, "base64"));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { gameEvents: [], capturedAt, error: `Save screenshot failed: ${msg}` };
  }

  // 3. Run Tesseract OCR
  let rawText = "";
  try {
    const { stdout } = await execAsync(
      `tesseract "${imagePath}" stdout -l kor+eng --psm 11`,
      { timeout: 10_000 }
    );
    rawText = stdout.trim();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found") || msg.includes("ENOENT")) {
      return { gameEvents: [], capturedAt, error: "tesseract not installed" };
    }
    return { gameEvents: [], capturedAt, error: `OCR failed: ${msg}` };
  } finally {
    // Cleanup temp file
    try { await unlink(imagePath); } catch {}
  }

  // 4. Parse game context from OCR text
  const gameEvents = parseGameText(rawText);
  const scoreInfo = parseScoreInfo(rawText);

  console.log(`[ScreenContext] OCR extracted ${rawText.length} chars, ${gameEvents.length} game events`);

  return { rawText, gameEvents, scoreInfo, capturedAt };
}

/**
 * Parse common game UI patterns from OCR text.
 */
function parseGameText(text: string): string[] {
  const events: string[] = [];
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Kill patterns
    if (/kill|킬|처치|eliminated|knocked/i.test(line)) {
      events.push(`kill: ${line}`);
    }
    // Death patterns
    if (/died|death|사망|죽|knocked out/i.test(line)) {
      events.push(`death: ${line}`);
    }
    // Victory/round patterns
    if (/victory|승리|win|이김|chicken dinner|치킨/i.test(line)) {
      events.push(`victory: ${line}`);
    }
    // Round patterns
    if (/round|라운드|wave|웨이브/i.test(line)) {
      events.push(`round: ${line}`);
    }
  }

  return events;
}

/**
 * Extract score/round information from OCR text.
 */
function parseScoreInfo(text: string): string | undefined {
  // Common score patterns: "3:2", "Score: 15", "Round 3/5", "12 kills"
  const patterns = [
    /\b(\d{1,2})\s*[:vs]\s*(\d{1,2})\b/,
    /(?:score|점수)[:\s]*(\d+)/i,
    /(?:round|라운드)[:\s]*(\d+)/i,
    /(\d+)\s*(?:kills?|킬)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0];
  }

  return undefined;
}

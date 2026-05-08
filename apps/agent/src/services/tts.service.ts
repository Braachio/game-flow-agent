import { exec } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";

const execAsync = promisify(exec);
const TTS_DIR = join(process.cwd(), "data", "tts");
const VOICE = process.env.TTS_VOICE || "ko-KR-InJoonNeural";
const RATE = process.env.TTS_RATE || "+10%";

/**
 * Generate speech audio using Edge TTS (Microsoft).
 * Returns the filename of the generated audio.
 */
export async function generateSpeech(text: string): Promise<{ filename: string; error?: string }> {
  await mkdir(TTS_DIR, { recursive: true });

  const filename = `${randomUUID()}.mp3`;
  const filepath = join(TTS_DIR, filename);

  // Escape quotes in text
  const escaped = text.replace(/"/g, '\\"').replace(/'/g, "'");

  try {
    await execAsync(
      `edge-tts --voice "${VOICE}" --rate="${RATE}" --text "${escaped}" --write-media "${filepath}"`,
      { timeout: 10_000 }
    );
    return { filename };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[TTS] Edge TTS failed: ${msg}`);
    return { filename: "", error: msg };
  }
}

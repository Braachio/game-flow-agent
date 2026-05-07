import { exec } from "node:child_process";
import { writeFile, stat } from "node:fs/promises";
import { join, basename } from "node:path";
import { promisify } from "node:util";
import type { VoiceEvent } from "@likelion/shared";

const execAsync = promisify(exec);

export interface HighlightClip {
  event: VoiceEvent;
  score: number;
  reason: string;
}

export interface ReelResult {
  outputPath?: string;
  clips: HighlightClip[];
  error?: string;
}

/**
 * Score events for highlight importance.
 * Higher score = more worthy of being in the reel.
 */
function scoreEvent(event: VoiceEvent): { score: number; reason: string } {
  let score = 0;
  const reasons: string[] = [];

  // Base: must have a clip
  if (!event.clipSaved) return { score: 0, reason: "no clip" };

  // Confidence
  score += event.confidence * 2;
  reasons.push(`conf ${Math.round(event.confidence * 100)}%`);

  // Category bonus
  if (event.category === "victory") { score += 1.5; reasons.push("victory"); }
  else if (event.category === "excitement") { score += 1.0; reasons.push("excitement"); }
  else if (event.category === "surprise") { score += 0.8; reasons.push("surprise"); }

  // Flow metadata bonuses
  const meta = event.metadata as Record<string, unknown> | undefined;
  if (meta) {
    if (meta.isTurningPoint) { score += 1.5; reasons.push("turning point"); }
    if (typeof meta.silenceBoost === "number" && meta.silenceBoost > 0) {
      score += meta.silenceBoost * 2;
      reasons.push(`silence +${Math.round((meta.silenceBoost as number) * 100)}%`);
    }
    if (meta.phase === "peak") { score += 0.5; reasons.push("peak"); }
  }

  // Action reason bonus
  if (event.actionReason?.includes("dramatic reversal")) { score += 1.0; reasons.push("reversal"); }

  return { score, reason: reasons.join(", ") };
}

/**
 * Select top N clips from a session's events, ranked by importance.
 */
export function selectHighlights(events: VoiceEvent[], maxClips = 5): HighlightClip[] {
  const scored = events
    .map((event) => ({ event, ...scoreEvent(event) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxClips);

  // Re-sort by timestamp for chronological order in the reel
  scored.sort((a, b) =>
    new Date(a.event.timestamp).getTime() - new Date(b.event.timestamp).getTime()
  );

  return scored;
}

/**
 * Generate a highlight reel by concatenating clip files using ffmpeg.
 * Returns the output path or error.
 */
export async function generateReel(
  highlights: HighlightClip[],
  outputDir: string,
  sessionId: string,
): Promise<ReelResult> {
  if (highlights.length === 0) {
    return { clips: [], error: "No clips to concatenate" };
  }

  // Collect file paths
  const filePaths: string[] = [];
  for (const h of highlights) {
    const path = h.event.renamedFilePath || h.event.originalFilePath;
    if (!path) continue;
    try {
      await stat(path);
      filePaths.push(path);
    } catch {
      console.log(`[Highlight] Skipping missing file: ${path}`);
    }
  }

  if (filePaths.length === 0) {
    return { clips: highlights, error: "No clip files found on disk" };
  }

  // Write ffmpeg concat list
  const listContent = filePaths.map((p) => `file '${p}'`).join("\n");
  const listPath = join(outputDir, "highlight-list.txt");
  await writeFile(listPath, listContent);

  const outputFilename = `highlight_${sessionId}.mp4`;
  const outputPath = join(outputDir, outputFilename);

  try {
    // Check if ffmpeg is available
    await execAsync("ffmpeg -version", { timeout: 5000 });
  } catch {
    console.log("[Highlight] ffmpeg not available, generating list file only");
    return {
      clips: highlights,
      error: "ffmpeg not installed — concat list saved to highlight-list.txt",
    };
  }

  try {
    const cmd = `ffmpeg -y -f concat -safe 0 -i "${listPath}" -c copy "${outputPath}"`;
    console.log(`[Highlight] Running: ${cmd}`);
    await execAsync(cmd, { timeout: 60_000 });
    console.log(`[Highlight] Reel generated: ${outputPath}`);
    return { outputPath, clips: highlights };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Highlight] ffmpeg failed: ${msg}`);
    return { clips: highlights, error: msg };
  }
}

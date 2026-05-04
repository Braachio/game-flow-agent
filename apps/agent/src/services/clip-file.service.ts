import { readdir, rename, stat } from "node:fs/promises";
import { join, extname, basename } from "node:path";
import type { VoiceEvent } from "@likelion/shared";

const CLIP_EXTENSIONS = new Set([".mp4", ".mkv", ".mov"]);
const MAX_AGE_MS = 15_000;
const WAIT_MS = 1500;

export interface ClipFileResult {
  clipFilename?: string;
  originalFilePath?: string;
  renamedFilePath?: string;
  clipRenameError?: string;
}

function sanitizeTranscript(transcript: string): string {
  return transcript
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 30);
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function buildFilename(event: VoiceEvent, ext: string): string {
  const ts = formatTimestamp(event.timestamp);
  const safeTranscript = sanitizeTranscript(event.transcript);
  return `${ts}_${event.category}_${safeTranscript}${ext}`;
}

async function findNewestClip(dir: string): Promise<string | null> {
  const now = Date.now();
  let newest: { path: string; mtime: number } | null = null;

  try {
    const entries = await readdir(dir);
    for (const entry of entries) {
      const ext = extname(entry).toLowerCase();
      if (!CLIP_EXTENSIONS.has(ext)) continue;

      const fullPath = join(dir, entry);
      const fileStat = await stat(fullPath);
      const age = now - fileStat.mtimeMs;

      if (age > MAX_AGE_MS) continue;

      if (!newest || fileStat.mtimeMs > newest.mtime) {
        newest = { path: fullPath, mtime: fileStat.mtimeMs };
      }
    }
  } catch (err) {
    console.error(`[ClipFile] Error scanning directory: ${err}`);
    return null;
  }

  return newest?.path ?? null;
}

export async function renameClipForEvent(event: VoiceEvent): Promise<ClipFileResult> {
  const recordingDir = process.env.OBS_RECORDING_DIR;
  const renameEnabled = process.env.OBS_CLIP_RENAME_ENABLED !== "false";

  if (!recordingDir) {
    console.log("[ClipFile] OBS_RECORDING_DIR is not configured, skipping rename");
    return { clipRenameError: "OBS_RECORDING_DIR is not configured" };
  }

  if (!renameEnabled) {
    console.log("[ClipFile] Clip renaming disabled");
    return { clipRenameError: "OBS_CLIP_RENAME_ENABLED is false" };
  }

  console.log(`[ClipFile] Watching directory: ${recordingDir}`);

  // Wait for OBS to finish writing the file
  await new Promise((resolve) => setTimeout(resolve, WAIT_MS));

  const clipPath = await findNewestClip(recordingDir);

  if (!clipPath) {
    console.log("[ClipFile] Rename failed: no recent clip file found");
    return { clipRenameError: "No recent clip file found in recording directory" };
  }

  console.log(`[ClipFile] Newest clip found: ${clipPath}`);

  const ext = extname(clipPath).toLowerCase();
  const newFilename = buildFilename(event, ext);
  const newPath = join(recordingDir, newFilename);

  try {
    await rename(clipPath, newPath);
    console.log(`[ClipFile] Renamed clip: ${basename(clipPath)} → ${newFilename}`);
    return {
      clipFilename: newFilename,
      originalFilePath: clipPath,
      renamedFilePath: newPath,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[ClipFile] Rename failed: ${msg}`);
    return {
      originalFilePath: clipPath,
      clipRenameError: msg,
    };
  }
}

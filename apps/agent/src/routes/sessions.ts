import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyPluginAsync } from "fastify";
import { generateSessionId } from "@likelion/shared";
import type { SessionReport, SessionStartResponse } from "@likelion/shared";
import { sessionState } from "../services/session-state.js";
import { flowTracker } from "../services/flow-tracker.js";
import { eventRepository } from "../services/event-repository.js";
import { selectHighlights, generateReel } from "../services/highlight-reel.service.js";
import { llmSessionSummary } from "../services/llm.service.js";

const DATA_DIR = join(process.cwd(), "data");
const REPORTS_FILE = join(DATA_DIR, "session-reports.json");

async function loadReports(): Promise<SessionReport[]> {
  try {
    await mkdir(DATA_DIR, { recursive: true });
    const data = await readFile(REPORTS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveReports(reports: SessionReport[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(REPORTS_FILE, JSON.stringify(reports, null, 2));
}

const CATEGORY_LABELS: Record<string, string> = {
  excitement: "흥분",
  frustration: "짜증",
  surprise: "놀람",
  victory: "승리",
  defeat: "패배",
  neutral: "기타",
};

function buildReadme(report: SessionReport): string {
  const lines: string[] = [];

  lines.push(`Session: ${report.sessionId}`);
  lines.push(`Started: ${report.startedAt}`);
  lines.push(`Ended:   ${report.endedAt}`);
  lines.push("");
  lines.push(`Total Reactions: ${report.totalReactions}`);
  lines.push(`Clips Saved:     ${report.clipsSaved}`);
  lines.push("");

  lines.push("Category Breakdown:");
  for (const [cat, count] of Object.entries(report.byCategory)) {
    if (count > 0) {
      lines.push(`  ${CATEGORY_LABELS[cat] || cat}: ${count}`);
    }
  }
  lines.push("");

  lines.push("Interpretation:");
  lines.push(`  ${report.interpretation}`);
  lines.push("");

  if (report.clips && report.clips.length > 0) {
    lines.push("Clips:");
    for (const clip of report.clips) {
      lines.push(`  - ${clip.filename}  [${clip.category}] "${clip.transcript}"`);
    }
    lines.push("");
  }

  if (report.memo) {
    lines.push("Memo:");
    lines.push(`  ${report.memo}`);
    lines.push("");
  }

  return lines.join("\n");
}

export const sessionsRoute: FastifyPluginAsync = async (app) => {
  app.post("/sessions/start", async (): Promise<SessionStartResponse> => {
    const sessionId = generateSessionId();
    await sessionState.start(sessionId);
    flowTracker.reset();
    console.log(`[Session] Started: ${sessionId}`);
    return {
      sessionId,
      sessionFolderPath: sessionState.getFolderPath() || undefined,
    };
  });

  app.get("/sessions/reports", async (): Promise<SessionReport[]> => {
    return loadReports();
  });

  app.post<{ Body: SessionReport }>(
    "/sessions/reports",
    async (request): Promise<SessionReport> => {
      const report = request.body;
      const reports = await loadReports();
      reports.push(report);
      await saveReports(reports);
      console.log(
        `[Session] Report saved: ${report.sessionId} — ${report.totalReactions} reactions, ${report.clipsSaved} clips`
      );

      // Also save report + README inside session folder if available
      if (report.sessionFolderPath) {
        try {
          const folderReportPath = join(report.sessionFolderPath, "session-report.json");
          await writeFile(folderReportPath, JSON.stringify(report, null, 2));
          console.log(`[Session] Report also saved to: ${folderReportPath}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[Session] Failed to save report to session folder: ${msg}`);
        }

        try {
          const readmePath = join(report.sessionFolderPath, "README.txt");
          await writeFile(readmePath, buildReadme(report));
          console.log(`[Session] README.txt saved to: ${readmePath}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[Session] Failed to save README.txt: ${msg}`);
        }
      }

      return report;
    }
  );

  app.post<{ Body: { sessionId: string; maxClips?: number } }>(
    "/sessions/highlight",
    async (request) => {
      const { sessionId, maxClips } = request.body;
      if (!sessionId) throw new Error("sessionId is required");

      const events = await eventRepository.getBySession(sessionId);
      const highlights = selectHighlights(events, maxClips || 5);

      if (highlights.length === 0) {
        return { clips: [], error: "No clipped events found for this session" };
      }

      // Determine output directory
      const report = (await loadReports()).find((r) => r.sessionId === sessionId);
      const outputDir = report?.sessionFolderPath || process.env.OBS_RECORDING_DIR || join(process.cwd(), "data");

      const result = await generateReel(highlights, outputDir, sessionId);

      console.log(`[Highlight] Session ${sessionId}: ${highlights.length} clips selected, reel: ${result.outputPath || "not generated"}`);

      return {
        clips: result.clips.map((c) => ({
          filename: c.event.clipFilename,
          path: c.event.renamedFilePath,
          category: c.event.category,
          transcript: c.event.transcript,
          score: Math.round(c.score * 100) / 100,
          reason: c.reason,
        })),
        outputPath: result.outputPath,
        error: result.error,
      };
    }
  );

  app.post<{ Body: { sessionId: string } }>(
    "/sessions/ai-summary",
    async (request) => {
      const { sessionId } = request.body;
      if (!sessionId) throw new Error("sessionId is required");

      const events = await eventRepository.getBySession(sessionId);
      if (events.length === 0) {
        return { summary: "", error: "No events found" };
      }

      const report = (await loadReports()).find((r) => r.sessionId === sessionId);
      const startTime = new Date(events[0].timestamp).getTime();
      const endTime = new Date(events[events.length - 1].timestamp).getTime();

      const summary = await llmSessionSummary({
        totalReactions: events.length,
        clipsSaved: events.filter((e) => e.clipSaved).length,
        durationSec: (endTime - startTime) / 1000,
        byCategory: report?.byCategory || {} as Record<string, number>,
        events: events.map((e) => ({
          category: e.category,
          transcript: e.transcript,
          timestamp: e.timestamp,
          action: e.action,
        })),
      });

      console.log(`[LLM] Session summary generated for ${sessionId}`);
      return { summary };
    }
  );
};

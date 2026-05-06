import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyPluginAsync } from "fastify";
import { generateSessionId } from "@likelion/shared";
import type { SessionReport, SessionStartResponse } from "@likelion/shared";
import { sessionState } from "../services/session-state.js";

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

export const sessionsRoute: FastifyPluginAsync = async (app) => {
  app.post("/sessions/start", async (): Promise<SessionStartResponse> => {
    const sessionId = generateSessionId();
    await sessionState.start(sessionId);
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

      // Also save report inside session folder if available
      if (report.sessionFolderPath) {
        try {
          const folderReportPath = join(report.sessionFolderPath, "session-report.json");
          await writeFile(folderReportPath, JSON.stringify(report, null, 2));
          console.log(`[Session] Report also saved to: ${folderReportPath}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[Session] Failed to save report to session folder: ${msg}`);
        }
      }

      return report;
    }
  );
};

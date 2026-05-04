import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyPluginAsync } from "fastify";
import type { SessionReport } from "@likelion/shared";

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
      return report;
    }
  );
};

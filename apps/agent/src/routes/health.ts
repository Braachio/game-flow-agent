import type { FastifyPluginAsync } from "fastify";
import type { HealthResponse } from "@likelion/shared";

const startTime = Date.now();

export const healthRoute: FastifyPluginAsync = async (app) => {
  app.get("/health", async (): Promise<HealthResponse> => {
    return {
      status: "ok",
      uptime: Math.floor((Date.now() - startTime) / 1000),
      version: "0.1.0",
    };
  });
};

import type { FastifyPluginAsync } from "fastify";
import type { HealthResponse } from "@likelion/shared";
import { isLLMAvailable } from "../services/llm.service.js";

const startTime = Date.now();

export const healthRoute: FastifyPluginAsync = async (app) => {
  app.get("/health", async (): Promise<HealthResponse> => {
    return {
      status: "ok",
      uptime: Math.floor((Date.now() - startTime) / 1000),
      version: "0.2.0",
    };
  });

  app.get("/health/llm", async () => {
    const available = await isLLMAvailable();
    return {
      available,
      model: process.env.LLM_MODEL || "gemma4:e2b",
      baseUrl: process.env.LLM_BASE_URL || "http://localhost:11434/v1",
    };
  });
};

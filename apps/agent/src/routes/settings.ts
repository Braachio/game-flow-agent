import type { FastifyPluginAsync } from "fastify";
import { runtimeConfig, type RuntimeConfig } from "../services/runtime-config.js";

export const settingsRoute: FastifyPluginAsync = async (app) => {
  app.get("/settings", async (): Promise<RuntimeConfig> => {
    return runtimeConfig.get();
  });

  app.patch<{ Body: Partial<RuntimeConfig> }>(
    "/settings",
    async (request): Promise<RuntimeConfig> => {
      return runtimeConfig.update(request.body);
    }
  );

  app.post("/settings/reset", async (): Promise<RuntimeConfig> => {
    return runtimeConfig.reset();
  });
};

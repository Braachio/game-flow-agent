import type { FastifyPluginAsync } from "fastify";
import type { ObsStatus } from "@likelion/shared";
import { obsService } from "../services/obs.service.js";
import { captureScreenContext } from "../services/screen-context.service.js";

export const obsRoute: FastifyPluginAsync = async (app) => {
  app.get("/obs/status", async (): Promise<ObsStatus> => {
    return obsService.getStatus();
  });

  app.post("/obs/connect", async (): Promise<ObsStatus> => {
    return obsService.connect();
  });

  app.post("/obs/disconnect", async (): Promise<ObsStatus> => {
    return obsService.disconnect();
  });

  app.post("/obs/replay/start", async (): Promise<ObsStatus> => {
    return obsService.startReplayBuffer();
  });

  app.post("/obs/replay/save", async (): Promise<ObsStatus> => {
    return obsService.saveReplayBuffer();
  });

  app.get("/obs/screen-context", async () => {
    return captureScreenContext();
  });
};

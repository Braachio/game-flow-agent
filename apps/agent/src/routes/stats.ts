import type { FastifyPluginAsync } from "fastify";
import type { EventStats } from "@likelion/shared";
import { eventRepository } from "../services/event-repository.js";

export const statsRoute: FastifyPluginAsync = async (app) => {
  app.get("/events/stats", async (): Promise<EventStats> => {
    return eventRepository.getStats();
  });
};

import type { FastifyPluginAsync } from "fastify";
import type { EventStats, VoiceEvent } from "@likelion/shared";
import { eventRepository } from "../services/event-repository.js";

export const statsRoute: FastifyPluginAsync = async (app) => {
  app.get("/events/stats", async (): Promise<EventStats> => {
    return eventRepository.getStats();
  });

  app.get<{ Querystring: { sessionId: string } }>(
    "/events/by-session",
    async (request): Promise<VoiceEvent[]> => {
      const { sessionId } = request.query;
      if (!sessionId) return [];
      return eventRepository.getBySession(sessionId);
    }
  );
};

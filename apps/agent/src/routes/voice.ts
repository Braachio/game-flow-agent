import type { FastifyPluginAsync } from "fastify";
import type { VoiceEventRequest, VoiceEventResponse } from "@likelion/shared";
import { classify } from "../services/classifier.js";
import { eventRepository } from "../services/event-repository.js";
import { onVoiceEvent } from "../services/obs.service.js";

export const voiceRoute: FastifyPluginAsync = async (app) => {
  app.post<{ Body: VoiceEventRequest }>(
    "/events/voice",
    async (request, reply): Promise<VoiceEventResponse> => {
      const { transcript, timestamp } = request.body;

      if (!transcript || typeof transcript !== "string") {
        reply.status(400);
        throw new Error("transcript is required");
      }

      const classification = classify(transcript);
      const event = await eventRepository.save({
        transcript,
        timestamp: timestamp || new Date().toISOString(),
        ...classification,
      });

      // Notify OBS service (stub)
      await onVoiceEvent(event);

      return { event };
    }
  );
};

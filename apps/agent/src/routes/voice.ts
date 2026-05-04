import type { FastifyPluginAsync } from "fastify";
import type {
  VoiceEventRequest,
  VoiceEventResponse,
  VoiceEventIgnoredResponse,
} from "@likelion/shared";
import { classify } from "../services/classifier.js";
import { eventRepository } from "../services/event-repository.js";
import { eventGuard } from "../services/event-guard.js";
import { obsService } from "../services/obs.service.js";

export const voiceRoute: FastifyPluginAsync = async (app) => {
  app.post<{ Body: VoiceEventRequest }>(
    "/events/voice",
    async (request, reply): Promise<VoiceEventResponse | VoiceEventIgnoredResponse> => {
      const { transcript, sessionId, timestamp } = request.body;

      if (!transcript || typeof transcript !== "string") {
        reply.status(400);
        throw new Error("transcript is required");
      }

      eventRepository.incrementTranscriptCount();

      const classification = classify(transcript);

      // Check guards (duplicate, cooldown, confidence)
      const guard = eventGuard.check(
        transcript,
        classification.category,
        classification.confidence
      );

      if (!guard.allowed) {
        eventRepository.incrementIgnoredCount();
        reply.status(200);
        return { ignored: true, reason: guard.reason! };
      }

      console.log(
        `[Voice] ACCEPTED: "${transcript}" → ${classification.category} (${(classification.confidence * 100).toFixed(0)}%)`
      );

      // Save event
      const event = await eventRepository.save({
        transcript,
        sessionId,
        timestamp: timestamp || new Date().toISOString(),
        ...classification,
      });

      // Attempt OBS clip for high-value categories
      const clipResult = await obsService.triggerClipForEvent(event);

      // Update event with clip result
      if (clipResult.obsTriggeredAt) {
        event.clipSaved = clipResult.clipSaved;
        event.obsTriggeredAt = clipResult.obsTriggeredAt;
        if (clipResult.obsError) {
          event.obsError = clipResult.obsError;
        }
        await eventRepository.update(event);
      }

      return { event };
    }
  );
};

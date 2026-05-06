import type { FastifyPluginAsync } from "fastify";
import type {
  VoiceEventRequest,
  VoiceEventResponse,
  VoiceEventIgnoredResponse,
  VoiceCommandResponse,
} from "@likelion/shared";
import { classify } from "../services/classifier.js";
import { eventRepository } from "../services/event-repository.js";
import { eventGuard } from "../services/event-guard.js";
import { obsService } from "../services/obs.service.js";
import { renameClipForEvent } from "../services/clip-file.service.js";
import { detectIntent } from "../services/intent-detector.js";
import { sessionState } from "../services/session-state.js";

export const voiceRoute: FastifyPluginAsync = async (app) => {
  app.post<{ Body: VoiceEventRequest }>(
    "/events/voice",
    async (request, reply): Promise<VoiceEventResponse | VoiceEventIgnoredResponse | VoiceCommandResponse> => {
      const { transcript, sessionId, timestamp } = request.body;

      if (!transcript || typeof transcript !== "string") {
        reply.status(400);
        throw new Error("transcript is required");
      }

      // Check for voice command intents before classification
      const intentResult = detectIntent(transcript);
      if (intentResult.detected && intentResult.intent) {
        if (intentResult.intent === "START_SESSION" && sessionState.isActive()) {
          console.log(`[VoiceCommand] Ignored (session already active)`);
          reply.status(200);
          return { ignored: true, reason: "low_confidence" };
        }
        if (intentResult.intent === "END_SESSION" && !sessionState.isActive()) {
          console.log(`[VoiceCommand] Ignored (no active session)`);
          reply.status(200);
          return { ignored: true, reason: "low_confidence" };
        }

        if (intentResult.intent === "START_SESSION") {
          const newSessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          sessionState.start(newSessionId);
          console.log(`[VoiceCommand] Session started`);
        } else {
          sessionState.end();
          console.log(`[VoiceCommand] Session ended`);
        }

        reply.status(200);
        return { command: true, intent: intentResult.intent, transcript };
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

        // If clip was saved, attempt to rename the file
        if (clipResult.clipSaved) {
          const fileResult = await renameClipForEvent(event);
          if (fileResult.clipFilename) {
            event.clipFilename = fileResult.clipFilename;
          }
          if (fileResult.originalFilePath) {
            event.originalFilePath = fileResult.originalFilePath;
          }
          if (fileResult.renamedFilePath) {
            event.renamedFilePath = fileResult.renamedFilePath;
          }
          if (fileResult.clipRenameError) {
            event.clipRenameError = fileResult.clipRenameError;
          }
        }

        await eventRepository.update(event);
      }

      return { event };
    }
  );
};

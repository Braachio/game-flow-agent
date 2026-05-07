import type { FastifyPluginAsync } from "fastify";
import { generateSessionId } from "@likelion/shared";
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
import { decideAction } from "../services/action-decision.service.js";
import { flowTracker } from "../services/flow-tracker.js";
import { eventBus } from "../services/event-bus.js";
import { captureScreenContext } from "../services/screen-context.service.js";
import { llmClassify, llmClipTitle, isLLMAvailable } from "../services/llm.service.js";
import { generateCommentary, generateSessionEndCommentary } from "../services/agent-commentary.service.js";

export const voiceRoute: FastifyPluginAsync = async (app) => {
  app.post<{ Body: VoiceEventRequest }>(
    "/events/voice",
    async (request, reply): Promise<VoiceEventResponse | VoiceEventIgnoredResponse | VoiceCommandResponse> => {
      const { transcript, sessionId, timestamp } = request.body;

      if (!transcript || typeof transcript !== "string") {
        reply.status(400);
        throw new Error("transcript is required");
      }

      console.log(`[Voice] Received: "${transcript}"`);

      // Detect voice command intent
      const intentResult = detectIntent(transcript);

      // Classify transcript
      eventRepository.incrementTranscriptCount();
      const classification = classify(transcript);

      // If intent detected, skip normal classification flow
      if (intentResult.detected && intentResult.intent) {
        const decision = decideAction({
          transcript,
          intent: intentResult.intent,
          category: classification.category,
          confidence: intentResult.confidence,
          sessionActive: sessionState.isActive(),
        });

        console.log(`[ActionDecision] action=${decision.action} reason=${decision.actionReason}`);

        if (decision.action === "START_SESSION") {
          const newSessionId = sessionId || generateSessionId();
          await sessionState.start(newSessionId);
          flowTracker.reset();
          console.log(`[VoiceCommand] Session started: ${newSessionId}`);
          eventBus.emit({ type: "session_start", payload: { sessionId: newSessionId } });
          reply.status(200);
          return { command: true, intent: intentResult.intent, transcript, sessionId: newSessionId };
        }
        if (decision.action === "END_SESSION") {
          const endedSessionId = sessionState.getSessionId();
          sessionState.end();
          console.log(`[VoiceCommand] Session ended: ${endedSessionId}`);
          eventBus.emit({ type: "session_end", payload: { sessionId: endedSessionId || "" } });

          // End-of-session commentary
          if (endedSessionId) {
            const sessionEvents = await eventRepository.getBySession(endedSessionId);
            const clips = sessionEvents.filter((e) => e.clipSaved).length;
            generateSessionEndCommentary(sessionEvents.length, clips);
          }

          reply.status(200);
          return { command: true, intent: intentResult.intent, transcript, sessionId: endedSessionId || undefined };
        }
        // IGNORE for invalid session commands
        console.log(`[VoiceCommand] Ignored (${decision.actionReason})`);
        reply.status(200);
        return { ignored: true, reason: "low_confidence" };
      }

      // When no session is active, ignore all non-command transcripts
      if (!sessionState.isActive()) {
        console.log(`[Voice] Ignored: no active session, waiting for START_SESSION command`);
        reply.status(200);
        return { ignored: true, reason: "low_confidence" };
      }

      // LLM-assisted classification for ambiguous cases
      if (classification.confidence > 0.3 && classification.confidence < 0.6 && classification.category !== "neutral") {
        const llmResult = await llmClassify(transcript, {
          currentCategory: classification.category,
          confidence: classification.confidence,
        });
        if (llmResult && llmResult.category !== "neutral") {
          console.log(`[LLM] Reclassified: "${transcript}" → ${llmResult.category} (was ${classification.category}). Reason: ${llmResult.reason}`);
          classification.category = llmResult.category as typeof classification.category;
          classification.confidence = 0.7; // LLM-boosted confidence
          classification.matchedKeywords = [...classification.matchedKeywords, `llm:${llmResult.reason}`];
        }
      }

      // Action decision for non-command transcripts
      const decision = decideAction({
        transcript,
        category: classification.category,
        confidence: classification.confidence,
        sessionActive: sessionState.isActive(),
      });

      console.log(`[ActionDecision] action=${decision.action} reason=${decision.actionReason}`);

      if (decision.action === "IGNORE") {
        eventRepository.incrementIgnoredCount();
        reply.status(200);
        return { ignored: true, reason: "low_confidence" };
      }

      // Check guards (duplicate, cooldown)
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

      // Save event with action metadata
      const event = await eventRepository.save({
        transcript,
        sessionId,
        timestamp: timestamp || new Date().toISOString(),
        ...classification,
        action: decision.action,
        actionReason: decision.actionReason,
        metadata: decision.flowContext ? {
          phase: decision.flowContext.phase,
          silenceSec: Math.round(decision.flowContext.silenceSec),
          silenceBoost: decision.flowContext.silenceBoost,
          isTurningPoint: decision.flowContext.isTurningPoint,
        } : undefined,
      });

      // Only trigger OBS clip when action is SAVE_CLIP
      if (decision.action === "SAVE_CLIP") {
        const clipResult = await obsService.triggerClipForEvent(event, decision.flowContext);

        if (clipResult.obsTriggeredAt) {
          event.clipSaved = clipResult.clipSaved;
          event.obsTriggeredAt = clipResult.obsTriggeredAt;
          if (clipResult.obsError) {
            event.obsError = clipResult.obsError;
          }

          if (clipResult.clipSaved) {
            const fileResult = await renameClipForEvent(event, sessionState.getFolderPath());
            if (fileResult.clipFilename) {
              event.clipFilename = fileResult.clipFilename;
            }
            if (fileResult.originalFilePath) {
              event.originalFilePath = fileResult.originalFilePath;
            }
            if (fileResult.renamedFilePath) {
              event.renamedFilePath = fileResult.renamedFilePath;
            }
            if (fileResult.sessionFolderPath) {
              event.sessionFolderPath = fileResult.sessionFolderPath;
            }
            if (fileResult.clipRenameError) {
              event.clipRenameError = fileResult.clipRenameError;
            }
            if (fileResult.clipMoveError) {
              event.clipMoveError = fileResult.clipMoveError;
            }
          }

          // Capture screen context for additional metadata
          const screenCtx = await captureScreenContext();
          if (screenCtx.gameEvents.length > 0 || screenCtx.scoreInfo) {
            event.metadata = {
              ...event.metadata as Record<string, unknown>,
              screenGameEvents: screenCtx.gameEvents,
              screenScore: screenCtx.scoreInfo,
            };
          }

          // LLM clip title (non-blocking, best-effort)
          const meta = event.metadata as Record<string, unknown> | undefined;
          llmClipTitle({
            transcript: event.transcript,
            category: event.category,
            isTurningPoint: !!meta?.isTurningPoint,
            phase: meta?.phase as string,
          }).then((title) => {
            if (title) {
              event.metadata = { ...event.metadata as Record<string, unknown>, clipTitle: title };
              eventRepository.update(event);
              console.log(`[LLM] Clip title: "${title}" for "${event.transcript}"`);
            }
          });

          await eventRepository.update(event);
        }
      }

      // Record in flow tracker
      flowTracker.record(event.category, event.confidence, decision.action === "SAVE_CLIP" && !!event.clipSaved);

      eventBus.emit({ type: "voice_event", payload: event });

      // Agent commentary (non-blocking)
      generateCommentary({
        event,
        flowContext: decision.flowContext,
        clipSaved: !!event.clipSaved,
        action: decision.action,
      });

      return { event };
    }
  );
};

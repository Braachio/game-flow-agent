import type { FastifyPluginAsync } from "fastify";
import { generateSessionId } from "@likelion/shared";
import type {
  VoiceEventRequest,
  VoiceEventResponse,
  VoiceEventIgnoredResponse,
  VoiceCommandResponse,
  AgentAction,
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
import { llmClassify, llmClipTitle, llmShouldAsk, llmDecideAfterResponse, isLLMAvailable } from "../services/llm.service.js";
import { generateCommentary, generateSessionEndCommentary } from "../services/agent-commentary.service.js";
import { conversationManager } from "../services/conversation.service.js";

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

      // If agent is waiting for user response in a conversation, route here
      if (conversationManager.isActive()) {
        const convCtx = conversationManager.receiveUserResponse(transcript);
        if (convCtx) {
          // LLM decides based on the full conversation
          const decision = await llmDecideAfterResponse({
            messages: convCtx.messages,
            originalTranscript: convCtx.triggerEvent.transcript,
            category: convCtx.triggerEvent.category,
          });

          console.log(`[Conversation] LLM decision: ${decision.action} — "${decision.response}"`);
          conversationManager.conclude(decision.response, decision.action as AgentAction);

          // Execute the action — force=true bypasses category filter (user confirmed)
          if (decision.action === "SAVE_CLIP" && convCtx.triggerEvent) {
            const event = convCtx.triggerEvent;
            event.action = "SAVE_CLIP";
            event.actionReason = `conversation: ${decision.response}`;
            const clipResult = await obsService.triggerClipForEvent(event, convCtx.triggerFlow, true);
            if (clipResult.obsTriggeredAt) {
              event.clipSaved = clipResult.clipSaved;
              event.obsTriggeredAt = clipResult.obsTriggeredAt;
              if (clipResult.clipSaved) {
                const fileResult = await renameClipForEvent(event, sessionState.getFolderPath());
                if (fileResult.clipFilename) event.clipFilename = fileResult.clipFilename;
                if (fileResult.renamedFilePath) event.renamedFilePath = fileResult.renamedFilePath;
              }
              await eventRepository.update(event);
            }
          }

          reply.status(200);
          return { ignored: true, reason: "low_confidence" as const };
        }
      }

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
      if (classification.confidence > 0.1 && classification.confidence < 0.5 && classification.category !== "neutral") {
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

      // NOTE: OBS clip is NOT saved here anymore.
      // Clips are only saved after user confirms via conversation.

      // Record in flow tracker
      // Record based on action decision, not OBS result (suppression should work even without OBS)
      flowTracker.record(event.category, event.confidence, decision.action === "SAVE_CLIP");

      eventBus.emit({ type: "voice_event", payload: event });

      // Agent always asks user before saving — LLM generates contextual question
      (async () => {
        if (decision.action === "IGNORE") return;

        const shouldAsk = await llmShouldAsk({
          transcript: event.transcript,
          category: event.category,
          confidence: event.confidence,
          isTurningPoint: decision.flowContext?.isTurningPoint,
        });

        if (shouldAsk.question) {
          conversationManager.startConversation(event, shouldAsk.question, decision.flowContext || undefined);
        }
      })();

      return { event };
    }
  );
};

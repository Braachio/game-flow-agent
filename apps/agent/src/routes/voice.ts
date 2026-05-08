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
import { llmReact, llmDecideAfterResponse, recordAction, resetSessionMemory } from "../services/llm.service.js";
import { generateCommentary, generateSessionEndCommentary } from "../services/agent-commentary.service.js";
import { handleDirectCommand } from "../services/agent-direct.service.js";
import { detectWakeWord, isWaitingForCommand, startWaiting, consumeWaiting } from "../services/wake-word.service.js";
import { conversationManager } from "../services/conversation.service.js";

export const voiceRoute: FastifyPluginAsync = async (app) => {
  app.post<{ Body: VoiceEventRequest }>(
    "/events/voice",
    async (request, reply) => {
      const { transcript, sessionId, timestamp } = request.body;

      if (!transcript || typeof transcript !== "string") {
        reply.status(400);
        throw new Error("transcript is required");
      }

      console.log(`[Voice] Received: "${transcript}"`);

      // Wake word "자비스" → direct agent mode
      const wake = detectWakeWord(transcript);
      if (wake.hasWakeWord || isWaitingForCommand()) {
        const command = wake.hasWakeWord ? wake.command : consumeWaiting(transcript);

        // "자비스" alone with no command → wait for next utterance
        if (!command && wake.hasWakeWord) {
          console.log(`[Agent] Wake word only — waiting for command...`);
          startWaiting();
          reply.status(200);
          return { agentSpeech: "응?" };
        }

        console.log(`[Agent] Command: "${command}"`);
        const result = await handleDirectCommand(command, sessionId);
        reply.status(200);
        return {
          agentSpeech: result.speech,
          agentAction: result.action,
        };
      }

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
          recordAction(convCtx.triggerEvent.transcript, decision.action, decision.response);

          // Execute the action — fire and forget (don't block response)
          if (decision.action === "SAVE_CLIP" && convCtx.triggerEvent) {
            const event = convCtx.triggerEvent;
            event.action = "SAVE_CLIP";
            event.actionReason = `conversation: ${decision.response}`;
            (async () => {
              try {
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
              } catch (err) {
                console.error("[Conversation] Async clip save error:", err);
              }
            })();
          }

          reply.status(200);
          return { ignored: true, reason: "low_confidence" as const, agentSpeech: decision.response };
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
          resetSessionMemory();
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

      // LLM classification assist removed — llmReact handles all decisions

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

      // LLM decides action + speech in one call
      const reaction = await llmReact({
        transcript: event.transcript,
        category: event.category,
        confidence: event.confidence,
        isTurningPoint: decision.flowContext?.isTurningPoint,
      });

      console.log(`[Agent] ${reaction.action}: "${reaction.speech}"`);

      if (reaction.action === "SAVE") {
        recordAction(event.transcript, "SAVE_CLIP", reaction.speech);
        // OBS save + file rename — fire and forget (don't block response)
        (async () => {
          try {
            const clipResult = await obsService.triggerClipForEvent(event, decision.flowContext, true);
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
          } catch (err) {
            console.error("[Voice] Async clip save error:", err);
          }
        })();
      } else if (reaction.action === "ASK") {
        conversationManager.startConversation(event, reaction.speech, decision.flowContext || undefined);
      }

      // Return immediately after LLM — OBS/TTS happen in background
      return { event, agentSpeech: reaction.speech };
    }
  );
};

import type { VoiceEvent } from "@likelion/shared";
import type { FlowContext } from "./flow-tracker.js";
import { llmCommentary, isLLMAvailable } from "./llm.service.js";
import { eventBus } from "./event-bus.js";

/**
 * Agent commentary — LLM-driven with template fallback.
 * Decides when to speak and generates contextual comments.
 */

interface CommentaryContext {
  event: VoiceEvent;
  flowContext?: FlowContext | null;
  clipSaved: boolean;
  action: string;
  recentTranscripts?: string[];
}

// Cooldown to avoid talking too much
let lastSpeakTime = 0;
const SPEAK_COOLDOWN_MS = 8000;

// Track recent transcripts for LLM context
const recentTranscripts: string[] = [];
const MAX_RECENT = 5;

function recordTranscript(transcript: string) {
  recentTranscripts.push(transcript);
  if (recentTranscripts.length > MAX_RECENT) recentTranscripts.shift();
}

/**
 * Decide whether to speak, then generate a comment via LLM or fallback.
 */
export async function generateCommentary(ctx: CommentaryContext): Promise<void> {
  const now = Date.now();
  recordTranscript(ctx.event.transcript);

  if (now - lastSpeakTime < SPEAK_COOLDOWN_MS) return;

  // Decide if this moment warrants commentary
  if (!shouldSpeak(ctx)) return;

  lastSpeakTime = now;

  // Try LLM first, fall back to templates
  const message = await generateLLMComment(ctx) || generateFallbackComment(ctx);
  if (!message) return;

  eventBus.emit({ type: "agent_speak", payload: { text: message, eventId: ctx.event.id } });
  console.log(`[AgentVoice] "${message}"`);
}

function shouldSpeak(ctx: CommentaryContext): boolean {
  const { flowContext, clipSaved, action } = ctx;

  // Always speak on turning points
  if (flowContext?.isTurningPoint) return true;

  // Speak on clips saved after silence
  if (clipSaved && flowContext && flowContext.silenceBoost > 0.1) return true;

  // Speak on clip saves (70% of the time)
  if (clipSaved) return Math.random() < 0.7;

  // Speak on sustained suppression (first time only)
  if (action === "TAG_EVENT" && flowContext?.categoryRepeatCount === 2) return true;

  return false;
}

async function generateLLMComment(ctx: CommentaryContext): Promise<string | null> {
  try {
    const result = await llmCommentary({
      transcript: ctx.event.transcript,
      category: ctx.event.category,
      action: ctx.action,
      isTurningPoint: ctx.flowContext?.isTurningPoint,
      silenceSec: ctx.flowContext?.silenceSec,
      phase: ctx.flowContext?.phase,
      categoryRepeatCount: ctx.flowContext?.categoryRepeatCount,
      recentTranscripts,
    });

    if (result && result.length > 0 && result.length < 50) {
      return result;
    }
    return null;
  } catch {
    return null;
  }
}

function generateFallbackComment(ctx: CommentaryContext): string | null {
  const { event, flowContext, clipSaved, action } = ctx;

  if (flowContext?.isTurningPoint) {
    if (event.category === "victory" || event.category === "excitement") {
      return "역전이네! 클립 저장했어.";
    }
    return "흐름이 바뀌었어.";
  }

  if (clipSaved && flowContext && flowContext.silenceBoost > 0.1) {
    return "좋은 순간이야. 클립 저장함.";
  }

  if (clipSaved) {
    return "클립 저장.";
  }

  if (action === "TAG_EVENT" && flowContext?.categoryRepeatCount && flowContext.categoryRepeatCount >= 2) {
    return "비슷한 반응 계속돼서 클립은 스킵할게.";
  }

  return null;
}

/**
 * Generate end-of-session commentary.
 */
export function generateSessionEndCommentary(totalReactions: number, clipsSaved: number): void {
  let message: string;

  if (clipsSaved === 0) {
    message = "세션 종료. 이번엔 클립 없이 마무리했어.";
  } else if (clipsSaved >= 5) {
    message = `세션 종료! 하이라이트가 ${clipsSaved}개나 됐어. 좋은 경기였어.`;
  } else {
    message = `세션 종료. ${clipsSaved}개 클립 저장됐어.`;
  }

  eventBus.emit({ type: "agent_speak", payload: { text: message } });
  console.log(`[AgentVoice] "${message}"`);
}

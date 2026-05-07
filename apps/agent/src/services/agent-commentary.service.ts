import type { VoiceEvent } from "@likelion/shared";
import type { FlowContext } from "./flow-tracker.js";
import { llmClipTitle } from "./llm.service.js";
import { eventBus } from "./event-bus.js";

/**
 * Agent commentary — decides when and what to say to the user.
 * Sends speech events via SSE for the frontend to vocalize.
 */

interface CommentaryContext {
  event: VoiceEvent;
  flowContext?: FlowContext | null;
  clipSaved: boolean;
  action: string;
}

// Cooldown to avoid talking too much
let lastSpeakTime = 0;
const SPEAK_COOLDOWN_MS = 8000;

/**
 * Evaluate whether the agent should comment, and if so, what to say.
 */
export async function generateCommentary(ctx: CommentaryContext): Promise<void> {
  const now = Date.now();
  if (now - lastSpeakTime < SPEAK_COOLDOWN_MS) return;

  const message = await buildMessage(ctx);
  if (!message) return;

  lastSpeakTime = now;
  eventBus.emit({ type: "agent_speak", payload: { text: message, eventId: ctx.event.id } });
  console.log(`[AgentVoice] "${message}"`);
}

async function buildMessage(ctx: CommentaryContext): Promise<string | null> {
  const { event, flowContext, clipSaved, action } = ctx;

  // Turning point — always comment
  if (flowContext?.isTurningPoint) {
    if (event.category === "victory" || event.category === "excitement") {
      return "역전이네! 클립 저장했어.";
    }
    if (event.category === "defeat" || event.category === "frustration") {
      return "흐름이 바뀌었어. 잠깐 쉬어가자.";
    }
  }

  // Clip saved after silence — the moment matters
  if (clipSaved && flowContext && flowContext.silenceBoost > 0.1) {
    return "좋은 순간이야. 클립 저장함.";
  }

  // Clip saved normally — brief acknowledgment (only sometimes)
  if (clipSaved && Math.random() < 0.4) {
    return "클립 저장.";
  }

  // Sustained suppression — let user know
  if (action === "TAG_EVENT" && flowContext?.categoryRepeatCount && flowContext.categoryRepeatCount >= 2) {
    return "비슷한 반응이 계속돼서 클립은 스킵할게.";
  }

  return null;
}

/**
 * Generate an end-of-session commentary.
 */
export function generateSessionEndCommentary(totalReactions: number, clipsSaved: number): void {
  let message: string;

  if (clipsSaved === 0) {
    message = "세션 종료. 이번엔 클립 없이 마무리했���.";
  } else if (clipsSaved >= 5) {
    message = `세션 종료! 하이라이트가 ${clipsSaved}개나 됐어. 좋은 경기였어.`;
  } else {
    message = `세션 종료. ${clipsSaved}개 클립 저장됐어.`;
  }

  eventBus.emit({ type: "agent_speak", payload: { text: message } });
  console.log(`[AgentVoice] "${message}"`);
}

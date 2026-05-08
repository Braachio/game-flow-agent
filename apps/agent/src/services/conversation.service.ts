import type { VoiceEvent, AgentAction } from "@likelion/shared";
import type { FlowContext } from "./flow-tracker.js";
import { eventBus } from "./event-bus.js";

/**
 * Conversation state machine for the agent.
 * Handles multi-turn dialogue with the user during gameplay.
 */

export type ConversationState = "idle" | "asking" | "deciding";

interface ConversationContext {
  state: ConversationState;
  /** The original trigger event that started the conversation */
  triggerEvent?: VoiceEvent;
  /** Flow context at the time of trigger */
  triggerFlow?: FlowContext;
  /** Accumulated dialogue messages */
  messages: Array<{ role: "agent" | "user"; text: string }>;
  /** Timestamp when conversation started */
  startedAt: number;
  /** Timeout handle */
  timeout?: ReturnType<typeof setTimeout>;
}

const CONVERSATION_TIMEOUT_MS = 15_000; // 15s to respond before agent gives up

class ConversationManager {
  private ctx: ConversationContext = {
    state: "idle",
    messages: [],
    startedAt: 0,
  };

  getState(): ConversationState {
    return this.ctx.state;
  }

  isActive(): boolean {
    return this.ctx.state !== "idle";
  }

  /**
   * Start a conversation — agent asks the user something.
   */
  startConversation(triggerEvent: VoiceEvent, agentQuestion: string, flowContext?: FlowContext): void {
    this.reset();

    this.ctx = {
      state: "asking",
      triggerEvent,
      triggerFlow: flowContext,
      messages: [{ role: "agent", text: agentQuestion }],
      startedAt: Date.now(),
    };

    // Speak the question
    eventBus.emit({ type: "agent_speak", payload: { text: agentQuestion, eventId: triggerEvent.id } });
    console.log(`[Conversation] Agent asks: "${agentQuestion}"`);

    // Timeout: if user doesn't respond, fall back
    this.ctx.timeout = setTimeout(() => {
      if (this.ctx.state === "asking") {
        console.log("[Conversation] Timeout — no response, falling back");
        this.handleTimeout();
      }
    }, CONVERSATION_TIMEOUT_MS);
  }

  /**
   * Receive user's response to the agent's question.
   * Returns the full context for LLM to make a decision.
   */
  receiveUserResponse(transcript: string): {
    triggerEvent: VoiceEvent;
    triggerFlow?: FlowContext;
    messages: Array<{ role: "agent" | "user"; text: string }>;
  } | null {
    if (this.ctx.state !== "asking") return null;

    if (this.ctx.timeout) clearTimeout(this.ctx.timeout);

    this.ctx.messages.push({ role: "user", text: transcript });
    this.ctx.state = "deciding";

    console.log(`[Conversation] User responds: "${transcript}"`);

    return {
      triggerEvent: this.ctx.triggerEvent!,
      triggerFlow: this.ctx.triggerFlow,
      messages: [...this.ctx.messages],
    };
  }

  /**
   * Agent makes a final response and takes action.
   */
  conclude(agentResponse: string, action: AgentAction): void {
    this.ctx.messages.push({ role: "agent", text: agentResponse });

    eventBus.emit({ type: "agent_speak", payload: { text: agentResponse } });
    console.log(`[Conversation] Agent concludes: "${agentResponse}" → ${action}`);

    this.reset();
  }

  private handleTimeout(): void {
    const msg = "괜찮아, 넘어갈게.";
    eventBus.emit({ type: "agent_speak", payload: { text: msg } });
    console.log(`[Conversation] Timeout — skipping`);
    this.reset();
  }

  reset(): void {
    if (this.ctx.timeout) clearTimeout(this.ctx.timeout);
    this.ctx = { state: "idle", messages: [], startedAt: 0 };
  }
}

export const conversationManager = new ConversationManager();

import { AGENT_SYSTEM_PROMPT, buildConversationContext } from "./agent-persona.js";
import { obsService } from "./obs.service.js";
import { sessionState } from "./session-state.js";
import { eventRepository } from "./event-repository.js";
import { flowTracker } from "./flow-tracker.js";

const LLM_BASE_URL = process.env.LLM_BASE_URL || "http://localhost:11434/v1";
const LLM_MODEL = process.env.LLM_MODEL || "gemma3:12b";
const LLM_TIMEOUT = 30_000;

interface DirectResult {
  speech: string;
  action?: "SAVE_CLIP" | "END_SESSION" | "NONE";
}

/**
 * Handle a direct command to the agent (wake word "자비스" detected).
 * LLM processes the command freely — can save clips, answer questions, chat.
 */
export async function handleDirectCommand(command: string, sessionId?: string): Promise<DirectResult> {
  // Build context
  const recentEvents = sessionId ? await eventRepository.getBySession(sessionId) : [];
  const lastEvents = recentEvents.slice(-5).map((e) => `[${e.category}] "${e.transcript}"`).join(", ");

  const prompt = `${AGENT_SYSTEM_PROMPT}

너의 이름은 "자비스"야. 스트리머가 너를 불렀어.

상황:
- 세션: ${sessionState.isActive() ? "진행 중" : "비활성"}
- OBS: ${obsService.connected ? "연결됨" : "연결 안 됨"}
- 최근 이벤트: ${lastEvents || "없음"}
- 저장된 클립: ${recentEvents.filter((e) => e.clipSaved).length}개

명령어 이해:
- "저장해", "클립", "저장" → 즉시 클립 저장
- "끝", "종료", "끝내자" → 세션 종료
- 그 외 → 자유 대화 (짧게 반말로)

응답 형식 (한 줄):
SAVE_CLIP 할말
END_SESSION 할말
NONE 할말

예시:
SAVE_CLIP 알겠어 저장!
NONE 뭐 도와줄까?
END_SESSION 알겠어 세션 끝낼게`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT);

    const res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: command || "불렀어" },
        ],
        temperature: 0.7,
        max_tokens: 48,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return { speech: "미안, 잘 못 알아들었어", action: "NONE" };
    }

    const data = await res.json();
    const text = (data.choices?.[0]?.message?.content || "").replace(/["""'''\n`]/g, "").trim();

    // Parse "ACTION speech" format
    const match = text.match(/^(SAVE_CLIP|END_SESSION|NONE)\s+(.+)/i);
    if (match) {
      const action = match[1].toUpperCase() as DirectResult["action"];
      const speech = match[2].trim().slice(0, 30);

      // Execute action
      if (action === "SAVE_CLIP" && obsService.connected) {
        try {
          await obsService.rawSocket.call("SaveReplayBuffer");
          console.log(`[Agent] Direct save: clip saved`);
        } catch {}
      }

      return { speech, action };
    }

    return { speech: text.slice(0, 30) || "응?", action: "NONE" };
  } catch {
    return { speech: "잠깐, 다시 말해줘", action: "NONE" };
  }
}

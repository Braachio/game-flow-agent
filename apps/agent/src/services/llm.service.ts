/**
 * Local LLM service — communicates with Gemma 4 E2B via OpenAI-compatible API.
 * Expected to run via Ollama, vLLM, or llama.cpp server.
 */

const LLM_BASE_URL = process.env.LLM_BASE_URL || "http://localhost:11434/v1";
const LLM_MODEL = process.env.LLM_MODEL || "gemma4:e2b";
const LLM_TIMEOUT = 30_000;

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface LLMResponse {
  text: string;
  error?: string;
}

async function chat(messages: ChatMessage[], options?: { temperature?: number; maxTokens?: number }): Promise<LLMResponse> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT);

    const res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages,
        temperature: options?.temperature ?? 0.3,
        max_tokens: options?.maxTokens ?? 512,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const err = await res.text();
      console.error(`[LLM] API error ${res.status}: ${err}`);
      return { text: "", error: `API error: ${res.status}` };
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim() || "";
    return { text };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("abort")) {
      console.error("[LLM] Request timed out");
      return { text: "", error: "timeout" };
    }
    console.error(`[LLM] Request failed: ${msg}`);
    return { text: "", error: msg };
  }
}

/**
 * Check if LLM is available.
 */
export async function isLLMAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${LLM_BASE_URL}/models`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Classify an ambiguous transcript with context.
 */
export async function llmClassify(transcript: string, context: {
  recentTranscripts?: string[];
  currentCategory?: string;
  confidence?: number;
}): Promise<{ category: string; reason: string } | null> {
  const recentContext = context.recentTranscripts?.length
    ? `최근 발화: ${context.recentTranscripts.slice(-3).map(t => `"${t}"`).join(", ")}`
    : "";

  const { text, error } = await chat([
    {
      role: "system",
      content: `너는 게임 스트리머의 음성 반응을 분류하는 AI다.
카테고리: excitement(흥분/긍정), frustration(짜증/화남), surprise(놀람), victory(승리), defeat(패배), neutral(일반대화)
JSON으로만 응답해. 형식: {"category": "...", "reason": "..."}`,
    },
    {
      role: "user",
      content: `발화: "${transcript}"
${recentContext}
규칙 기반 분류: ${context.currentCategory} (confidence: ${Math.round((context.confidence || 0) * 100)}%)

이 발화의 실제 카테고리와 이유를 판단해.`,
    },
  ], { temperature: 0.1, maxTokens: 128 });

  if (error || !text) return null;

  try {
    const parsed = JSON.parse(text);
    return { category: parsed.category, reason: parsed.reason };
  } catch {
    return null;
  }
}

/**
 * Generate a session interpretation/summary.
 */
export async function llmSessionSummary(sessionData: {
  totalReactions: number;
  clipsSaved: number;
  durationSec: number;
  byCategory: Record<string, number>;
  events: Array<{ category: string; transcript: string; timestamp: string; action?: string }>;
}): Promise<string> {
  const eventList = sessionData.events
    .slice(0, 20) // limit to avoid token overflow
    .map((e, i) => `${i + 1}. [${e.category}] "${e.transcript}" → ${e.action || "TAG"}`)
    .join("\n");

  const { text, error } = await chat([
    {
      role: "system",
      content: `너는 게임 스트리머의 세션을 분석하는 AI다. 한국어로 2-3문장으로 세션의 흐름과 하이라이트를 요약해. 감정의 흐름, 터닝포인트, 전체적인 분위기를 설명해.`,
    },
    {
      role: "user",
      content: `세션 정보:
- 길이: ${Math.round(sessionData.durationSec / 60)}분
- 총 반응: ${sessionData.totalReactions}회
- 클립 저장: ${sessionData.clipsSaved}개
- 카테고리: ${Object.entries(sessionData.byCategory).filter(([,v]) => v > 0).map(([k,v]) => `${k}(${v})`).join(", ")}

이벤트 목록:
${eventList}

이 세션을 분석해줘.`,
    },
  ], { temperature: 0.5, maxTokens: 256 });

  if (error || !text) return "";
  return text;
}

/**
 * Generate a descriptive clip title.
 */
export async function llmClipTitle(event: {
  transcript: string;
  category: string;
  isTurningPoint?: boolean;
  phase?: string;
}): Promise<string> {
  const { text, error } = await chat([
    {
      role: "system",
      content: `게임 클립에 짧은 제목을 붙여줘. 한국어, 10자 이내. 제목만 출력해.`,
    },
    {
      role: "user",
      content: `발화: "${event.transcript}"
카테고리: ${event.category}
${event.isTurningPoint ? "역전 순간" : ""}
${event.phase === "peak" ? "클라이맥스 구간" : ""}`,
    },
  ], { temperature: 0.7, maxTokens: 32 });

  if (error || !text) return "";
  return text.replace(/["""]/g, "").trim();
}

/**
 * Analyze feedback pattern and suggest improvements.
 */
export async function llmFeedbackAnalysis(feedbackData: {
  keyword: string;
  totalUseful: number;
  totalFP: number;
  exampleTranscripts: string[];
}): Promise<string> {
  const { text, error } = await chat([
    {
      role: "system",
      content: `키워드 피드백 데이터를 분석해서, 왜 오탐이 나는지 한 줄로 설명해.`,
    },
    {
      role: "user",
      content: `키워드: "${feedbackData.keyword}"
Good 횟수: ${feedbackData.totalUseful}
FP 횟수: ${feedbackData.totalFP}
사용된 문맥: ${feedbackData.exampleTranscripts.map(t => `"${t}"`).join(", ")}

왜 이 키워드가 오탐을 일으키는지 분석해.`,
    },
  ], { temperature: 0.3, maxTokens: 128 });

  if (error || !text) return "";
  return text;
}

/**
 * Generate real-time agent commentary for a game moment.
 * Should be short (1 sentence max), natural, spoken Korean.
 */
export async function llmCommentary(context: {
  transcript: string;
  category: string;
  action: string;
  isTurningPoint?: boolean;
  silenceSec?: number;
  phase?: string;
  categoryRepeatCount?: number;
  recentTranscripts?: string[];
}): Promise<string> {
  const recentCtx = context.recentTranscripts?.length
    ? `최근 발화들: ${context.recentTranscripts.slice(-3).map(t => `"${t}"`).join(", ")}`
    : "";

  const { text, error } = await chat([
    {
      role: "system",
      content: `너는 게임 스트리머의 AI 어시스턴트야. 게임 중 반응에 맞는 짧은 코멘트를 해줘.
규칙:
- 한국어로 한 문장 (15자 이내)
- 반말 사용 (친구처럼)
- 상황에 맞는 자연스러운 리액션
- 클립 저장했으면 알려줘
- 텍스트만 출력 (따옴표, 설명 없이)`,
    },
    {
      role: "user",
      content: `스트리머 발화: "${context.transcript}"
감정: ${context.category}
에이전트 판단: ${context.action}
${context.isTurningPoint ? "역전 상황!" : ""}
${context.silenceSec && context.silenceSec > 10 ? `${Math.round(context.silenceSec)}초 침묵 후 반응` : ""}
${context.phase === "peak" ? "클라이맥스 구간" : ""}
${context.categoryRepeatCount && context.categoryRepeatCount >= 2 ? "같은 반응 반복 중" : ""}
${recentCtx}

짧게 코멘트해.`,
    },
  ], { temperature: 0.8, maxTokens: 48 });

  if (error || !text) return "";
  return text.replace(/["""'''\n]/g, "").trim();
}

/**
 * Decide whether to ask the user or act immediately.
 * Returns { ask: true, question: "..." } or { ask: false, action: "SAVE_CLIP"|"TAG_EVENT", comment: "..." }
 */
export async function llmShouldAsk(context: {
  transcript: string;
  category: string;
  confidence: number;
  isTurningPoint?: boolean;
  recentTranscripts?: string[];
}): Promise<{ ask: boolean; question?: string }> {
  const { text, error } = await chat([
    {
      role: "system",
      content: `너는 게임 스트리머의 AI 어시스턴트야. 스트리머가 게임 중 감정적 반응을 했어.
스트리머에게 짧게 물어봐 — 클립 저장할지 확인하거나, 무슨 상황인지 물어봐.

규칙:
- 한 문장, 반말, 15자 이내
- 상황에 맞게 자연스럽게
- 예시: "지금 거 저장할까?", "뭐였어?", "오 방금 뭐야?", "저장해둘까?"
- 텍스트만 출력 (따옴표, JSON 없이)`,
    },
    {
      role: "user",
      content: `발화: "${context.transcript}"
감정: ${context.category}
${context.isTurningPoint ? "흐름 반전 상황" : ""}
최근: ${context.recentTranscripts?.slice(-2).map(t => `"${t}"`).join(", ") || "없음"}`,
    },
  ], { temperature: 0.7, maxTokens: 32 });

  if (error || !text) return { ask: true, question: "저장할까?" };

  const question = text.replace(/["""'''\n]/g, "").trim();
  return { ask: true, question: question || "저장할까?" };
}

/**
 * After user responds to agent's question, decide what to do.
 */
export async function llmDecideAfterResponse(context: {
  messages: Array<{ role: "agent" | "user"; text: string }>;
  originalTranscript: string;
  category: string;
}): Promise<{ action: string; response: string }> {
  const dialogue = context.messages
    .map((m) => `${m.role === "agent" ? "에이전트" : "스트리머"}: "${m.text}"`)
    .join("\n");

  const { text, error } = await chat([
    {
      role: "system",
      content: `너는 게임 스트리머의 AI 어시스턴트야. 대화를 보고 판단해.

가능한 판단:
- SAVE_CLIP: 하이라이트 클립으로 저장할 가치 있음
- TAG_EVENT: 저장까진 아니지만 기록해둠
- IGNORE: 별거 아님, 넘어가기

JSON으로 응답: {"action":"SAVE_CLIP|TAG_EVENT|IGNORE","response":"스트리머에게 할 짧은 말 (반말, 15자 이내)"}`,
    },
    {
      role: "user",
      content: `원래 반응: "${context.originalTranscript}" (${context.category})

대화:
${dialogue}

뭘로 판단해?`,
    },
  ], { temperature: 0.3, maxTokens: 80 });

  if (error || !text) return { action: "SAVE_CLIP", response: "일단 저장해둘게." };

  try {
    return JSON.parse(text);
  } catch {
    return { action: "SAVE_CLIP", response: "일단 저장해둘게." };
  }
}

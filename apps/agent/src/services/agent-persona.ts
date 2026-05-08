/**
 * Agent persona — defines the character, memory, and behavior rules
 * that make the agent feel like a real gaming companion.
 */

export const AGENT_SYSTEM_PROMPT = `너는 "플로우"라는 이름의 게임 어시스턴트야.
스트리머와 함께 게임을 보면서 하이라이트 클립을 관리해줘.

성격:
- 친한 친구처럼 반말 사용
- 간결하고 쿨함 (장황하지 않게)
- 게임 상황에 공감하고 리액션함
- 가끔 유머 섞기
- 과하게 물어보지 않기 — 명확하면 알아서 판단

행동 규칙:
- 확실한 하이라이트(골, 역전, 대박 플레이) → 바로 저장하고 알려줘
- 애매한 순간(짜증, 놀람) → 짧게 물어봐
- 이미 저장 결정한 비슷한 상황 → 안 물어보고 알아서 해
- 사용자가 "아니", "됐어" 하면 바로 넘어가
- 같은 말투 반복하지 마 — 다양하게

응답 형식:
- 텍스트만 출력 (JSON 아님)
- 한 문장, 최대 20자
- 자연스러운 한국어 구어체`;

/**
 * Build a context-aware prompt with session memory.
 */
export function buildConversationContext(sessionMemory: {
  clipsSaved: number;
  recentActions: Array<{ transcript: string; action: string; agentSaid?: string }>;
  sessionDurationMin: number;
}): string {
  const parts: string[] = [];

  if (sessionMemory.clipsSaved > 0) {
    parts.push(`이번 세션: ${sessionMemory.clipsSaved}개 클립 저장됨`);
  }

  if (sessionMemory.sessionDurationMin > 0) {
    parts.push(`경과 시간: ${sessionMemory.sessionDurationMin}분`);
  }

  if (sessionMemory.recentActions.length > 0) {
    const recent = sessionMemory.recentActions.slice(-3).map((a) => {
      const saved = a.action === "SAVE_CLIP" ? "→저장" : "→스킵";
      const said = a.agentSaid ? ` (에이전트: "${a.agentSaid}")` : "";
      return `"${a.transcript}" ${saved}${said}`;
    });
    parts.push(`최근: ${recent.join(", ")}`);
  }

  return parts.join("\n");
}

import type { ReactionCategory } from "./types.js";

export interface KeywordRule {
  category: ReactionCategory;
  keywords: string[];
  weight: number;
}

export const KEYWORD_RULES: KeywordRule[] = [
  {
    category: "excitement",
    keywords: [
      "와아", "오오", "대박", "미쳤다", "미쳤어",
      "개쩐다", "쩐다", "ㅋㅋ", "ㅋㅋㅋ", "레츠고", "가자",
      "개좋아", "좋아", "존나좋아", "개꿀", "꿀잼", "ㄹㅇ",
      "실화냐", "개이득", "이득", "갓", "개잘함", "나이스",
      "역전", "미친다", "대박이", "쩔어", "개쩔",
    ],
    weight: 1.0,
  },
  {
    category: "frustration",
    keywords: [
      "아아", "짜증", "왜이래", "에이", "ㅅㅂ", "시발", "씨발",
      "개짜증", "못해", "아씨", "젠장", "빡치네", "빡쳐",
      "개빡", "ㅈㄱ", "미친", "존나", "개같네", "뭐하냐",
      "팀이", "트롤", "뭐야이게",
      "아이씨", "보정", "억까", "ㅈㄴ", "에바",
    ],
    weight: 1.0,
  },
  {
    category: "surprise",
    keywords: [
      "헐", "뭐야", "엥", "세상에", "말도안돼", "실화",
      "ㄷㄷ", "ㅎㄷㄷ", "오마이갓", "헉", "대박사건",
      "어떻게", "이게되네", "미쳤나", "뭐지", "잠깐",
    ],
    weight: 1.0,
  },
  {
    category: "victory",
    keywords: [
      "이겼다", "승리", "킬", "에이스", "MVP", "겟", "먹었다",
      "잡았다", "원킬", "더블킬", "트리플", "쿼드라", "펜타킬",
      "클러치", "캐리", "개잘했다", "ㅇㅈ", "인정",
      "위너", "치킨", "이김", "1등",
      "역전골", "넣었다", "넣었어", "들어갔다", "골인", "득점",
    ],
    weight: 1.0,
  },
  {
    category: "defeat",
    keywords: [
      "졌다", "죽었다", "망했다", "끝났다", "GG", "gg",
      "항복", "패배", "지네", "또죽어", "개못함",
      "나감", "서렌", "포기", "어차피짐", "답없다",
    ],
    weight: 1.0,
  },
];

/** Phrase-level patterns (higher weight than single keywords) */
export interface PhraseRule {
  category: ReactionCategory;
  phrases: string[];
  weight: number;
}

export const PHRASE_RULES: PhraseRule[] = [
  {
    category: "excitement",
    phrases: [
      "와 대박", "와 미쳤다", "오 개쩐다", "레츠고 가자",
      "개꿀 ㅋㅋ", "진짜 대박", "와 좋아", "개이득 ㅋㅋ",
      "나이스", "개쩐다", "레츠고",
    ],
    weight: 2.0,
  },
  {
    category: "frustration",
    phrases: [
      "아 진짜", "아 뭐야", "아 짜증", "에이 씨",
      "아 왜", "진짜 못해", "아 빡쳐", "뭐야이게 진짜",
      "아 개짜증", "아씨 진짜",
    ],
    weight: 2.0,
  },
  {
    category: "surprise",
    phrases: [
      "헐 뭐야", "헐 대박", "어 뭐지", "세상에 말도안돼",
      "이게 되네", "어떻게 했지", "헐 실화", "뭐야 이게",
    ],
    weight: 2.0,
  },
  {
    category: "victory",
    phrases: [
      "이겼다 이겼다", "킬 먹었다", "에이스 겟",
      "개잘했다 ㅋㅋ", "클러치 성공", "치킨 먹자",
    ],
    weight: 2.0,
  },
  {
    category: "defeat",
    phrases: [
      "아 죽었다", "또 죽었다", "아 망했다", "GG 항복",
      "어차피 졌다", "답 없다",
    ],
    weight: 2.0,
  },
];

/** Single-syllable noise words that should not trigger events alone */
export const NOISE_WORDS = new Set([
  "아", "어", "음", "응", "오", "하", "에", "그", "저", "이",
  "네", "예", "뭐", "좀",
]);

/** Intensity booster words/patterns */
export const INTENSITY_WORDS = [
  "진짜", "개", "존나", "ㄹㅇ", "레알", "미친",
];

/** Voice command intent phrases */
import type { VoiceIntent } from "./types.js";

export interface IntentRule {
  intent: VoiceIntent;
  phrases: string[];
}

export const INTENT_RULES: IntentRule[] = [
  {
    intent: "START_SESSION",
    phrases: ["세션 시작", "게임 시작", "녹화 시작", "시작할게", "시작해"],
  },
  {
    intent: "END_SESSION",
    phrases: ["세션 종료", "게임 종료", "끝낼게", "종료할게", "녹화 끝", "그만할게"],
  },
];

/** Minimum confidence for voice commands */
export const INTENT_CONFIDENCE_THRESHOLD = 0.8;

/** Cooldown durations in milliseconds per category */
export const COOLDOWN_MS: Record<ReactionCategory, number> = {
  excitement: 5000,
  surprise: 5000,
  frustration: 5000,
  defeat: 5000,
  victory: 5000,
  neutral: 2000,
};

/** Minimum confidence to store an event */
export const CONFIDENCE_THRESHOLD = 0.6;

/** Duplicate detection window in milliseconds */
export const DUPLICATE_WINDOW_MS = 3000;

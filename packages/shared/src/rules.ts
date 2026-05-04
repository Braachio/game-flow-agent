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
      "와", "와아", "오", "오오", "대박", "미쳤다", "미쳤어",
      "개쩐다", "쩐다", "ㅋㅋ", "ㅋㅋㅋ", "레츠고", "가자",
      "개좋아", "좋아", "존나좋아", "개꿀", "꿀잼", "ㄹㅇ",
      "실화냐", "개이득", "이득", "갓", "개잘함",
    ],
    weight: 1.0,
  },
  {
    category: "frustration",
    keywords: [
      "아", "아아", "짜증", "왜", "에이", "ㅅㅂ", "시발", "씨발",
      "개짜증", "못해", "하", "아씨", "젠장", "빡치네", "빡쳐",
      "개빡", "ㅈㄱ", "미친", "존나", "개같네", "뭐하냐",
      "팀이", "트롤", "뭐야이게",
    ],
    weight: 1.0,
  },
  {
    category: "surprise",
    keywords: [
      "헐", "뭐야", "어", "엥", "세상에", "말도안돼", "실화",
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

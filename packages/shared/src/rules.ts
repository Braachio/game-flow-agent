import type { ReactionCategory } from "./types.js";

export interface KeywordRule {
  category: ReactionCategory;
  keywords: string[];
  weight: number;
}

export const KEYWORD_RULES: KeywordRule[] = [
  {
    category: "excitement",
    keywords: ["와", "오", "대박", "미쳤다", "개쩐다", "ㅋㅋ", "레츠고", "가자"],
    weight: 1.0,
  },
  {
    category: "frustration",
    keywords: ["아", "짜증", "왜", "에이", "ㅅㅂ", "시발", "개짜증", "못해"],
    weight: 1.0,
  },
  {
    category: "surprise",
    keywords: ["헐", "뭐야", "어", "엥", "세상에", "말도안돼", "실화"],
    weight: 1.0,
  },
  {
    category: "victory",
    keywords: ["이겼다", "승리", "킬", "에이스", "MVP", "겟", "먹었다", "잡았다"],
    weight: 1.0,
  },
  {
    category: "defeat",
    keywords: ["졌다", "죽었다", "망했다", "끝났다", "GG", "gg", "항복"],
    weight: 1.0,
  },
];

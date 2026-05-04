# Project Brief: Voice Reactive Game Flow Agent

## Problem

게임 스트리머는 매일 수 시간 방송하며 수십 번의 하이라이트 순간을 경험하지만, 대부분 클립으로 저장하지 못한다. 수동 클립 저장은 게임 중 조작이 불가능하고, 방송 후 VOD를 전부 다시 보는 것은 비현실적이다.

## Target User

- 한국어를 사용하는 게임 스트리머 (1인 방송)
- OBS를 사용하여 방송/녹화하는 사람
- 하이라이트 영상을 유튜브/쇼츠로 편집하려는 사람

## Hypothesis

게이머의 음성 반응(흥분, 놀람, 승리 등)은 키워드 기반 규칙만으로도 70% 이상의 정밀도로 분류할 수 있으며, 이를 활용하면 하이라이트 클립을 자동 저장할 수 있다.

## Solution

브라우저 Web Speech API로 마이크 입력을 실시간 텍스트 변환하고, 한국어 게임 반응 키워드를 분류하여, 고가치 반응 감지 시 OBS 리플레이 버퍼를 자동 저장한다.

## MVP Scope (4주) — Complete

| Week | Focus | Status |
|------|-------|--------|
| 1 | 기본 아키텍처, 음성 캡처, 키워드 분류기, 이벤트 저장 | Done |
| 2 | OBS 연동, 자동 클립, 이벤트 가드, 평가 시스템 | Done |
| 3 | 분류기 개선, UX 피드백, 세션 요약, 사용자 메모 | Done |
| 4 | 프레젠테이션 준비, 문서화, 최종 마무리 | Done |

## Final MVP 구성

1. **Voice Detection** — Web Speech API interim results + noise filter
2. **Contextual Event Tagging** — phrase matching, keyword rules, intensity/repetition scoring
3. **OBS Clip Saving** — auto-save replay on high-value reactions
4. **Session Summary** — per-session stats, category breakdown, Korean interpretation
5. **User Reflection Memo** — optional memo persisted with session report

## Architecture

```
Browser (Next.js + Tailwind)
  └─ Web Speech API → transcript
  └─ Dashboard UI (events, OBS control, evaluation)
       │
       │ HTTP (POST /events/voice)
       ▼
Agent (Fastify + TypeScript)
  └─ Keyword Classifier → category + confidence
  └─ Event Guard → duplicate/cooldown/threshold filter
  └─ Event Repository → JSON file storage
  └─ OBS Service → WebSocket v5 → SaveReplayBuffer
       │
       │ ws://localhost:4455
       ▼
OBS Studio
  └─ Replay Buffer (last 30s) → .mkv clip files
```

### Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Backend**: Node.js, Fastify, TypeScript
- **Shared**: npm workspaces monorepo, shared types/rules package
- **OBS**: obs-websocket-js (WebSocket v5 protocol)
- **Storage**: Local JSON files (events, false negatives)

## Evaluation Metrics

| Metric | Definition | Target |
|--------|-----------|--------|
| Precision | useful / (useful + false_positives) | >= 70% |
| False Negative Rate | missed moments / total reactions | <= 50% |
| Clip Save Success | successful saves / attempted saves | >= 90% |
| Latency | speech → clip save time | < 2s |
| Session Stability | no crashes in 10-min session | 100% |

## Limitations

1. **Web Speech API**: Chrome/Edge 전용, 인터넷 연결 필요
2. **키워드 매칭**: 문맥 파악 불가, 동음이의어 구분 못함
3. **단일 머신**: OBS와 같은 PC에서만 동작
4. **JSON 저장**: 대량 데이터에 부적합
5. **한국어 전용**: 다국어 미지원
6. **마이크 품질**: 배경 소음에 민감

## Next Steps

1. **ML 분류기**: 키워드 규칙을 감정 분석 모델로 교체
2. **설정 UI**: 쿨다운, 임계값, 카테고리를 대시보드에서 조정
3. **클립 메타데이터**: 저장된 클립에 카테고리/타임스탬프 태깅
4. **자동 편집**: 클립을 자동으로 쇼츠 형태로 조합
5. **클라우드**: 이벤트/클립을 클라우드에 저장하여 원격 접근
6. **다국어**: 영어/일본어 키워드 규칙 추가

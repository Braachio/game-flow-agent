# PM Report: Voice Reactive Game Flow Agent

## 1-Minute Explanation

게이머가 "와 대박!" 하고 소리치면, 시스템이 그 순간을 자동으로 감지하고 OBS 리플레이 버퍼를 저장합니다. 한국어 게임 반응 키워드를 실시간 분류하여 흥분/승리/놀람 등 고가치 순간만 클립으로 저장합니다. 수동 클립 저장 없이 하이라이트가 자동으로 모입니다.

## Current Status

**MVP 완성 (Week 2 끝)**

### Completed Features

- [x] 마이크 음성 인식 (Web Speech API, 한국어)
- [x] 키워드 기반 감정 분류 (5개 카테고리, 90+ 키워드)
- [x] 이벤트 가드 (중복 3s, 쿨다운 5s, 신뢰도 60% 이상)
- [x] OBS WebSocket 연결/해제/리플레이 제어
- [x] 고가치 반응 시 자동 클립 저장
- [x] 데모 모드 (대형 상태 배너)
- [x] 수동 테스트 버튼
- [x] 세션 추적
- [x] 사용자 피드백 (Good/FP/Missed Moment)
- [x] 평가 메트릭 대시보드
- [x] 이벤트 타임라인 (최근 10개)

### Not Yet Implemented

- [ ] 설정 UI (현재 read-only)
- [ ] OBS 자동 재연결
- [ ] ML 기반 분류기
- [ ] 클립 파일 관리/탐색

## 3-Minute Demo Script

### Part 1: 시스템 소개 (30s)

> "게임 중 흥분하는 순간을 자동으로 클립 저장해주는 도구입니다.
> 마이크로 음성을 인식하고, 한국어 반응을 분류해서, OBS 리플레이 버퍼를 자동 저장합니다."

대시보드를 보여주며 구조 설명.

### Part 2: 수동 테스트 (1min)

1. Demo Mode ON
2. "와 대박" 버튼 클릭 → 🔥 Detected: excitement → clip saved
3. "아 망했다" 버튼 클릭 → defeat → no clip (고가치 아님)
4. 바로 다시 클릭 → cooldown으로 무시됨
5. OBS 연결 상태와 클립 저장 확인

### Part 3: 실제 마이크 테스트 (1min)

1. Start Listening 클릭
2. "와 미쳤다!" → excitement 감지, 클립 저장
3. "헐 뭐야" → surprise 감지, 클립 저장
4. "안녕하세요" → 저신뢰도 → 무시됨
5. Stop Listening

### Part 4: 평가 시스템 (30s)

1. 타임라인에서 "Good" / "FP" 버튼 클릭
2. "Missed Moment" 버튼으로 놓친 순간 기록
3. Evaluation 카드에서 실시간 정밀도 확인
4. `curl http://localhost:3001/events/evaluation` 로 JSON 결과 확인

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| 키워드 규칙 (ML 아님) | MVP에서 빠른 검증, 설명 가능성 |
| OBS 리플레이 버퍼 | 별도 녹화 불필요, 기존 설정 활용 |
| 브라우저 Speech API | 별도 STT 서비스 없이 무료 사용 |
| 로컬 JSON 저장 | 외부 DB 없이 즉시 시작 가능 |
| 세션 기반 평가 | 테스트 간 메트릭 분리 가능 |

## Risks

1. **Speech API 정확도**: 시끄러운 환경에서 인식률 저하
2. **키워드 한계**: "아" 같은 단음절이 일상 발화에서도 잡힘 → FP 증가
3. **OBS 의존성**: OBS 없으면 핵심 기능 작동 불가
4. **Chrome 전용**: 다른 브라우저 사용자 배제

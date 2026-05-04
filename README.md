# Voice Reactive Game Flow Agent

게임 중 음성 반응을 실시간 분류하여 OBS 리플레이 버퍼를 자동 저장하는 도구.

## MVP Status: Complete

### Completed Features

- [x] 마이크 음성 인식 (Web Speech API, 한국어)
- [x] 키워드 기반 감정 분류 (5개 카테고리, 90+ 키워드)
- [x] 이벤트 가드 (중복 3s, 쿨다운 5s, 신뢰도 60% 필터)
- [x] OBS WebSocket 연결 및 리플레이 버퍼 제어
- [x] 고가치 반응(excitement/victory/surprise) 자동 클립 저장
- [x] 데모 모드 (대형 상태 배너)
- [x] 수동 테스트 버튼
- [x] 세션 기반 이벤트 추적
- [x] 사용자 피드백 (Good / False Positive / Missed Moment)
- [x] 평가 메트릭 대시보드 (precision 계산)
- [x] 이벤트 타임라인 (최근 10개, 피드백 버튼 포함)
- [x] 설정 패널 (read-only)

### Not Implemented

- [ ] 설정 UI (쿨다운/임계값 조정)
- [ ] OBS 자동 재연결
- [ ] ML 기반 분류기
- [ ] 다국어 지원

## Architecture

```
Browser (Next.js + Tailwind)
  └─ Web Speech API → transcript
  └─ Dashboard UI
       │
       │ HTTP
       ▼
Agent (Fastify + TypeScript)
  └─ Classifier → Event Guard → Event Repository (JSON)
  └─ OBS Service → ws://localhost:4455 → SaveReplayBuffer
       │
       ▼
OBS Studio → Replay Buffer → .mkv clips
```

## Quick Start

```bash
npm install
npm run build -w packages/shared

cp .env.example .env
# .env에서 OBS_PASSWORD 설정

npm run dev:agent   # http://localhost:3001
npm run dev:web     # http://localhost:3002
```

## OBS Setup

1. OBS Studio 실행
2. **Tools → WebSocket Server Settings**
   - WebSocket 서버 활성화
   - 포트: 4455
   - 비밀번호 설정 → `.env`의 `OBS_PASSWORD`에 입력
3. **Settings → Output → Replay Buffer**
   - "리플레이 버퍼 활성화" 체크
   - 최대 시간: 30초
   - 적용
4. 대시보드에서 **Connect** → **Start Replay Buffer** 클릭

## Testing with OBS

1. OBS 설정 완료 후 대시보드에서 OBS Connect
2. Start Replay Buffer 클릭 (녹색 Active 확인)
3. Start Listening 또는 테스트 버튼으로 이벤트 생성
4. excitement/victory/surprise 이벤트 → "clip saved" 배지 확인
5. OBS 녹화 폴더에서 `.mkv` 클립 파일 확인

## Evaluation Flow

1. Start Listening 클릭 (세션 자동 생성)
2. 게임 플레이하며 자연스럽게 반응
3. 타임라인에서:
   - 정확한 감지 → **Good** 클릭
   - 잘못된 감지 → **FP** 클릭
   - 놓친 순간 → **Missed Moment** 클릭
4. Evaluation 카드에서 실시간 precision 확인
5. API로 결과 추출:
   ```bash
   curl http://localhost:3001/events/evaluation
   ```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | 서버 상태 |
| POST | /events/voice | 음성 전사 제출 |
| GET | /events/stats | 이벤트 통계 |
| GET | /events/evaluation | 평가 메트릭 |
| POST | /events/feedback | 이벤트 피드백 |
| POST | /events/false-negative | 놓친 순간 기록 |
| GET | /obs/status | OBS 연결 상태 |
| POST | /obs/connect | OBS 연결 |
| POST | /obs/disconnect | OBS 해제 |
| POST | /obs/replay/start | 리플레이 버퍼 시작 |
| POST | /obs/replay/save | 리플레이 저장 |

## Documentation

- [docs/project-brief.md](docs/project-brief.md) — 프로젝트 기획서
- [docs/pm-report.md](docs/pm-report.md) — PM 보고서
- [docs/demo-script.md](docs/demo-script.md) — 3분 데모 스크립트
- [docs/evaluation-plan.md](docs/evaluation-plan.md) — 평가 계획
- [docs/evaluation-result-template.md](docs/evaluation-result-template.md) — 결과 템플릿

## Auto-clip Rules

클립 저장 대상:
- **excitement** — 와, 대박, 미쳤다, 개쩐다, 레츠고...
- **victory** — 이겼다, 킬, 펜타킬, 클러치, 캐리...
- **surprise** — 헐, 뭐야, 세상에, 말도안돼...

클립 미저장:
- frustration, defeat, neutral
- 신뢰도 60% 미만
- 쿨다운(5s) 또는 중복(3s) 필터링됨

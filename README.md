# Voice Reactive Game Flow Agent

게임 중 음성 반응을 실시간 분류하여 OBS 리플레이 버퍼를 자동 저장하는 도구.

## MVP Status: Final

### Core Features

- [x] **Voice Detection** — Web Speech API (한국어), interim results, noise filter
- [x] **Contextual Event Tagging** — phrase/keyword matching, intensity scoring, repetition detection
- [x] **OBS Clip Saving** — auto-save replay buffer on excitement/victory/surprise
- [x] **Session Summary** — per-session stats, category breakdown, auto-interpretation
- [x] **User Reflection Memo** — optional memo at session end, persisted with report

### Additional Features

- [x] 이벤트 가드 (중복 3s, 쿨다운 5s, 신뢰도 60% 필터)
- [x] 데모 모드 (대형 상태 배너, interim text, latency 표시)
- [x] 수동 테스트 버튼
- [x] 사용자 피드백 (Good / FP / Missed Moment)
- [x] 평가 메트릭 대시보드 (precision 계산)
- [x] 이벤트 타임라인 (keyword highlights, confidence bar, flash)
- [x] 클립 저장 사운드 효과
- [x] 세션 리포트 저장 (GET /sessions/reports)
- [x] 분류기 디버그 모드 (CLASSIFIER_DEBUG=true)

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

## Session Flow

1. **Start Session** 클릭 (세션 자동 생성, 이전 데이터 리셋)
2. 게임 플레이하며 자연스럽게 반응
3. 타임라인에서 피드백: **Good** / **FP** / **Missed Moment**
4. **End Session** 클릭
5. Session Summary 카드 확인 (반응 수, 클립 수, 카테고리 분석)
6. (선택) Reflection Memo 작성
7. **Save Report** 클릭 → `data/session-reports.json`에 저장
8. 세션 리포트 조회:
   ```bash
   curl http://localhost:3001/sessions/reports
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
| GET | /sessions/reports | 세션 리포트 목록 |
| POST | /sessions/reports | 세션 리포트 저장 |

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

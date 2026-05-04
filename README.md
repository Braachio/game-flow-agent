# Voice Reactive Game Flow Agent

A real-time voice reaction classifier for gaming streams. Captures microphone input via Web Speech API, classifies Korean gaming reactions using keyword rules, and logs events for replay buffer integration.

## Architecture

```
apps/
  web/        → Next.js dashboard (mic capture, transcript & event panels)
  agent/      → Node.js + Fastify backend (classification, event storage)
packages/
  shared/     → Shared types, event schemas, keyword rules
```

## Quick Start

```bash
# Install dependencies
npm install

# Build shared package first
npm run build -w packages/shared

# Run both apps in dev mode
npm run dev:agent   # http://localhost:3001
npm run dev:web     # http://localhost:3000
```

## API Endpoints

| Method | Path            | Description                    |
|--------|-----------------|--------------------------------|
| GET    | /health         | Server health check            |
| POST   | /events/voice   | Submit voice transcript        |

### POST /events/voice

```json
{
  "transcript": "와 대박 이겼다!"
}
```

Response:
```json
{
  "event": {
    "id": "uuid",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "transcript": "와 대박 이겼다!",
    "category": "victory",
    "confidence": 0.67
  }
}
```

## Reaction Categories

- **excitement** — 와, 대박, 미쳤다, 개쩐다, 레츠고, 가자
- **frustration** — 짜증, 왜, 에이, 개짜증, 못해
- **surprise** — 헐, 뭐야, 엥, 세상에, 말도안돼, 실화
- **victory** — 이겼다, 킬, 에이스, MVP, 잡았다
- **defeat** — 졌다, 죽었다, 망했다, 끝났다, GG

## Roadmap

- [x] Web Speech API mic capture
- [x] Transcript + event log panels
- [x] Keyword-based reaction classifier
- [x] Local JSON event storage
- [ ] OBS WebSocket replay buffer integration
- [ ] Confidence threshold tuning UI
- [ ] Event timeline visualization

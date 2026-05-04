# Voice Reactive Game Flow Agent

A real-time voice reaction classifier for gaming streams. Captures microphone input, classifies Korean gaming reactions, and auto-saves OBS replay buffer clips on hype moments.

## Concept

Streamers react vocally during gameplay — excitement, frustration, surprise. This tool listens to those reactions in real-time and automatically clips the last N seconds via OBS replay buffer when high-value moments are detected.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (Next.js)                                          │
│  ┌──────────────┐   ┌──────────────┐   ┌───────────────┐   │
│  │ Web Speech   │──▶│ Dashboard    │──▶│ POST          │   │
│  │ API (mic)    │   │ (transcript) │   │ /events/voice │   │
│  └──────────────┘   └──────────────┘   └───────┬───────┘   │
└─────────────────────────────────────────────────┼───────────┘
                                                  │ HTTP
┌─────────────────────────────────────────────────┼───────────┐
│  Agent (Fastify)                                ▼           │
│  ┌──────────────┐   ┌──────────────┐   ┌───────────────┐   │
│  │ Classifier   │──▶│ Event Guard  │──▶│ Event Repo    │   │
│  │ (keywords)   │   │ (cooldown)   │   │ (JSON file)   │   │
│  └──────────────┘   └──────────────┘   └───────────────┘   │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────┐         ┌─────────────────────────────┐   │
│  │ OBS Service  │────────▶│ OBS Studio (WebSocket v5)   │   │
│  │ (auto-clip)  │  ws://  │ → SaveReplayBuffer          │   │
│  └──────────────┘         └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# Install dependencies
npm install

# Build shared package
npm run build -w packages/shared

# Copy env and set OBS password
cp .env.example .env
# Edit .env → set OBS_PASSWORD

# Run agent (port 3001)
npm run dev:agent

# Run web dashboard (port 3002)
npm run dev:web
```

## OBS Setup

1. Open OBS Studio
2. **Tools → WebSocket Server Settings**
   - Enable WebSocket server
   - Set port to 4455
   - Set a password → put it in `.env` as `OBS_PASSWORD`
3. **Settings → Output → Replay Buffer**
   - Check "Enable Replay Buffer"
   - Set maximum replay time (e.g., 30 seconds)
   - Click Apply
4. From the dashboard, click **Connect** then **Start Replay Buffer**

## Dashboard Features

- Microphone capture with Web Speech API (Korean)
- Real-time transcript display
- Event classification with confidence scores
- OBS connection control (connect/disconnect/start buffer/save clip)
- Demo mode with large status banner
- Manual test buttons for simulating voice inputs
- Event timeline with clip status badges
- Settings overview (cooldowns, thresholds, categories)

## API Endpoints

| Method | Path              | Description                      |
|--------|-------------------|----------------------------------|
| GET    | /health           | Server health check              |
| POST   | /events/voice     | Submit voice transcript          |
| GET    | /events/stats     | Event statistics                 |
| GET    | /obs/status       | OBS connection status            |
| POST   | /obs/connect      | Connect to OBS WebSocket         |
| POST   | /obs/disconnect   | Disconnect from OBS              |
| POST   | /obs/replay/start | Start replay buffer              |
| POST   | /obs/replay/save  | Save replay buffer clip          |

## Auto-clip Rules

Events that trigger OBS clip save:
- **excitement** (와, 대박, 미쳤다, 개쩐다...)
- **victory** (이겼다, 킬, 펜타킬, 클러치...)
- **surprise** (헐, 뭐야, 세상에, 말도안돼...)

Events that do NOT trigger clips:
- frustration, defeat, neutral
- Any event below 60% confidence
- Events blocked by cooldown (5s) or duplicate detection (3s)

## Known Limitations

- Web Speech API requires Chrome/Edge (not supported in Firefox)
- Korean speech recognition accuracy varies by mic quality
- Single-keyword matching — no context/sentence-level analysis yet
- No persistent settings — cooldowns/thresholds are code-level constants
- JSON file storage — not suitable for production scale
- OBS must be on the same machine (localhost WebSocket)
- No auto-reconnect to OBS if connection drops

## Roadmap

- [x] Web Speech API mic capture
- [x] Keyword-based reaction classifier
- [x] Event guards (duplicate, cooldown, confidence)
- [x] Local JSON event storage
- [x] OBS WebSocket integration
- [x] Auto-clip on high-value reactions
- [x] Demo mode + manual test buttons
- [ ] Configurable settings from UI
- [ ] Multi-language support
- [ ] ML-based classifier upgrade
- [ ] Cloud storage for clips
- [ ] Event timeline visualization with replay

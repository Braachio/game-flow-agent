# Smoke Test Checklist

## 1. Environment Setup

- [ ] `.env` exists with all required values:
  ```
  PORT=3001
  OBS_HOST=localhost
  OBS_PORT=4455
  OBS_PASSWORD=<your password>
  OBS_RECORDING_DIR=/mnt/c/Users/josan/Videos/화면 녹화
  OBS_CLIP_RENAME_ENABLED=true
  CLASSIFIER_DEBUG=true
  ```
- [ ] `npm install` completes without errors
- [ ] `npm run build -w packages/shared` succeeds

## 2. OBS Setup

- [ ] OBS Studio is running
- [ ] WebSocket server enabled (Tools → WebSocket Server Settings)
- [ ] Port set to 4455, password matches `.env`
- [ ] Replay Buffer enabled (Settings → Output → Replay Buffer)
- [ ] Replay buffer max time set (e.g., 30s)
- [ ] Recording directory matches `OBS_RECORDING_DIR`

## 3. Start Services

```bash
npm run dev:agent   # should print: Agent server running on http://localhost:3001
npm run dev:web     # should open: http://localhost:3002
```

- [ ] Agent starts without errors on port 3001
- [ ] Web dashboard loads on port 3002
- [ ] `curl http://localhost:3001/health` returns `{"status":"ok",...}`

## 4. Voice Control & Session Flow

| Step | Action | Expected |
|------|--------|----------|
| 4.1 | Click "Enable Voice" | Button changes to "Disable Voice", status: `Listening for "세션 시작"...` |
| 4.2 | Say or send "와 대박" (no session) | Ignored — backend log: `[Voice] Ignored: no active session` |
| 4.3 | Say "세션 시작" | Session starts, feedback: "Session started by voice", session ID appears |
| 4.4 | Click "Start Session" button directly | Also starts session + enables voice if not already listening |
| 4.5 | Click test button "와 대박" | Event appears in timeline with excitement, confidence ≥60% |
| 4.6 | Click "와 대박" again immediately | Ignored (cooldown), no new event |
| 4.7 | Wait 5s, click "와 대박" again | New event accepted |
| 4.8 | Click "아 망했다" | Event: defeat, no clip triggered |
| 4.9 | Say "세션 종료" or click "End Session" | Session ends, summary card appears, voice stays listening |
| 4.10 | Check agent console | `[Voice] ACCEPTED`, `[ActionDecision]` logs visible |

## 5. OBS Save Test

| Step | Action | Expected |
|------|--------|----------|
| 5.1 | In OBS Card, click "Connect" | Status turns green: "Connected" |
| 5.2 | Click "Start Replay Buffer" | Status shows "Replay Buffer: Active" |
| 5.3 | Click test button "와 대박" | "clip saved" badge appears, ding sound plays |
| 5.4 | Check agent console | `[OBS] Replay saved for event ...` |
| 5.5 | Check OBS recording directory | New clip file exists |

## 6. Clip Rename Test

| Step | Action | Expected |
|------|--------|----------|
| 6.1 | After step 5.3, wait 2s | Agent log: `[ClipFile] Renamed clip: ...` |
| 6.2 | Check EventLogPanel | Blue filename shown: `YYYYMMDD_HHMMSS_excitement_와_대박.mkv` |
| 6.3 | Check OBS recording directory | File renamed to match the pattern |
| 6.4 | Verify original filename is gone | Only renamed file exists |

## 7. Session Summary Test

| Step | Action | Expected |
|------|--------|----------|
| 7.1 | Generate 3+ events via test buttons | Events appear in timeline |
| 7.2 | Click "End Session" | Session Summary card appears |
| 7.3 | Check summary stats | Total reactions, clips saved, clip rate % displayed |
| 7.4 | Check category breakdown | Badges show correct counts |
| 7.5 | Check interpretation | Korean text describing session (e.g., "주된 반응: 흥분") |
| 7.6 | Type reflection memo | Textarea accepts input |
| 7.7 | Click "Save Report" | "Saved!" confirmation appears |
| 7.8 | `curl http://localhost:3001/sessions/reports` | Report with memo present in JSON |

## 8. Session Folder Test

| Step | Action | Expected |
|------|--------|----------|
| 8.1 | Set `OBS_RECORDING_DIR` in `.env` | Directory path configured |
| 8.2 | Start session (voice or button) | Agent log: `[Session] Created session folder: .../session_YYYYMMDD_HHMMSS_xxxxxx` — folder name = sessionId |
| 8.3 | Verify sessionId in events | All events have same sessionId matching the folder name |
| 8.4 | Trigger clip (e.g., "와 대박") | Agent log: `[ClipFile] Moved clip to session folder: ...` |
| 8.5 | Check session folder on disk | Clip file present with correct name |
| 8.6 | End session + Save Report | `session-report.json` saved inside session folder, `sessionId` matches folder |
| 8.7 | Check EventLogPanel | Shows `session_YYYYMMDD_HHMMSS_xxx/filename.mkv` |
| 8.8 | Check SessionSummaryCard | Shows "Clips folder: ..." path |
| 8.9 | Unset `OBS_RECORDING_DIR`, start session | No folder created, clips stay in place (no crash) |
| 8.10 | Session folder creation fails (read-only dir) | clipSaved: true, session continues, error logged |
| 8.11 | Load old session reports (pre-migration format) | Reports display without errors (old IDs are preserved) |

## 9. Failure Case Tests

| Step | Action | Expected |
|------|--------|----------|
| 8.1 | Disconnect OBS, click "와 대박" | "OBS not ready" badge, no crash |
| 8.2 | Send "안녕하세요" | Ignored (low confidence), agent log: `[EventGuard] IGNORED` |
| 8.3 | Send "아" (single noise word) | Filtered by classifier, neutral 0% |
| 8.4 | Set `OBS_RECORDING_DIR=` (empty), trigger clip | clipSaved: true, clipRenameError shown |
| 8.5 | Set invalid OBS password, click Connect | Error: "OBS WebSocket requires a password..." |
| 8.6 | Stop agent, try from dashboard | Fetch fails gracefully, no crash |

## 10. Expected Results Summary

| Feature | Pass Criteria |
|---------|--------------|
| Agent health | Returns status "ok" |
| Voice classification | "와 대박" → excitement ≥60% |
| Noise filter | "아", "어" → neutral 0% |
| Event guard | Duplicate within 3s ignored, cooldown 5s enforced |
| OBS connect | Green status when OBS running + correct password |
| Replay save | SaveReplayBuffer succeeds, file appears |
| Clip rename | File renamed with timestamp_category_transcript format |
| Session ID | Format `session_YYYYMMDD_HHMMSS_xxxxxx`, generated by backend, same as folder name |
| Session folder | Clips organized into `{sessionId}/` folder |
| Session summary | Correct counts, interpretation generated, folder path shown |
| Reflection memo | Persisted in session-reports.json and session folder |
| Error handling | No crashes on OBS disconnect, missing dir, bad input |

## Quick Full Run (2 minutes)

```bash
# Terminal 1
npm run dev:agent

# Terminal 2
npm run dev:web

# Browser
1. Open http://localhost:3002
2. Demo Mode ON
3. Connect OBS → Start Replay Buffer
4. Click "Enable Voice" → verify listening status
5. Say "세션 시작" or click "Start Session" → session starts
6. Click "와 대박" → verify clip saved + filename in session folder
7. Click "아 망했다" → verify TAG_EVENT, no clip
8. Click "나이스" → verify SAVE_CLIP
9. Say "세션 종료" or click "End Session" → summary appears
10. Write memo → Save Report
11. curl http://localhost:3001/sessions/reports → verify JSON
12. Check session folder on disk → clip files + session-report.json + README.txt present
```

All 12 steps should complete without errors.

## Voice Control vs Session (Reference)

- **Enable Voice** = microphone permission + listening starts. No events are processed yet.
- **Start Session** = can be triggered by voice ("세션 시작") or button. Events are now processed.
- **End Session** = can be triggered by voice ("세션 종료") or button. Summary shown, voice stays active.
- **Disable Voice** = stops microphone. If session is active, also ends it.

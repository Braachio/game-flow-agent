# Demo Script (3 minutes)

## Setup (before demo starts)

1. Start agent: `npm run dev:agent`
2. Start web: `npm run dev:web`
3. Open http://localhost:3002 in Chrome
4. Open OBS with replay buffer configured
5. Toggle "Demo Mode" ON in top-right corner

---

## Part 1: Manual Testing (1 min)

> "먼저 수동 테스트 버튼으로 시스템이 어떻게 작동하는지 보여드리겠습니다."

1. Click **"와 대박"** button
   - Banner shows: 🔥 Detected: excitement
   - Timeline shows event with confidence %
   - If OBS connected: "clip saved" badge appears

2. Click **"아 망했다"** button
   - Banner shows: Detected: defeat
   - No clip saved (defeat is not a high-value category)

3. Click **"와 대박"** again immediately
   - Nothing happens — cooldown active (5s)
   - Show agent console: `[EventGuard] IGNORED (cooldown)`

4. Wait 5 seconds, click **"와 대박"** again
   - Event accepted this time

---

## Part 2: OBS Integration (1 min)

> "이제 OBS와 연동해보겠습니다."

1. Click **Connect** in OBS Control card
   - Status turns green: "Connected"

2. Click **Start Replay Buffer**
   - Status shows: "Replay Buffer: Active"

3. Click **"와 대박"** test button
   - Banner: 🔥 Detected: excitement — Clip saved!
   - Green "clip saved" badge in timeline
   - Agent console: `[OBS] Replay saved for event ...`

4. Click **Save Replay** manually
   - Shows the manual save also works

---

## Part 3: Live Microphone (1 min)

> "실제 마이크로 테스트해보겠습니다."

1. Click **Start Listening**
   - Banner shows: "Listening..."
   - Green pulse indicator active

2. Say into mic: **"와 대박 이겼다!"**
   - Transcript appears in panel
   - Event classified as excitement or victory
   - Clip saved automatically

3. Say: **"헐 뭐야 이게"**
   - Classified as surprise
   - Another clip saved

4. Say: **"안녕하세요"**
   - Low confidence → ignored
   - Agent console: `[EventGuard] IGNORED (low_confidence)`

5. Click **Stop Listening**

---

## Wrap-up

> "정리하면:"
> - 음성 인식 → 감정 분류 → 자동 클립 저장
> - 고가치 반응(excitement, victory, surprise)만 클립 저장
> - 중복/쿨다운/저신뢰도 자동 필터링
> - OBS 리플레이 버퍼로 최근 30초 자동 저장

---

## Troubleshooting during demo

| Problem | Fix |
|---------|-----|
| Mic not working | Check browser permissions, use Chrome |
| OBS connect fails | Check OBS is open + WebSocket enabled |
| Events all ignored | Wait for cooldown (5s), or restart agent |
| No clip saved | Check replay buffer is started in OBS card |

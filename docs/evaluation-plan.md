# Evaluation Plan

## Hypothesis

Korean gaming voice reactions can be classified by simple keyword matching with sufficient accuracy (>70% precision) to trigger meaningful auto-clip saves during live gameplay.

## Test Setup

- **Participants**: 1-3 testers playing games while talking in Korean
- **Duration**: 5-10 minute sessions per game
- **Games**: Any high-action game (FPS, MOBA, battle royale)
- **Equipment**: Chrome browser, microphone, OBS with replay buffer (30s)

## Test Flow

1. Start agent backend: `npm run dev:agent`
2. Open dashboard: http://localhost:3002
3. Connect to OBS and start replay buffer
4. Toggle Demo Mode ON for visibility
5. Click "Start Listening"
6. Play game normally for 5-10 minutes
7. During play:
   - When an event is correctly detected → click "Good"
   - When an event is wrongly detected → click "FP" (false positive)
   - When a real reaction was missed → click "Missed Moment"
8. Stop listening
9. Review GET /events/evaluation for metrics

## Metrics

| Metric | Definition |
|--------|-----------|
| Total Transcripts | Number of speech segments recognized |
| Detected Events | Events that passed all guards |
| Clipped Events | Events that triggered OBS replay save |
| Ignored Events | Events blocked by guard (cooldown/duplicate/low confidence) |
| False Positives | User-marked incorrect detections |
| False Negatives | User-marked missed moments |
| Useful | User-marked correct detections |
| Precision | useful / (useful + false_positives) |

## Pass/Fail Criteria

### MVP Pass (Week 2)

| Criteria | Threshold |
|----------|-----------|
| Precision | >= 70% |
| False negative rate | <= 50% of obvious reactions missed |
| Clip save success | >= 90% when OBS connected |
| System uptime | No crashes during 10-min session |
| Latency | < 2s from speech to clip save |

### Stretch Goals (Week 3-4)

| Criteria | Threshold |
|----------|-----------|
| Precision | >= 85% |
| False negative rate | <= 30% |
| Multi-user consistency | Same results across 3 testers |

## Known Biases

- Single-word keywords favor short exclamations over sentences
- Web Speech API accuracy depends on mic quality and background noise
- Cooldown may suppress legitimate rapid-fire reactions
- Tester awareness of the tool may alter natural speech patterns

## After Testing

1. Export evaluation metrics: `curl http://localhost:3001/events/evaluation`
2. Review false positives for keyword rule adjustments
3. Review false negatives for missing keywords
4. Adjust CONFIDENCE_THRESHOLD if too many low-quality clips
5. Adjust COOLDOWN_MS if legitimate events are being suppressed

/**
 * Smoke test for the action decision layer.
 * Run with: npx tsx apps/agent/smoke-test.ts
 */
import { decideAction } from "./src/services/action-decision.service.js";
import { detectIntent } from "./src/services/intent-detector.js";
import { sessionState } from "./src/services/session-state.js";
import { classify } from "./src/services/classifier.js";
import { generateSessionId } from "@likelion/shared";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ FAIL: ${label}`);
    failed++;
  }
}

// Reset session state before tests
function resetSession() {
  if (sessionState.isActive()) sessionState.end();
}

async function main() {

console.log("\n=== 1. START_SESSION works only when inactive ===");
resetSession();
{
  const d = decideAction({
    transcript: "세션 시작",
    intent: "START_SESSION",
    category: "neutral",
    confidence: 0.9,
    sessionActive: false,
  });
  assert(d.action === "START_SESSION", "START_SESSION when inactive → START_SESSION");

  const d2 = decideAction({
    transcript: "세션 시작",
    intent: "START_SESSION",
    category: "neutral",
    confidence: 0.9,
    sessionActive: true,
  });
  assert(d2.action === "IGNORE", "START_SESSION when active → IGNORE");
  assert(d2.actionReason.includes("already active"), `reason: "${d2.actionReason}"`);
}

console.log("\n=== 2. END_SESSION works only when active ===");
{
  const d = decideAction({
    transcript: "세션 종료",
    intent: "END_SESSION",
    category: "neutral",
    confidence: 0.9,
    sessionActive: true,
  });
  assert(d.action === "END_SESSION", "END_SESSION when active → END_SESSION");

  const d2 = decideAction({
    transcript: "세션 종료",
    intent: "END_SESSION",
    category: "neutral",
    confidence: 0.9,
    sessionActive: false,
  });
  assert(d2.action === "IGNORE", "END_SESSION when inactive → IGNORE");
  assert(d2.actionReason.includes("no active session"), `reason: "${d2.actionReason}"`);
}

console.log("\n=== 3. SAVE_CLIP triggers for excitement/victory ===");
{
  const d1 = decideAction({
    transcript: "와 대박 미쳤다",
    category: "excitement",
    confidence: 0.85,
    sessionActive: true,
  });
  assert(d1.action === "SAVE_CLIP", "excitement → SAVE_CLIP");

  const d2 = decideAction({
    transcript: "이겼다 치킨",
    category: "victory",
    confidence: 0.8,
    sessionActive: true,
  });
  assert(d2.action === "SAVE_CLIP", "victory → SAVE_CLIP");

  // surprise with high confidence
  const d3 = decideAction({
    transcript: "헐 뭐야 대박",
    category: "surprise",
    confidence: 0.8,
    sessionActive: true,
  });
  assert(d3.action === "SAVE_CLIP", "surprise conf>=0.75 → SAVE_CLIP");

  // surprise with low confidence
  const d4 = decideAction({
    transcript: "헐",
    category: "surprise",
    confidence: 0.65,
    sessionActive: true,
  });
  assert(d4.action === "TAG_EVENT", "surprise conf<0.75 → TAG_EVENT");
}

console.log("\n=== 4. TAG_EVENT does not trigger clip (frustration/defeat) ===");
{
  const d1 = decideAction({
    transcript: "아 짜증나",
    category: "frustration",
    confidence: 0.75,
    sessionActive: true,
  });
  assert(d1.action === "TAG_EVENT", "frustration → TAG_EVENT (no clip)");

  const d2 = decideAction({
    transcript: "졌다 망했다",
    category: "defeat",
    confidence: 0.8,
    sessionActive: true,
  });
  assert(d2.action === "TAG_EVENT", "defeat → TAG_EVENT (no clip)");
}

console.log("\n=== 5. IGNORE does not store events (neutral / low confidence) ===");
{
  const d1 = decideAction({
    transcript: "음",
    category: "neutral",
    confidence: 0.3,
    sessionActive: true,
  });
  assert(d1.action === "IGNORE", "neutral low conf → IGNORE");

  const d2 = decideAction({
    transcript: "뭐",
    category: "neutral",
    confidence: 0.7,
    sessionActive: true,
  });
  assert(d2.action === "IGNORE", "neutral → IGNORE");

  // Low confidence on any category
  const d3 = decideAction({
    transcript: "와",
    category: "excitement",
    confidence: 0.5,
    sessionActive: true,
  });
  assert(d3.action === "IGNORE", "excitement but conf<0.6 → IGNORE");
}

console.log("\n=== 6. Intent detection integration ===");
{
  const r1 = detectIntent("세션 시작");
  assert(r1.detected === true, "detects '세션 시작'");
  assert(r1.intent === "START_SESSION", `intent: ${r1.intent}`);
  assert(r1.confidence >= 0.8, `confidence ${r1.confidence} >= 0.8`);

  const r2 = detectIntent("끝낼게");
  assert(r2.detected === true, "detects '끝낼게'");
  assert(r2.intent === "END_SESSION", `intent: ${r2.intent}`);

  const r3 = detectIntent("와 대박 미쳤다");
  assert(r3.detected === false, "non-command transcript → not detected");
}

console.log("\n=== 7. Classification still feeds action layer correctly ===");
{
  const c = classify("와 대박 미쳤다 개쩐다");
  assert(c.category === "excitement", `classified as ${c.category}`);
  assert(c.confidence >= 0.6, `confidence ${c.confidence.toFixed(2)} >= 0.6`);

  const d = decideAction({
    transcript: "와 ���박 미쳤다 개쩐다",
    category: c.category,
    confidence: c.confidence,
    sessionActive: true,
  });
  assert(d.action === "SAVE_CLIP", "full pipeline: classify→decide → SAVE_CLIP");
}

console.log("\n=== 8. Session state service ===");
resetSession();
{
  const sid = generateSessionId();
  assert(!sessionState.isActive(), "initially inactive");
  await sessionState.start(sid);
  assert(sessionState.isActive(), "active after start");
  assert(sessionState.getSessionId() === sid, "session ID stored");
  sessionState.end();
  assert(!sessionState.isActive(), "inactive after end");
  assert(sessionState.getSessionId() === null, "session ID cleared");
}

console.log("\n=== 9. Session ID format ===");
{
  const sid = generateSessionId();
  const pattern = /^session_\d{8}_\d{6}_[a-z0-9]{6}$/;
  assert(pattern.test(sid), `format matches session_YYYYMMDD_HHMMSS_xxxxxx: ${sid}`);

  // Two IDs should be unique
  const sid2 = generateSessionId();
  assert(sid !== sid2, "IDs are unique");
}

console.log("\n=== 10. Session folder = sessionId ===");
resetSession();
{
  const testDir = "/tmp/likelion-smoke-test-clips";
  process.env.OBS_RECORDING_DIR = testDir;

  const sid = generateSessionId();
  await sessionState.start(sid);
  const folderPath = sessionState.getFolderPath();
  assert(folderPath !== null, "folder path is set");
  assert(folderPath!.endsWith(sid), `folder name equals sessionId: ${folderPath}`);
  assert(folderPath!.startsWith(testDir), "folder is under OBS_RECORDING_DIR");

  // Verify folder actually exists
  const { existsSync } = await import("node:fs");
  assert(existsSync(folderPath!), "session folder was created on disk");

  sessionState.end();
  assert(sessionState.getFolderPath() === null, "folder path cleared after end");

  // Without OBS_RECORDING_DIR, no folder
  delete process.env.OBS_RECORDING_DIR;
  await sessionState.start(generateSessionId());
  assert(sessionState.getFolderPath() === null, "no folder when OBS_RECORDING_DIR unset");
  sessionState.end();

  // Cleanup
  const { rmSync } = await import("node:fs");
  rmSync(testDir, { recursive: true, force: true });
}

console.log(`\n${"=".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}

} // end main

main();

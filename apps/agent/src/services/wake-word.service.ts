/**
 * Wake word state — tracks when "자비스" was called without a command,
 * so the next utterance is treated as a command instead of game reaction.
 */

const WAKE_WORDS = ["자비스", "쟈비스", "자바스", "쟈바스"];
const LISTEN_TIMEOUT_MS = 10_000;

let waitingForCommand = false;
let waitingTimeout: ReturnType<typeof setTimeout> | null = null;

export function detectWakeWord(transcript: string): { hasWakeWord: boolean; command: string } {
  const found = WAKE_WORDS.find((w) => transcript.includes(w));
  if (!found) return { hasWakeWord: false, command: "" };

  // Remove wake word to get the command part
  let command = transcript;
  for (const w of WAKE_WORDS) {
    command = command.replace(new RegExp(w, "g"), "");
  }
  command = command.replace(/[,.\s]+/g, " ").trim();

  return { hasWakeWord: true, command };
}

/** Check if we're waiting for a follow-up command after bare "자비스" */
export function isWaitingForCommand(): boolean {
  return waitingForCommand;
}

/** Start waiting for the follow-up command */
export function startWaiting(): void {
  waitingForCommand = true;
  if (waitingTimeout) clearTimeout(waitingTimeout);
  waitingTimeout = setTimeout(() => {
    waitingForCommand = false;
    console.log("[WakeWord] Timeout — stopped waiting for command");
  }, LISTEN_TIMEOUT_MS);
}

/** Consume the waiting state and return the command */
export function consumeWaiting(transcript: string): string {
  waitingForCommand = false;
  if (waitingTimeout) clearTimeout(waitingTimeout);
  return transcript.trim();
}

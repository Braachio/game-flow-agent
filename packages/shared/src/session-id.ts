/**
 * Generates a session ID in the format: session_YYYYMMDD_HHMMSS_{shortId}
 * This ID is also used as the session folder name.
 */
export function generateSessionId(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const shortId = Math.random().toString(36).slice(2, 8);
  return `session_${ts}_${shortId}`;
}

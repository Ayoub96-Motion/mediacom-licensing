// Per-email cap on magic-link requests, alongside the per-IP express-rate-
// limit instance in rateLimit.ts. In-memory (matches this codebase's
// existing rate limiters — no Redis/shared store here, single Node process).
//
// Deliberately does NOT reject with a 429 tied to whether the email matched
// a real customer — the counter increments for ANY submitted email string,
// registered or not, and the route always returns the same generic response
// regardless of which branch (rate-limited, no such customer, or a real
// send) actually ran. See src/routes/portalAuth.ts.

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_WINDOW = 3;

const attempts = new Map<string, number[]>();

/** Records this attempt and returns whether the email is currently under its cap (true = ok to proceed). */
export function checkAndRecordMagicLinkAttempt(email: string): boolean {
  const key = email.trim().toLowerCase();
  const now = Date.now();
  const timestamps = (attempts.get(key) ?? []).filter((t) => now - t < WINDOW_MS);

  const underCap = timestamps.length < MAX_PER_WINDOW;
  timestamps.push(now);
  attempts.set(key, timestamps);

  // Opportunistic cleanup so this Map doesn't grow unbounded over a long
  // process lifetime — cheap relative to how rarely this route is called.
  if (attempts.size > 10_000) {
    for (const [k, ts] of attempts) {
      if (ts.every((t) => now - t >= WINDOW_MS)) attempts.delete(k);
    }
  }

  return underCap;
}

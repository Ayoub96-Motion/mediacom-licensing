// Default threshold for visually flagging a license as "expiring soon" —
// matches the backend's own default window for GET /admin/licenses/expiring-soon.
export const EXPIRING_SOON_DAYS = 30;

/** Whole days from now until `expiresAt`. Negative if already past. */
export function daysUntil(expiresAt: string): number {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

/**
 * A license only counts as "expiring soon" if it actually has an expiry
 * (perpetual licenses have expiresAt: null and are never flagged) and is
 * still active — a revoked or already-expired license isn't "expiring",
 * it's just gone.
 */
export function isExpiringSoon(
  expiresAt: string | null,
  status: string,
  thresholdDays: number = EXPIRING_SOON_DAYS
): boolean {
  if (!expiresAt || status !== "active") return false;
  const days = daysUntil(expiresAt);
  return days >= 0 && days <= thresholdDays;
}

export function formatDaysUntil(expiresAt: string): string {
  const days = daysUntil(expiresAt);
  if (days < 0) return `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;
  if (days === 0) return "Expires today";
  return `Expires in ${days} day${days === 1 ? "" : "s"}`;
}

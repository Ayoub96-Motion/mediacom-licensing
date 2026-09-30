import type { Entitlements, TierPresetName } from "../types";

// Mirrors the backend's src/constants/tiers.ts exactly, for display purposes
// only (previewing what a preset expands to before submitting) — the actual
// expansion happens server-side from the tier name alone. There's no API
// endpoint exposing these (they're deliberately code constants, not DB rows,
// per the backend's own design), so this is kept in sync by hand. If you
// change one file, change the other.
export const UNLIMITED = 1_000_000;

export const TIER_PRESETS: Record<TierPresetName, Entitlements> = {
  starter: {
    maxLocations: 1,
    maxRoomsPerLocation: 6,
    maxUsers: 15,
    guestAccess: false,
    multiLocationBroadcast: false,
    whiteLabel: false,
  },
  studio: {
    maxLocations: 1,
    maxRoomsPerLocation: UNLIMITED,
    maxUsers: 50,
    guestAccess: true,
    multiLocationBroadcast: false,
    whiteLabel: false,
  },
  enterprise: {
    maxLocations: UNLIMITED,
    maxRoomsPerLocation: UNLIMITED,
    maxUsers: UNLIMITED,
    guestAccess: true,
    multiLocationBroadcast: true,
    whiteLabel: true,
  },
};

export function formatFeatureCount(n: number): string {
  return n >= UNLIMITED ? "Unlimited" : String(n);
}

export function summarizeFeatures(features: Entitlements): string {
  const parts = [
    `${formatFeatureCount(features.maxLocations)} loc`,
    `${formatFeatureCount(features.maxRoomsPerLocation)} rooms`,
    `${formatFeatureCount(features.maxUsers)} users`,
  ];
  if (features.guestAccess) parts.push("guest");
  if (features.multiLocationBroadcast) parts.push("multi-broadcast");
  if (features.whiteLabel) parts.push("white-label");
  return parts.join(" · ");
}

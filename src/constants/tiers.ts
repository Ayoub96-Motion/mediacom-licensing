export interface Entitlements {
  maxLocations: number;
  maxRoomsPerLocation: number;
  maxUsers: number;
  guestAccess: boolean;
  multiLocationBroadcast: boolean;
  whiteLabel: boolean;
}

// Sentinel for "unlimited". We use a large finite number rather than null/Infinity
// so the field stays a plain JSON number the desktop app can compare against
// directly (`count < maxUsers`) without a special-case null check.
export const UNLIMITED = 1_000_000;

export const TIER_PRESETS = {
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
} as const satisfies Record<string, Entitlements>;

export type TierPresetName = keyof typeof TIER_PRESETS;

export function isTierPresetName(value: string): value is TierPresetName {
  return value in TIER_PRESETS;
}

// Ascending order — used by meetsMinPlan() below (Phase 3 release gating) to
// answer "does this license's tier meet or exceed that minimum". Declared
// once here rather than re-deriving it from TIER_PRESETS' key order, since
// object key order isn't a contract worth relying on for this.
export const TIER_ORDER: TierPresetName[] = ["starter", "studio", "enterprise"];

/**
 * Release.minPlanCode gating (Phase 3): does a license's plan meet or exceed
 * the release's minimum? `null` minPlanCode means no restriction. A license
 * on a "custom" (non-preset) plan can only see unrestricted releases — a
 * hand-set entitlements snapshot has no defined position in TIER_ORDER, and
 * guessing one would risk over- or under-granting access.
 */
export function meetsMinPlan(licensePlanCode: string | null, minPlanCode: string | null): boolean {
  if (!minPlanCode) return true;
  if (!licensePlanCode || !isTierPresetName(licensePlanCode)) return false;
  if (!isTierPresetName(minPlanCode)) return false; // defensive — validated at write time
  return TIER_ORDER.indexOf(licensePlanCode) >= TIER_ORDER.indexOf(minPlanCode);
}

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

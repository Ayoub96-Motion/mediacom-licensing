import type { TeamSize, TierPresetName } from "../types";

// Each team-size bucket on the request-access form is exactly one preset's
// maxUsers (15 / 50 / unlimited — see constants/tiers.ts), so it maps
// straight onto a starting tier. Still just a pre-selection: the admin can
// change it in the issue-license modal.
export const TIER_FOR_TEAM_SIZE: Record<TeamSize, TierPresetName> = {
  "1-15": "starter",
  "16-50": "studio",
  "50+": "enterprise",
};

import { Router } from "express";
import { TIER_PRESETS } from "../constants/tiers";

export const adminPlansRouter = Router();

// READ-ONLY — deliberately no POST/PUT. Decision (2026-09-30): plan presets
// stay code constants, not a DB-backed resource — there's nothing to mutate
// via an API for something you edit in src/constants/tiers.ts and redeploy.
// Exists so a future admin UI can list presets (e.g. for a dropdown) without
// hardcoding them a second time in the frontend.
adminPlansRouter.get("/", (_req, res) => {
  const items = Object.entries(TIER_PRESETS).map(([code, entitlements]) => ({ code, entitlements }));
  res.json({ items });
});

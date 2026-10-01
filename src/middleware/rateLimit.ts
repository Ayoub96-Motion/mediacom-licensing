import rateLimit from "express-rate-limit";
import { errorBody } from "../lib/errors";

// Configurable so the regression script (scripts/test-licensing.js) can run
// its full, legitimate 12-call /activate sequence on staging without
// tripping the same limiter its own --rate-limit case is trying to test —
// without that, the two things fight each other every run. Production
// keeps the spec'd default (10/15min) unless explicitly overridden.
const DEVICE_ACTIVATE_RATE_LIMIT = Number(process.env.DEVICE_ACTIVATE_RATE_LIMIT ?? 10);
const DEVICE_ACTIVATE_RATE_WINDOW_MS = Number(process.env.DEVICE_ACTIVATE_RATE_WINDOW_MS ?? 15 * 60 * 1000);

// Public license endpoints (/activate, /validate) are called directly by
// customer desktop installs with no auth — rate-limit per IP to blunt abuse.
export const publicLicenseRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json(errorBody("rate_limited", "Too many requests, please try again later"));
  },
});

// Phase 1 device API: 10 req / 15 min per IP on /activate specifically (per
// spec) — tighter than the legacy limiter above since activation is the
// highest-value target for abuse (each attempt is a guess against the
// keyspace). /refresh and /deactivate use publicLicenseRateLimit above
// instead — not separately specified, but leaving them fully unthrottled
// would be an odd gap.
export const deviceActivateRateLimit = rateLimit({
  windowMs: DEVICE_ACTIVATE_RATE_WINDOW_MS,
  limit: DEVICE_ACTIVATE_RATE_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json(errorBody("rate_limited", "Too many activation attempts, please try again later"));
  },
});

// Phase 4 portal auth: per-IP cap on magic-link requests, alongside the
// per-EMAIL cap in middleware/magicLinkRateLimit.ts — this one blunts a
// single IP hammering many different email addresses, which the per-email
// cap alone wouldn't catch.
export const magicLinkIpRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json(errorBody("rate_limited", "Too many requests, please try again later"));
  },
});

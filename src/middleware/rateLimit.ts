import rateLimit from "express-rate-limit";
import { errorBody } from "../lib/errors";

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

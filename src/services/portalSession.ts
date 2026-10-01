// Customer portal session — a stateless JWT (same pattern as admin auth,
// src/middleware/adminAuth.ts) carried in an httpOnly cookie rather than an
// Authorization header, since the portal is a browser app that needs the
// browser itself to hold the credential across page loads without any JS
// ever touching it (XSS-resistant to token theft, unlike localStorage).
//
// No cookie-parser dependency: this reads exactly one cookie, which a tiny
// hand-rolled parser handles fine without pulling in a library for it.

import { createHash } from "node:crypto";
import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import { env } from "../config/env";

const COOKIE_NAME = "mc_portal_session";

function secret(): string {
  if (!env.customerSessionSecret) {
    throw new Error("CUSTOMER_SESSION_SECRET is not set — cannot issue/verify portal sessions");
  }
  return env.customerSessionSecret;
}

function parseCookies(header: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!header) return result;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    if (!key) continue;
    try {
      result[key] = decodeURIComponent(part.slice(eq + 1).trim());
    } catch {
      // malformed percent-encoding in a cookie value — ignore that cookie, not the whole header
    }
  }
  return result;
}

/**
 * `secure` is skipped only in plain local development (NODE_ENV=development)
 * — staging and production both set it, matching "httpOnly secure cookie"
 * exactly. Chrome (and other modern browsers) allow a Secure cookie over
 * plain http specifically on localhost, which is what makes local/staging
 * testing over http://localhost work at all despite this.
 */
export function issueSession(res: Response, customerId: string): void {
  const token = jwt.sign({ sub: customerId }, secret(), { expiresIn: `${env.customerSessionDays}d` });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.nodeEnv !== "development",
    sameSite: "lax",
    maxAge: env.customerSessionDays * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export function clearSession(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

/** Returns the authenticated customer's id, or null if there is no valid session — never throws. */
export function readCustomerIdFromRequest(req: Request): string | null {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, secret());
    if (typeof payload === "string" || !payload.sub) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

// ── Magic link tokens (separate from the session above) ──────────────────────
// A raw, high-entropy token is emailed to the customer; only its SHA-256 hash
// is ever persisted (src/lib/keygen.ts's hashKeyWithPepper covers license
// keys specifically and needs a pepper env var this doesn't warrant — a
// plain hash is fine here since the token itself is already high-entropy
// random bytes, not a short human-typed value).
export function hashMagicLinkToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

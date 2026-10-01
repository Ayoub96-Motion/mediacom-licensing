// Customer portal session — server-side (PortalSession table), NOT a
// stateless JWT. A security review of the first Phase 4 pass found that
// "logout" on a stateless JWT could only clear the client's copy of the
// token, never actually revoke it — the old token stayed valid until its
// 14-day expiry if replayed. This version fixes that: the cookie holds a
// raw random session token, the server holds a hashed, revocable record of
// it, and every request does a lookup.
//
// No cookie-parser dependency: this reads exactly one cookie, which a tiny
// hand-rolled parser handles fine without pulling in a library for it.

import { randomBytes, createHash } from "node:crypto";
import type { PortalSession } from "@prisma/client";
import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";

const COOKIE_NAME = "mc_portal_session";

// Throttles the lastSeenAt write — not on every single request, which would
// mean a DB write per API call for an otherwise-read-heavy portal.
const LAST_SEEN_UPDATE_INTERVAL_MS = 5 * 60 * 1000;

// Sensitive actions (reveal license key) require a session created within
// this window — an old-but-still-valid session isn't enough on its own; see
// requireFreshSession() below.
const SENSITIVE_ACTION_MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000;

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

function hashSessionToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

function readRawTokenFromRequest(req: Request): string | null {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[COOKIE_NAME] ?? null;
}

function setCookie(res: Response, rawToken: string): void {
  res.cookie(COOKIE_NAME, rawToken, {
    httpOnly: true,
    // Skipped only in plain local development — staging and production both
    // set it. Chrome (and other modern browsers) allow a Secure cookie over
    // plain http specifically on localhost, which is what makes local/
    // staging testing over http://localhost work at all despite this.
    secure: env.nodeEnv !== "development",
    sameSite: "lax",
    maxAge: env.customerSessionDays * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

/** Creates a new session row and sets the cookie. Does not touch any of the customer's other sessions — logging in on a new device is normal, not something that should silently log out others. */
export async function issueSession(res: Response, customerId: string, req: Request): Promise<void> {
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + env.customerSessionDays * 24 * 60 * 60 * 1000);

  await prisma.portalSession.create({
    data: {
      customerId,
      tokenHash,
      expiresAt,
      ip: req.ip ?? null,
      userAgent: req.headers["user-agent"]?.slice(0, 500) ?? null,
    },
  });

  setCookie(res, rawToken);
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

/** Looks up, validates, and (throttled) touches the session named by the request's cookie. Returns null for "not logged in" in every form (no cookie, unknown token, revoked, expired) — callers don't need to distinguish those. */
export async function resolvePortalSession(req: Request): Promise<PortalSession | null> {
  const rawToken = readRawTokenFromRequest(req);
  if (!rawToken) return null;

  const tokenHash = hashSessionToken(rawToken);
  const session = await prisma.portalSession.findUnique({ where: { tokenHash } });
  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;

  if (Date.now() - session.lastSeenAt.getTime() > LAST_SEEN_UPDATE_INTERVAL_MS) {
    // Best-effort — a failed lastSeenAt touch must never fail the request it
    // was piggybacking on.
    prisma.portalSession
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
      .catch((err) => console.error("[portal-session] failed to update lastSeenAt", session.id, err));
  }

  return session;
}

/** Logout: revokes the session named by the request's cookie (if any) and clears the cookie. A missing/already-invalid cookie is not an error — logout is idempotent. */
export async function revokeSessionByCookie(req: Request, res: Response): Promise<void> {
  const rawToken = readRawTokenFromRequest(req);
  clearSessionCookie(res);
  if (!rawToken) return;

  const tokenHash = hashSessionToken(rawToken);
  await prisma.portalSession.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** "Log out all devices" (self-service), and the forced-revocation path for license revoke / a future customer-deactivation feature. */
export async function revokeAllSessionsForCustomer(customerId: string): Promise<void> {
  await prisma.portalSession.updateMany({
    where: { customerId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Reveal-license-key and anything similarly sensitive: an old-but-still-valid session isn't enough on its own — require it to have been established recently, else the caller should prompt for a fresh magic link rather than silently failing. */
export function isSessionFreshEnough(session: Pick<PortalSession, "createdAt">): boolean {
  return Date.now() - session.createdAt.getTime() < SENSITIVE_ACTION_MAX_SESSION_AGE_MS;
}

// ── Magic link tokens (unrelated to the session above — separate, shorter-
// lived, single-use credential used only to establish a new session) ──────
export function hashMagicLinkToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

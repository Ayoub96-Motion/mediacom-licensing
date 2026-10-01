import { randomBytes } from "node:crypto";
import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { magicLinkIpRateLimit } from "../middleware/rateLimit";
import { checkAndRecordMagicLinkAttempt } from "../middleware/magicLinkRateLimit";
import { magicLinkRequestSchema, magicLinkVerifySchema } from "../schemas";
import { ApiError } from "../lib/errors";
import { env } from "../config/env";
import { sendMagicLinkEmail } from "../lib/email";
import { hashMagicLinkToken, issueSession, revokeSessionByCookie, revokeAllSessionsForCustomer } from "../services/portalSession";
import { requirePortalSession } from "../middleware/portalAuth";
import { logAction } from "../utils/auditLog";

export const portalAuthRouter = Router();

const GENERIC_MESSAGE = "If that email is registered, a login link has been sent.";

// POST /api/portal/auth/request-link — deliberately returns the exact same
// response whether or not the email matches a Customer (no account
// enumeration): rate-limited-and-silently-dropped, no-such-customer, and a
// real send all end at the same `res.json({ message: GENERIC_MESSAGE })`.
portalAuthRouter.post(
  "/request-link",
  magicLinkIpRateLimit,
  asyncHandler(async (req, res) => {
    const { email } = magicLinkRequestSchema.parse(req.body);

    const underCap = checkAndRecordMagicLinkAttempt(email);
    if (!underCap) {
      res.json({ message: GENERIC_MESSAGE });
      return;
    }

    const customer = await prisma.customer.findUnique({ where: { email } });
    if (!customer) {
      res.json({ message: GENERIC_MESSAGE });
      return;
    }

    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = hashMagicLinkToken(rawToken);
    const expiresAt = new Date(Date.now() + env.magicLinkTtlMinutes * 60 * 1000);

    await prisma.magicLinkToken.create({
      data: { customerId: customer.id, tokenHash, expiresAt },
    });

    // /login/verify (not /verify) renders a "Log in" button rather than
    // auto-consuming the token on page load — see the /verify handler's
    // comment below for why that distinction matters.
    const loginUrl = `${env.portalUrl}/login/verify?token=${rawToken}`;
    await sendMagicLinkEmail({ to: customer.email, loginUrl, ttlMinutes: env.magicLinkTtlMinutes });

    // Staging-only escape hatch for scripts/test-licensing.js: there is no
    // inbox to read a real magic link from in an automated run, and only the
    // token's HASH is ever persisted (by design), so the regression script
    // has no other way to obtain it. Gated on NODE_ENV==='staging' AND this
    // separate opt-in var (never set in production) — same pattern as
    // DEVICE_ACTIVATE_RATE_LIMIT's staging-only override in rateLimit.ts.
    const debugToken =
      env.nodeEnv === "staging" && process.env.TEST_EXPOSE_MAGIC_LINK === "1" ? rawToken : undefined;

    res.json({ message: GENERIC_MESSAGE, ...(debugToken ? { debugToken } : {}) });
  })
);

// POST /api/portal/auth/verify — single-use. This endpoint is the ONLY
// place a magic-link token is ever consumed; the portal's /login/verify page
// itself (a plain client-side route render, no API call) does not touch it
// — see portal/src/pages/VerifyPage.tsx. That split exists for two reasons:
// an email security scanner pre-fetching the emailed link (a GET, and this
// is a POST-only route anyway) must not burn the token before the real
// customer clicks it, and a page-load side effect calling this endpoint
// directly (the previous design) breaks under React StrictMode's
// intentional double-invoke of effects in development — confirmed live via
// Playwright: a single page load fired two real POSTs here.
//
// The claim itself is a single atomic conditional UPDATE (updateMany with
// usedAt: null and expiresAt in the future in the WHERE clause), not a
// separate findUnique-then-update — the previous two-step version had a
// real TOCTOU race: two concurrent requests for the same token could both
// pass the "not yet used" check before either write committed, each then
// issuing its own session for a token meant to be single-use. Confirmed
// live: two near-simultaneous requests for one fresh token both returned
// 200 with distinct sessions before this fix.
portalAuthRouter.post(
  "/verify",
  asyncHandler(async (req, res) => {
    const { token } = magicLinkVerifySchema.parse(req.body);
    const tokenHash = hashMagicLinkToken(token);

    const claim = await prisma.magicLinkToken.updateMany({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (claim.count === 0) {
      throw new ApiError(403, "TOKEN_INVALID", "This login link is invalid, already used, or has expired");
    }

    const record = await prisma.magicLinkToken.findUnique({ where: { tokenHash } });
    const customer = record ? await prisma.customer.findUnique({ where: { id: record.customerId } }) : null;
    if (!customer) {
      // Shouldn't happen (FK), but a deleted customer between request and
      // verify is a real possibility over a 15-minute window.
      throw new ApiError(403, "TOKEN_INVALID", "This login link is no longer valid");
    }

    await issueSession(res, customer.id, req);

    await logAction({
      actorType: "customer",
      action: "customer.login",
      targetType: "Customer",
      targetId: customer.id,
      metadata: {},
    });

    res.json({ customer: { id: customer.id, name: customer.name, email: customer.email } });
  })
);

// Revokes the session server-side (not just a clear-cookie response) — see
// src/services/portalSession.ts's header comment on why this matters.
// Idempotent: no cookie / an already-invalid one is not an error.
portalAuthRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    await revokeSessionByCookie(req, res);
    res.json({ success: true });
  })
);

// Self-service "log out everywhere" — revokes every non-revoked session for
// this customer, not just the one making the request.
portalAuthRouter.post(
  "/logout-all",
  requirePortalSession,
  asyncHandler(async (req, res) => {
    await revokeAllSessionsForCustomer(req.customerId!);
    await revokeSessionByCookie(req, res); // also clears the cookie on this device
    res.json({ success: true });
  })
);

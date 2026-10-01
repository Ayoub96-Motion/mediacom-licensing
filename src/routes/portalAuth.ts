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
import { hashMagicLinkToken, issueSession, clearSession } from "../services/portalSession";
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

    const loginUrl = `${env.portalUrl}/verify?token=${rawToken}`;
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

// POST /api/portal/auth/verify — single-use: usedAt is set the moment this
// succeeds, so a replayed (stolen-from-logs, re-clicked) link is rejected on
// its second use even if still within its TTL.
portalAuthRouter.post(
  "/verify",
  asyncHandler(async (req, res) => {
    const { token } = magicLinkVerifySchema.parse(req.body);
    const tokenHash = hashMagicLinkToken(token);

    const record = await prisma.magicLinkToken.findUnique({ where: { tokenHash } });
    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      throw new ApiError(403, "TOKEN_INVALID", "This login link is invalid, already used, or has expired");
    }

    await prisma.magicLinkToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });

    const customer = await prisma.customer.findUnique({ where: { id: record.customerId } });
    if (!customer) {
      // Shouldn't happen (FK), but a deleted customer between request and
      // verify is a real possibility over a 15-minute window.
      throw new ApiError(403, "TOKEN_INVALID", "This login link is no longer valid");
    }

    issueSession(res, customer.id);

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

portalAuthRouter.post(
  "/logout",
  asyncHandler(async (_req, res) => {
    clearSession(res);
    res.json({ success: true });
  })
);

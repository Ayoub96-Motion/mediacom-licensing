// Phase 1 device activation API. Separate router, NO admin auth (called
// directly by customer installs, same trust model as the old /activate and
// /validate) — see src/routes/public.ts for those, now a deprecated shim
// sharing the lookup/locking/device-limit logic in
// src/services/deviceActivation.ts but signing with the OLD keypair/format
// for backward compat with intercom-app's existing callers.

import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { deviceActivateRateLimit, publicLicenseRateLimit } from "../middleware/rateLimit";
import { deviceActivateSchema, deviceTokenSchema } from "../schemas";
import { ApiError } from "../lib/errors";
import { hashKeyWithPepper } from "../lib/keygen";
import { hashFingerprint } from "../lib/fingerprint";
import { activateOrReuseDevice, resolveLicenseByIdForUpdate, resolveLicenseForUpdate, resolvePlanCode } from "../services/deviceActivation";
import { buildLicensePayload, getPublicKeyPem, signLicense, verifyLicense } from "../services/licenseSigner";
import { logAction } from "../utils/auditLog";

export const apiDeviceRouter = Router();

apiDeviceRouter.post(
  "/activate",
  deviceActivateRateLimit,
  asyncHandler(async (req, res) => {
    const { key, fingerprint, machineName, appVersion } = deviceActivateSchema.parse(req.body);
    const keyHash = hashKeyWithPepper(key);
    const fingerprintHash = hashFingerprint(fingerprint);

    const { license, device } = await prisma.$transaction(async (tx) => {
      const license = await resolveLicenseForUpdate(tx, keyHash);
      const { device } = await activateOrReuseDevice({
        tx,
        licenseId: license.id,
        deviceLimit: license.deviceLimit,
        fingerprintHash,
        machineName,
        appVersion,
      });
      return { license, device };
    });

    const payload = buildLicensePayload({
      licenseId: license.id,
      customerId: license.customerId,
      plan: resolvePlanCode(license.planCode),
      entitlements: license.features,
      fingerprintHash,
      expiresAt: license.expiresAt,
    });
    const token = signLicense(payload);

    await logAction({
      actorType: "device",
      action: "device.activate",
      targetType: "Device",
      targetId: device.id,
      metadata: { licenseId: license.id, machineName, appVersion },
    });

    res.json({ license: token });
  })
);

apiDeviceRouter.post(
  "/refresh",
  publicLicenseRateLimit,
  asyncHandler(async (req, res) => {
    const { token } = deviceTokenSchema.parse(req.body);
    const verify = verifyLicense(token, getPublicKeyPem());
    if (!verify.valid || !verify.payload) {
      throw new ApiError(403, "TOKEN_INVALID", "This token is not valid");
    }
    const { licenseId, fingerprintHash } = verify.payload;

    const { license, device } = await prisma.$transaction(async (tx) => {
      // Re-fetch current state — never trust the token's embedded snapshot
      // for anything status/entitlement-related, only for identifying which
      // license/device this is about. Looked up by id (a token carries no
      // raw key, by design), same status/expiry rules as /activate.
      const license = await resolveLicenseByIdForUpdate(tx, licenseId);

      const device = await tx.device.findUnique({
        where: { licenseId_fingerprintHash: { licenseId, fingerprintHash } },
      });
      if (!device || device.deactivatedAt) {
        throw new ApiError(403, "ACTIVATION_NOT_FOUND", "This device is not an active activation of this license");
      }

      await tx.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });

      return { license, device };
    });

    const newPayload = buildLicensePayload({
      licenseId: license.id,
      customerId: license.customerId,
      plan: resolvePlanCode(license.planCode),
      entitlements: license.features,
      fingerprintHash,
      expiresAt: license.expiresAt,
    });
    const newToken = signLicense(newPayload);

    await logAction({
      actorType: "device",
      action: "device.refresh",
      targetType: "Device",
      targetId: device.id,
      metadata: { licenseId: license.id },
    });

    res.json({ license: newToken });
  })
);

apiDeviceRouter.post(
  "/deactivate",
  publicLicenseRateLimit,
  asyncHandler(async (req, res) => {
    const { token } = deviceTokenSchema.parse(req.body);
    const verify = verifyLicense(token, getPublicKeyPem());
    if (!verify.valid || !verify.payload) {
      throw new ApiError(403, "TOKEN_INVALID", "This token is not valid");
    }
    const { licenseId, fingerprintHash } = verify.payload;

    const device = await prisma.device.findUnique({
      where: { licenseId_fingerprintHash: { licenseId, fingerprintHash } },
    });
    if (!device || device.deactivatedAt) {
      throw new ApiError(403, "ACTIVATION_NOT_FOUND", "This device is not an active activation of this license");
    }

    await prisma.device.update({ where: { id: device.id }, data: { deactivatedAt: new Date() } });

    await logAction({
      actorType: "device",
      action: "device.deactivate",
      targetType: "Device",
      targetId: device.id,
      metadata: { licenseId },
    });

    res.json({ success: true });
  })
);

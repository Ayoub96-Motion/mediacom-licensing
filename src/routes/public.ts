// DEPRECATED — kept only for backward compatibility with
// intercom-app/server-manager/main.js's existing callLicensingApi('/activate'/
// '/validate') calls (confirmed via grep, 2026-09-30 Step 0). Do NOT add new
// callers of these two routes; new integrations should use /api/device/*
// (src/routes/apiDevice.ts).
//
// These now share the SAME lookup/locking/device-limit logic as the new
// device API (src/services/deviceActivation.ts — peppered key hash, hashed
// fingerprint lookup) but still sign responses with the OLD @noble/ed25519
// keypair/format (src/lib/signing.ts, {payload, payloadRaw, signature}) —
// NOT the new node:crypto-based signer. This is deliberate: intercom-app's
// licenseVerify.js has the OLD public key hardcoded and would reject tokens
// from the new signer outright. Forwarding to the *new* signing logic here
// would silently break the currently-working Electron app — the opposite of
// what a compat shim is for.
//
// Consequence of switching the lookup to hashed fingerprints: any device
// activated before this change (raw fingerprint stored, fingerprintHash
// null) will no longer match on /validate and will need to re-activate —
// same "no dual-lookup, existing data is being reissued on staging"
// principle as the license key hash change (2026-09-30 decision 3).
//
// TODO(remove-after-electron-migrates): once intercom-app is updated to call
// /api/device/* directly (Phase 2), delete this file, the `fingerprint` and
// `label` columns on Device, and src/lib/signing.ts.

import { Router } from "express";
import { prisma } from "../lib/prisma";
import { hashKeyWithPepper } from "../lib/keygen";
import { hashFingerprint } from "../lib/fingerprint";
import { signLicenseToken } from "../lib/signing";
import { asyncHandler } from "../middleware/errorHandler";
import { publicLicenseRateLimit } from "../middleware/rateLimit";
import { activateSchema, validateSchema } from "../schemas";
import { ApiError } from "../lib/errors";
import { activateOrReuseDevice, resolveLicenseForUpdate, type LicenseRow } from "../services/deviceActivation";
import { logAction } from "../utils/auditLog";

export const publicRouter = Router();

function buildTokenResponse(license: LicenseRow, deviceFingerprint: string) {
  return signLicenseToken({
    licenseId: license.id,
    customerId: license.customerId,
    type: license.type,
    expiresAt: license.expiresAt ? license.expiresAt.toISOString() : null,
    status: license.status,
    features: license.features,
    deviceFingerprint,
  });
}

publicRouter.post(
  "/activate",
  publicLicenseRateLimit,
  asyncHandler(async (req, res) => {
    const { key, deviceFingerprint, deviceLabel } = activateSchema.parse(req.body);
    const keyHash = hashKeyWithPepper(key);
    const fingerprintHash = hashFingerprint(deviceFingerprint);

    const { license, device } = await prisma.$transaction(async (tx) => {
      const license = await resolveLicenseForUpdate(tx, keyHash);
      const { device } = await activateOrReuseDevice({
        tx,
        licenseId: license.id,
        deviceLimit: license.deviceLimit,
        fingerprintHash,
        rawFingerprint: deviceFingerprint,
        label: deviceLabel,
      });
      return { license, device };
    });

    await logAction({
      actorType: "device",
      action: "device.activate",
      targetType: "Device",
      targetId: device.id,
      metadata: { licenseId: license.id, viaLegacyShim: true },
    });

    res.json(buildTokenResponse(license, deviceFingerprint));
  })
);

publicRouter.post(
  "/validate",
  publicLicenseRateLimit,
  asyncHandler(async (req, res) => {
    const { key, deviceFingerprint } = validateSchema.parse(req.body);
    const keyHash = hashKeyWithPepper(key);
    const fingerprintHash = hashFingerprint(deviceFingerprint);

    const { license, device } = await prisma.$transaction(async (tx) => {
      const license = await resolveLicenseForUpdate(tx, keyHash);

      // Unlike /activate, /validate never creates a device row — an
      // unrecognized fingerprint here is rejected, not registered.
      const existingDevice = await tx.device.findUnique({
        where: { licenseId_fingerprintHash: { licenseId: license.id, fingerprintHash } },
      });
      if (!existingDevice || existingDevice.deactivatedAt) {
        throw new ApiError(
          403,
          "DEVICE_NOT_REGISTERED",
          "This device has not been activated for this license. Use /activate first."
        );
      }

      const device = await tx.device.update({
        where: { id: existingDevice.id },
        data: { lastSeenAt: new Date() },
      });
      return { license, device };
    });

    await logAction({
      actorType: "device",
      action: "device.refresh",
      targetType: "Device",
      targetId: device.id,
      metadata: { licenseId: license.id, viaLegacyShim: true },
    });

    res.json(buildTokenResponse(license, deviceFingerprint));
  })
);

import { Router } from "express";
import type { License } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { hashKey } from "../lib/keygen";
import { signLicenseToken } from "../lib/signing";
import { asyncHandler } from "../middleware/errorHandler";
import { publicLicenseRateLimit } from "../middleware/rateLimit";
import { activateSchema, validateSchema } from "../schemas";
import { ApiError } from "../lib/errors";
import type { Entitlements } from "../constants/tiers";

export const publicRouter = Router();

/** Looks up a license by raw key, expiring it in-place if past expiresAt. Throws on not-found/inactive. */
async function resolveActiveLicense(rawKey: string): Promise<License> {
  const keyHash = hashKey(rawKey);
  const license = await prisma.license.findFirst({ where: { keyHash } });

  if (!license) {
    throw new ApiError(404, "license_not_found", "No license matches this key");
  }

  if (license.status === "revoked") {
    throw new ApiError(403, "license_revoked", "This license has been revoked");
  }

  const isPastExpiry = license.expiresAt !== null && license.expiresAt.getTime() < Date.now();

  if (license.status === "expired" || isPastExpiry) {
    if (license.status !== "expired") {
      await prisma.license.update({ where: { id: license.id }, data: { status: "expired" } });
    }
    throw new ApiError(403, "license_expired", "This license has expired");
  }

  return license;
}

function buildTokenResponse(license: License, deviceFingerprint: string) {
  const token = signLicenseToken({
    licenseId: license.id,
    customerId: license.customerId,
    type: license.type,
    expiresAt: license.expiresAt ? license.expiresAt.toISOString() : null,
    status: license.status,
    features: license.features as unknown as Entitlements,
    deviceFingerprint,
  });
  return token;
}

publicRouter.post(
  "/activate",
  publicLicenseRateLimit,
  asyncHandler(async (req, res) => {
    const { key, deviceFingerprint, deviceLabel } = activateSchema.parse(req.body);

    const license = await resolveActiveLicense(key);

    const existingDevice = await prisma.device.findUnique({
      where: { licenseId_fingerprint: { licenseId: license.id, fingerprint: deviceFingerprint } },
    });

    if (existingDevice) {
      await prisma.device.update({
        where: { id: existingDevice.id },
        data: { lastSeenAt: new Date() },
      });
      res.json(buildTokenResponse(license, deviceFingerprint));
      return;
    }

    const activeDeviceCount = await prisma.device.count({ where: { licenseId: license.id } });
    if (activeDeviceCount >= license.deviceLimit) {
      throw new ApiError(
        403,
        "device_limit_reached",
        `This license allows at most ${license.deviceLimit} device(s). Deactivate a device before activating a new one.`
      );
    }

    await prisma.device.create({
      data: {
        licenseId: license.id,
        fingerprint: deviceFingerprint,
        label: deviceLabel,
      },
    });

    res.json(buildTokenResponse(license, deviceFingerprint));
  })
);

publicRouter.post(
  "/validate",
  publicLicenseRateLimit,
  asyncHandler(async (req, res) => {
    const { key, deviceFingerprint } = validateSchema.parse(req.body);

    const license = await resolveActiveLicense(key);

    const existingDevice = await prisma.device.findUnique({
      where: { licenseId_fingerprint: { licenseId: license.id, fingerprint: deviceFingerprint } },
    });

    if (!existingDevice) {
      throw new ApiError(
        403,
        "device_not_registered",
        "This device has not been activated for this license. Use /activate first."
      );
    }

    await prisma.device.update({
      where: { id: existingDevice.id },
      data: { lastSeenAt: new Date() },
    });

    res.json(buildTokenResponse(license, deviceFingerprint));
  })
);

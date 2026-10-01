import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { ApiError, paramId } from "../lib/errors";
import { decryptKey } from "../lib/keyEncryption";
import { isSessionFreshEnough } from "../services/portalSession";
import { logAction } from "../utils/auditLog";

export const portalAccountRouter = Router();

// GET /api/portal/me — customer info + a summary of every license they own.
// The raw key is never included here — only whether one is available to
// reveal (keyEncrypted may be null for licenses issued before Phase 1).
portalAccountRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const customer = await prisma.customer.findUnique({ where: { id: req.customerId! } });
    if (!customer) {
      throw new ApiError(404, "customer_not_found", "Customer not found");
    }

    const licenses = await prisma.license.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { devices: { where: { deactivatedAt: null } } } } },
    });

    res.json({
      customer: { id: customer.id, name: customer.name, email: customer.email },
      licenses: licenses.map((lic) => ({
        id: lic.id,
        planCode: lic.planCode,
        type: lic.type,
        status: lic.status,
        deviceLimit: lic.deviceLimit,
        activeDeviceCount: lic._count.devices,
        expiresAt: lic.expiresAt,
        features: lic.features,
        keyAvailable: lic.keyEncrypted !== null,
      })),
    });
  })
);

/** Throws 404 unless the given license both exists and belongs to the authenticated customer — every route below needs exactly this check. */
async function requireOwnedLicense(licenseId: string, customerId: string) {
  const license = await prisma.license.findUnique({ where: { id: licenseId } });
  if (!license || license.customerId !== customerId) {
    // Same 404 for "doesn't exist" and "belongs to someone else" — doesn't
    // confirm to a logged-in customer that a given license id exists at all.
    throw new ApiError(404, "license_not_found", "License not found");
  }
  return license;
}

portalAccountRouter.post(
  "/licenses/:id/reveal-key",
  asyncHandler(async (req, res) => {
    // Sensitive action — an old-but-still-valid session isn't enough on its
    // own, so a long-lived session (up to 14 days) can't be used to reveal a
    // key weeks after the customer actually logged in. req.portalSession is
    // always set here (this route is mounted behind requirePortalSession).
    if (!isSessionFreshEnough(req.portalSession!)) {
      throw new ApiError(
        403,
        "REAUTH_REQUIRED",
        "For your security, please log in again to reveal this key — request a new login link."
      );
    }

    const licenseId = paramId(req, "id");
    const license = await requireOwnedLicense(licenseId, req.customerId!);

    if (!license.keyEncrypted) {
      throw new ApiError(409, "KEY_NOT_AVAILABLE", "This license predates key storage and cannot be revealed — contact support");
    }

    const rawKey = decryptKey(license.keyEncrypted);

    await logAction({
      actorType: "customer",
      action: "customer.license.reveal_key",
      targetType: "License",
      targetId: license.id,
      metadata: {},
    });

    res.json({ rawKey });
  })
);

portalAccountRouter.get(
  "/licenses/:id/devices",
  asyncHandler(async (req, res) => {
    const licenseId = paramId(req, "id");
    await requireOwnedLicense(licenseId, req.customerId!);

    const devices = await prisma.device.findMany({ where: { licenseId }, orderBy: { activatedAt: "desc" } });
    const active = devices.filter((d) => d.deactivatedAt === null);
    const deactivated = devices.filter((d) => d.deactivatedAt !== null);
    const items = [...active, ...deactivated].map((d) => ({
      ...d,
      status: d.deactivatedAt === null ? ("active" as const) : ("deactivated" as const),
    }));

    res.json({ items, activeCount: active.length });
  })
);

const SELF_DEACTIVATE_LIMIT = 3;
const SELF_DEACTIVATE_WINDOW_DAYS = 30;

portalAccountRouter.post(
  "/licenses/:id/devices/:deviceId/deactivate",
  asyncHandler(async (req, res) => {
    const licenseId = paramId(req, "id");
    const deviceId = paramId(req, "deviceId");
    await requireOwnedLicense(licenseId, req.customerId!);

    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device || device.licenseId !== licenseId) {
      throw new ApiError(404, "device_not_found", "Device not found on this license");
    }
    if (device.deactivatedAt) {
      throw new ApiError(409, "ALREADY_DEACTIVATED", "This device is already deactivated");
    }

    // Caps self-service deactivation at 3 per license per rolling 30 days —
    // prevents a customer from rotating a single-seat license across many
    // machines by repeatedly deactivating and reactivating. The audit log is
    // the source of truth for this count rather than a dedicated counter
    // column/table: it's already written on every deactivation, at portal
    // volumes a COUNT over an indexed (targetType, targetId) + createdAt
    // range is cheap, and it stays correct with zero extra bookkeeping.
    const windowStart = new Date(Date.now() - SELF_DEACTIVATE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const recentCount = await prisma.auditLog.count({
      where: {
        action: "customer.device.deactivate",
        targetType: "License",
        targetId: licenseId,
        createdAt: { gte: windowStart },
      },
    });
    if (recentCount >= SELF_DEACTIVATE_LIMIT) {
      throw new ApiError(
        429,
        "SELF_DEACTIVATE_LIMIT",
        `You can only deactivate up to ${SELF_DEACTIVATE_LIMIT} devices per ${SELF_DEACTIVATE_WINDOW_DAYS} days on this license. Contact support for further changes.`
      );
    }

    const updated = await prisma.device.update({ where: { id: deviceId }, data: { deactivatedAt: new Date() } });

    // Logged against the LICENSE (not the device) as targetType/targetId so
    // the COUNT query above can key on the same (targetType, targetId) pair
    // across repeated deactivations of different devices on the same license.
    await logAction({
      actorType: "customer",
      action: "customer.device.deactivate",
      targetType: "License",
      targetId: licenseId,
      metadata: { deviceId: updated.id },
    });

    res.json(updated);
  })
);

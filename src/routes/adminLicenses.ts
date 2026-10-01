import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { createLicenseSchema, expiringSoonQuerySchema, listAuditLogQuerySchema, listLicensesQuerySchema, updateLicenseSchema } from "../schemas";
import { ApiError, paramId } from "../lib/errors";
import { generateRawKeyV2, hashKeyWithPepper } from "../lib/keygen";
import { encryptKey } from "../lib/keyEncryption";
import { TIER_PRESETS } from "../constants/tiers";
import { sendLicenseEmail } from "../lib/email";
import { logAction } from "../utils/auditLog";
import { buildLicenseWhere } from "../utils/licenseQuery";
import { queryAuditLog } from "./adminAuditLog";
import { revokeAllSessionsForCustomer } from "../services/portalSession";

export const adminLicensesRouter = Router();

adminLicensesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = createLicenseSchema.parse(req.body);

    const customer = await prisma.customer.findUnique({ where: { id: data.customerId } });
    if (!customer) {
      throw new ApiError(404, "customer_not_found", "Customer not found");
    }

    const features = data.tier ? TIER_PRESETS[data.tier] : data.features!;
    const planCode = data.tier ?? "custom";

    // Generate the raw key and retry on the astronomically unlikely event of
    // a keyHash collision (see generateRawKeyV2's doc comment for the math).
    // keyHash is now HMAC-SHA256 with LICENSE_KEY_PEPPER (Phase 1, 2026-09-30
    // decision 3) — this is what /api/device/activate looks up by.
    let rawKey = generateRawKeyV2();
    let keyHash = hashKeyWithPepper(rawKey);
    for (let attempt = 0; attempt < 3; attempt++) {
      const existing = await prisma.license.findFirst({ where: { keyHash } });
      if (!existing) break;
      rawKey = generateRawKeyV2();
      keyHash = hashKeyWithPepper(rawKey);
    }

    const license = await prisma.license.create({
      data: {
        customerId: data.customerId,
        keyHash,
        keyEncrypted: encryptKey(rawKey),
        planCode,
        type: data.type,
        deviceLimit: data.deviceLimit,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        features,
      },
    });

    await sendLicenseEmail({
      to: customer.email,
      customerName: customer.name,
      rawKey,
      tier: data.tier,
      deviceLimit: license.deviceLimit,
      expiresAt: license.expiresAt ? license.expiresAt.toISOString() : null,
    });

    // Never the raw key — only what tier/features were issued, and to whom.
    await logAction({
      adminId: req.admin!.sub,
      action: "license.create",
      targetType: "License",
      targetId: license.id,
      metadata: {
        customerId: customer.id,
        tier: data.tier ?? "custom",
        features,
        deviceLimit: license.deviceLimit,
        type: license.type,
        expiresAt: license.expiresAt,
      },
    });

    // IMPORTANT: this is the ONLY time the raw key is ever retrievable.
    // Only its SHA-256 hash is persisted — there is no "show key again" endpoint.
    res.status(201).json({
      license,
      rawKey,
      warning: "This is the only time the raw license key will be shown. It has also been emailed to the customer.",
    });
  })
);

adminLicensesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { customerId, status, type, expiringWithinDays, page, pageSize } = listLicensesQuerySchema.parse(req.query);

    const where = buildLicenseWhere({ customerId, status, type, expiringWithinDays });

    const [items, total] = await Promise.all([
      prisma.license.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: { customer: true },
      }),
      prisma.license.count({ where }),
    ]);

    res.json({ items, page, pageSize, total });
  })
);

// Dashboard summary count — how many active, expiry-dated licenses fall
// within the given window. Registered before "/:id" so "expiring-soon"
// isn't swallowed as a license id.
adminLicensesRouter.get(
  "/expiring-soon",
  asyncHandler(async (req, res) => {
    const { withinDays } = expiringSoonQuerySchema.parse(req.query);
    const where = buildLicenseWhere({ status: "expiring_soon", expiringWithinDays: withinDays });
    const count = await prisma.license.count({ where });
    res.json({ count, withinDays });
  })
);

adminLicensesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const license = await prisma.license.findUnique({
      where: { id: paramId(req, "id") },
      include: { customer: true, devices: true },
    });
    if (!license) {
      throw new ApiError(404, "license_not_found", "License not found");
    }
    res.json(license);
  })
);

adminLicensesRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = updateLicenseSchema.parse(req.body);
    const id = paramId(req, "id");

    const existing = await prisma.license.findUnique({ where: { id } });
    if (!existing) {
      throw new ApiError(404, "license_not_found", "License not found");
    }

    const license = await prisma.license.update({
      where: { id },
      data: {
        ...(data.features ? { features: data.features } : {}),
        ...(data.deviceLimit !== undefined ? { deviceLimit: data.deviceLimit } : {}),
        ...(data.expiresAt !== undefined ? { expiresAt: data.expiresAt ? new Date(data.expiresAt) : null } : {}),
        ...(data.type ? { type: data.type } : {}),
      },
    });

    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    if (data.features !== undefined) { before.features = existing.features; after.features = license.features; }
    if (data.deviceLimit !== undefined) { before.deviceLimit = existing.deviceLimit; after.deviceLimit = license.deviceLimit; }
    if (data.expiresAt !== undefined) { before.expiresAt = existing.expiresAt; after.expiresAt = license.expiresAt; }
    if (data.type !== undefined) { before.type = existing.type; after.type = license.type; }

    await logAction({
      adminId: req.admin!.sub,
      action: "license.update",
      targetType: "License",
      targetId: license.id,
      metadata: { before, after },
    });

    res.json(license);
  })
);

adminLicensesRouter.post(
  "/:id/revoke",
  asyncHandler(async (req, res) => {
    const id = paramId(req, "id");
    const existing = await prisma.license.findUnique({ where: { id } });
    if (!existing) {
      throw new ApiError(404, "license_not_found", "License not found");
    }

    const license = await prisma.license.update({
      where: { id },
      data: { status: "revoked" },
    });

    // Revoking a license revokes the customer's portal sessions too — a
    // customer who still has a live session shouldn't keep portal access
    // (devices, downloads, the now-revoked key) just because their cookie
    // hasn't expired yet. Revokes ALL of their sessions, not just ones tied
    // to this specific license — simplest correct behavior given a session
    // isn't scoped to one license.
    await revokeAllSessionsForCustomer(license.customerId);

    await logAction({
      adminId: req.admin!.sub,
      action: "license.revoke",
      targetType: "License",
      targetId: license.id,
      metadata: { previousStatus: existing.status },
    });

    res.json(license);
  })
);

adminLicensesRouter.delete(
  "/:id/devices/:deviceId",
  asyncHandler(async (req, res) => {
    const licenseId = paramId(req, "id");
    const deviceId = paramId(req, "deviceId");
    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device || device.licenseId !== licenseId) {
      throw new ApiError(404, "device_not_found", "Device not found for this license");
    }

    await prisma.device.delete({ where: { id: device.id } });

    await logAction({
      adminId: req.admin!.sub,
      action: "device.deactivate",
      targetType: "Device",
      targetId: device.id,
      metadata: { licenseId, fingerprint: device.fingerprint, label: device.label, method: "hard_delete" },
    });

    res.status(204).send();
  })
);

adminLicensesRouter.get(
  "/:id/audit-log",
  asyncHandler(async (req, res) => {
    const { page, pageSize } = listAuditLogQuerySchema.parse(req.query);
    const id = paramId(req, "id");
    // A license's activity includes actions directly on it (create/update/
    // revoke) AND device.deactivate entries for its devices — those target
    // the Device, not the License, but an admin viewing a license's history
    // reasonably expects "device X was deactivated" to show up here too.
    res.json(
      await queryAuditLog(
        {
          OR: [
            { targetType: "License", targetId: id },
            // MySQL's Prisma JSON filter takes `path` as a single MySQL
            // JSON-path-expression string (must start with "$"), not the
            // array-of-segments shape Postgres uses.
            { targetType: "Device", metadata: { path: "$.licenseId", equals: id } },
          ],
        },
        page,
        pageSize
      )
    );
  })
);

// Step 4: distinct from GET /admin/licenses/:id's own `devices` array — this
// explicitly surfaces deactivatedAt (soft-delete state) per row, so an admin
// can see activation HISTORY (including soft-deactivated ones), not just the
// current live set. Named "activations" to match the new Phase 1
// vocabulary; the underlying table is still Device (see Step 1's reasoning
// for not renaming it).
adminLicensesRouter.get(
  "/:id/activations",
  asyncHandler(async (req, res) => {
    const licenseId = paramId(req, "id");
    const license = await prisma.license.findUnique({ where: { id: licenseId } });
    if (!license) {
      throw new ApiError(404, "license_not_found", "License not found");
    }

    const devices = await prisma.device.findMany({
      where: { licenseId },
      orderBy: { activatedAt: "desc" },
    });

    // Active first, then deactivated — each group keeps its activatedAt-desc
    // order from the query above. Derived `status` (not a stored column)
    // matches the literal string the frontend's Badge component and
    // license.status already key off elsewhere.
    const active = devices.filter((d) => d.deactivatedAt === null);
    const deactivated = devices.filter((d) => d.deactivatedAt !== null);
    const items = [...active, ...deactivated].map((d) => ({
      ...d,
      status: d.deactivatedAt === null ? ("active" as const) : ("deactivated" as const),
    }));

    res.json({ items, activeCount: active.length });
  })
);

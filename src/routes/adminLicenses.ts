import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { createLicenseSchema, listLicensesQuerySchema, updateLicenseSchema } from "../schemas";
import { ApiError, paramId } from "../lib/errors";
import { generateRawKey, hashKey } from "../lib/keygen";
import { TIER_PRESETS } from "../constants/tiers";
import { sendLicenseEmail } from "../lib/email";

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

    // Generate the raw key and retry on the astronomically unlikely event of
    // a keyHash collision (see generateRawKey's doc comment for the math).
    let rawKey = generateRawKey();
    let keyHash = hashKey(rawKey);
    for (let attempt = 0; attempt < 3; attempt++) {
      const existing = await prisma.license.findFirst({ where: { keyHash } });
      if (!existing) break;
      rawKey = generateRawKey();
      keyHash = hashKey(rawKey);
    }

    const license = await prisma.license.create({
      data: {
        customerId: data.customerId,
        keyHash,
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
    const { customerId, status, type, page, pageSize } = listLicensesQuerySchema.parse(req.query);

    const where = {
      ...(customerId ? { customerId } : {}),
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
    };

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

    res.json(license);
  })
);

adminLicensesRouter.delete(
  "/:id/devices/:deviceId",
  asyncHandler(async (req, res) => {
    const device = await prisma.device.findUnique({ where: { id: paramId(req, "deviceId") } });
    if (!device || device.licenseId !== paramId(req, "id")) {
      throw new ApiError(404, "device_not_found", "Device not found for this license");
    }

    await prisma.device.delete({ where: { id: device.id } });

    res.status(204).send();
  })
);

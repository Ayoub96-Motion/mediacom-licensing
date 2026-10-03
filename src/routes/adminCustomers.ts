import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { createCustomerSchema, listAuditLogQuerySchema, listCustomersQuerySchema, updateCustomerSchema } from "../schemas";
import { ApiError, paramId } from "../lib/errors";
import { logAction } from "../utils/auditLog";
import { queryAuditLog } from "./adminAuditLog";

export const adminCustomersRouter = Router();

adminCustomersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = createCustomerSchema.parse(req.body);
    const customer = await prisma.customer.create({ data });

    await logAction({
      adminId: req.admin!.sub,
      action: "customer.create",
      targetType: "Customer",
      targetId: customer.id,
      metadata: { name: customer.name, email: customer.email, company: customer.company },
    });

    res.status(201).json(customer);
  })
);

adminCustomersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { q, status, page, pageSize } = listCustomersQuerySchema.parse(req.query);

    const where = {
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
              { company: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { licenses: true } } },
      }),
      prisma.customer.count({ where }),
    ]);

    // Flatten Prisma's _count wrapper into a plain licenseCount field —
    // consumers shouldn't need to know Prisma's aggregation shape.
    const items = rows.map(({ _count, ...customer }) => ({
      ...customer,
      licenseCount: _count.licenses,
    }));

    res.json({ items, page, pageSize, total });
  })
);

adminCustomersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const customer = await prisma.customer.findUnique({
      where: { id: paramId(req, "id") },
      include: { licenses: true },
    });
    if (!customer) {
      throw new ApiError(404, "customer_not_found", "Customer not found");
    }
    res.json(customer);
  })
);

adminCustomersRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = updateCustomerSchema.parse(req.body);
    const id = paramId(req, "id");

    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      throw new ApiError(404, "customer_not_found", "Customer not found");
    }

    const customer = await prisma.customer.update({ where: { id }, data });

    // Only the fields actually present in the request body, before/after —
    // not the whole record, so the diff stays meaningful even years later.
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    for (const key of Object.keys(data) as (keyof typeof data)[]) {
      before[key] = existing[key];
      after[key] = customer[key];
    }

    await logAction({
      adminId: req.admin!.sub,
      action: "customer.update",
      targetType: "Customer",
      targetId: customer.id,
      metadata: { before, after },
    });

    res.json(customer);
  })
);

// All devices across every license this customer holds, in one call — the
// per-license device list already exists on GET /admin/licenses/:id, but
// there was no cross-license view for a customer with multiple licenses.
adminCustomersRouter.get(
  "/:id/devices",
  asyncHandler(async (req, res) => {
    const id = paramId(req, "id");

    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      throw new ApiError(404, "customer_not_found", "Customer not found");
    }

    const licenses = await prisma.license.findMany({
      where: { customerId: id },
      include: { devices: true },
      orderBy: { createdAt: "desc" },
    });

    const devices = licenses.flatMap((license) =>
      license.devices.map((device) => ({
        ...device,
        license: { id: license.id, type: license.type, status: license.status },
      }))
    );

    res.json({ items: devices });
  })
);

adminCustomersRouter.get(
  "/:id/audit-log",
  asyncHandler(async (req, res) => {
    const { page, pageSize } = listAuditLogQuerySchema.parse(req.query);
    const id = paramId(req, "id");
    res.json(await queryAuditLog({ targetType: "Customer", targetId: id }, page, pageSize));
  })
);

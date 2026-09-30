import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { listAuditLogQuerySchema } from "../schemas";

export const adminAuditLogRouter = Router();

// Shared by the global endpoint and the /admin/customers/:id/audit-log and
// /admin/licenses/:id/audit-log convenience routes — those are just this
// same query with targetType/targetId pre-filled.
export async function queryAuditLog(where: Prisma.AuditLogWhereInput, page: number, pageSize: number) {
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: { admin: { select: { id: true, email: true, name: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { items, page, pageSize, total };
}

adminAuditLogRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { targetType, targetId, adminId, from, to, page, pageSize } = listAuditLogQuerySchema.parse(req.query);

    const where: Prisma.AuditLogWhereInput = {
      ...(targetType ? { targetType } : {}),
      ...(targetId ? { targetId } : {}),
      ...(adminId ? { adminId } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    };

    res.json(await queryAuditLog(where, page, pageSize));
  })
);

import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { buildLicenseWhere } from "../utils/licenseQuery";
import { queryAuditLog } from "./adminAuditLog";

export const adminStatsRouter = Router();

// One aggregate endpoint rather than making the dashboard fire five separate
// requests on every load: at current (and realistically any near-term)
// data volume these are five cheap COUNTs plus one indexed audit-log query,
// all run concurrently — nowhere near where per-endpoint composition would
// actually help. Reuses buildLicenseWhere() (same expiry-window logic as
// GET /admin/licenses/expiring-soon) and queryAuditLog() (same as the
// audit-log endpoints) rather than reimplementing either.
adminStatsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const [totalCustomers, totalLicenses, active, revoked, expired, expiringSoon, recentActivity] = await Promise.all([
      prisma.customer.count(),
      prisma.license.count(),
      prisma.license.count({ where: { status: "active" } }),
      prisma.license.count({ where: { status: "revoked" } }),
      prisma.license.count({ where: { status: "expired" } }),
      prisma.license.count({ where: buildLicenseWhere({ status: "expiring_soon" }) }),
      queryAuditLog({}, 1, 10),
    ]);

    res.json({
      totalCustomers,
      totalLicenses,
      licensesByStatus: { active, revoked, expired },
      licensesExpiringSoon: expiringSoon,
      // Same raw shape (action, targetType, targetId, metadata, admin) as
      // GET /admin/audit-log — the human-readable summary is formatted
      // client-side by the same summarizeEntry() the per-record Activity
      // views already use, not duplicated here.
      recentActivity: recentActivity.items,
    });
  })
);

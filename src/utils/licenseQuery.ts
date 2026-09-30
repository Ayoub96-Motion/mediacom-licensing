import type { Prisma } from "@prisma/client";

// "expiring_soon" is a computed shorthand, not a real LicenseStatus: it
// expands to status=active + expiresAt within expiringWithinDays (default
// 30). expiringWithinDays can also be combined with a real status value
// (e.g. status=active&expiringWithinDays=7) independently of that shorthand.
// Shared by GET /admin/licenses, GET /admin/licenses/expiring-soon, and
// GET /admin/stats — one place for this logic, not three.
export function buildLicenseWhere(params: {
  customerId?: string;
  status?: "active" | "revoked" | "expired" | "expiring_soon";
  type?: "perpetual" | "subscription";
  expiringWithinDays?: number;
}): Prisma.LicenseWhereInput {
  const isExpiringSoonShortcut = params.status === "expiring_soon";
  const windowDays = params.expiringWithinDays ?? (isExpiringSoonShortcut ? 30 : undefined);
  const realStatus = params.status === "expiring_soon" ? undefined : params.status;

  return {
    ...(params.customerId ? { customerId: params.customerId } : {}),
    ...(params.type ? { type: params.type } : {}),
    ...(isExpiringSoonShortcut
      ? { status: "active" as const }
      : realStatus
        ? { status: realStatus }
        : {}),
    ...(windowDays !== undefined
      ? {
          expiresAt: {
            not: null,
            gte: new Date(),
            lte: new Date(Date.now() + windowDays * 24 * 60 * 60 * 1000),
          },
        }
      : {}),
  };
}

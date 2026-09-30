import { z } from "zod";

export const entitlementsSchema = z.object({
  maxLocations: z.number().int().positive(),
  maxRoomsPerLocation: z.number().int().positive(),
  maxUsers: z.number().int().positive(),
  guestAccess: z.boolean(),
  multiLocationBroadcast: z.boolean(),
  whiteLabel: z.boolean(),
});

export const activateSchema = z.object({
  key: z.string().min(1),
  deviceFingerprint: z.string().min(1),
  deviceLabel: z.string().min(1).optional(),
});

export const validateSchema = z.object({
  key: z.string().min(1),
  deviceFingerprint: z.string().min(1),
});

// ── Phase 1: /api/device/* ───────────────────────────────────────────────────
export const deviceActivateSchema = z.object({
  key: z.string().min(1),
  fingerprint: z.string().min(1),
  machineName: z.string().min(1).optional(),
  appVersion: z.string().min(1).optional(),
});

export const deviceTokenSchema = z.object({
  token: z.string().min(1),
});

export const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createCustomerSchema = z.object({
  name: z.string().min(1),
  company: z.string().min(1).optional(),
  email: z.string().email(),
  phone: z.string().min(1).optional(),
});

export const updateCustomerSchema = z.object({
  name: z.string().min(1).optional(),
  company: z.string().min(1).nullable().optional(),
  email: z.string().email().optional(),
  phone: z.string().min(1).nullable().optional(),
});

export const listCustomersQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

const baseLicenseFields = {
  customerId: z.string().min(1),
  deviceLimit: z.number().int().positive().default(1),
  type: z.enum(["perpetual", "subscription"]).default("perpetual"),
  expiresAt: z.string().datetime().nullable().optional(),
};

export const createLicenseSchema = z
  .object({
    ...baseLicenseFields,
    tier: z.enum(["starter", "studio", "enterprise"]).optional(),
    features: entitlementsSchema.optional(),
  })
  .refine((data) => data.tier || data.features, {
    message: "Either 'tier' (preset name) or 'features' (custom entitlements object) is required",
  });

export const listLicensesQuerySchema = z.object({
  customerId: z.string().optional(),
  // "expiring_soon" is not a real LicenseStatus — it's a computed shorthand
  // for status=active AND expiresAt within expiringWithinDays (default 30).
  status: z.enum(["active", "revoked", "expired", "expiring_soon"]).optional(),
  type: z.enum(["perpetual", "subscription"]).optional(),
  // Independent of status: filters to expiresAt not null AND within the next
  // N days, on top of whatever status filter (if any) is also given.
  expiringWithinDays: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const expiringSoonQuerySchema = z.object({
  withinDays: z.coerce.number().int().positive().default(30),
});

export const updateLicenseSchema = z.object({
  features: entitlementsSchema.optional(),
  deviceLimit: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  type: z.enum(["perpetual", "subscription"]).optional(),
});

export const listAuditLogQuerySchema = z.object({
  targetType: z.enum(["License", "Customer", "Device"]).optional(),
  targetId: z.string().optional(),
  adminId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

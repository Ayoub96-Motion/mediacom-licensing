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
  status: z.enum(["active", "pending"]).optional(),
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

// ── Phase 3: releases ─────────────────────────────────────────────────────────
// Multipart text fields always arrive as strings, hence z.coerce/z.enum on
// raw strings rather than the typed unions used elsewhere for JSON bodies.
export const uploadReleaseSchema = z.object({
  product: z.enum(["server-win", "android", "ios"]),
  version: z.string().min(1),
  channel: z.enum(["stable", "beta"]).default("stable"),
  notes: z.string().optional(),
  minPlanCode: z.enum(["starter", "studio", "enterprise"]).optional(),
  // Required for android/ios (link-only, no file); must be absent for
  // server-win (which uploads a file instead) — cross-field check happens in
  // the route, since it also depends on whether a file was actually attached.
  externalUrl: z.string().url().optional(),
});

export const updateReleaseSchema = z.object({
  channel: z.enum(["stable", "beta"]).optional(),
  notes: z.string().nullable().optional(),
  minPlanCode: z.enum(["starter", "studio", "enterprise"]).nullable().optional(),
  isPublished: z.boolean().optional(),
});

export const listReleasesQuerySchema = z.object({
  product: z.enum(["server-win", "android", "ios"]).optional(),
  channel: z.enum(["stable", "beta"]).optional(),
  isPublished: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

// Phase 4: real portal session auth (src/middleware/portalAuth.ts) — no
// license key on this request any more, the session cookie identifies the
// customer, and visibility is computed across all of their active licenses.
export const portalReleasesQuerySchema = z.object({
  product: z.enum(["server-win", "android", "ios"]).optional(),
});

export const portalDownloadQuerySchema = z.object({
  token: z.string().min(1),
});

// ── Phase 4: customer portal auth ────────────────────────────────────────────
export const magicLinkRequestSchema = z.object({
  email: z.string().email(),
});

// ── Public landing page: request-access form ─────────────────────────────────
export const TEAM_SIZES = ["1-15", "16-50", "50+"] as const;

export const signupRequestSchema = z.object({
  name: z.string().trim().min(1).max(191),
  email: z.string().trim().toLowerCase().email().max(191),
  company: z.string().trim().min(1).max(191),
  teamSize: z.enum(TEAM_SIZES),
});

export const magicLinkVerifySchema = z.object({
  token: z.string().min(1),
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

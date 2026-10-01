// Mirrors mediacom-licensing's actual Prisma models + response shapes
// (see prisma/schema.prisma and src/routes/*.ts) — not guessed.

export interface Entitlements {
  maxLocations: number;
  maxRoomsPerLocation: number;
  maxUsers: number;
  guestAccess: boolean;
  multiLocationBroadcast: boolean;
  whiteLabel: boolean;
}

export type TierPresetName = "starter" | "studio" | "enterprise";
export type LicenseType = "perpetual" | "subscription";
export type LicenseStatus = "active" | "revoked" | "expired";
// "expiring_soon" is a computed filter shorthand the backend accepts on
// GET /admin/licenses — not a real status any License row ever has.
export type LicenseStatusFilter = LicenseStatus | "expiring_soon";

export interface Customer {
  id: string;
  name: string;
  company: string | null;
  email: string;
  phone: string | null;
  createdAt: string;
}

// GET /admin/customers list items only — adds licenseCount (see backend addition)
export interface CustomerListItem extends Customer {
  licenseCount: number;
}

export interface Device {
  id: string;
  licenseId: string;
  fingerprint: string;
  activatedAt: string;
  lastSeenAt: string;
  label: string | null;
  // Soft-delete (Phase 1) — null while active. Was missing from this type
  // entirely before; the field always existed on the backend.
  deactivatedAt: string | null;
}

// GET /admin/customers/:id/devices items only — a device plus which license
// it belongs to, joined across all of the customer's licenses.
export interface DeviceWithLicense extends Device {
  license: { id: string; type: LicenseType; status: LicenseStatus };
}

// GET /admin/licenses/:id/activations items — a device with a derived
// active/deactivated status, active-first-sorted by the API.
export interface LicenseActivation extends Device {
  status: "active" | "deactivated";
}

export interface License {
  id: string;
  customerId: string;
  keyHash: string;
  type: LicenseType;
  status: LicenseStatus;
  deviceLimit: number;
  expiresAt: string | null;
  features: Entitlements;
  issuedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface LicenseWithCustomer extends License {
  customer: Customer;
}

export interface LicenseWithDevices extends License {
  customer: Customer;
  devices: Device[];
}

export interface CustomerWithLicenses extends Customer {
  licenses: License[];
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface CreateLicenseResponse {
  license: License;
  rawKey: string;
  warning: string;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
}

export interface LoginResponse {
  token: string;
  admin: AdminUser;
}

export type AuditAction =
  | "customer.create"
  | "customer.update"
  | "license.create"
  | "license.update"
  | "license.revoke"
  | "device.deactivate"
  // Phase 1 device API actions — actorType 'device', no admin.
  | "device.activate"
  | "device.refresh"
  // Phase 3 release management actions.
  | "release.upload"
  | "release.update"
  | "release.publish"
  | "release.unpublish"
  | "release.delete"
  // actorType 'customer', no admin — logged from the portal download endpoint.
  | "release.download"
  // Phase 4 portal actions — all actorType 'customer', no admin.
  | "customer.login"
  | "customer.license.reveal_key"
  | "customer.device.deactivate";

export type AuditTargetType = "License" | "Customer" | "Device" | "Release";
export type AuditActorType = "admin" | "customer" | "device";

export interface AuditLogEntry {
  id: string;
  adminId: string | null;
  actorType: AuditActorType;
  // null for actorType 'device'/'customer' entries — no AdminUser to
  // attribute to. Was always non-null before Phase 1's device API existed.
  admin: { id: string; email: string; name: string } | null;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// Phase 3: release management. product uses the API's dashed spelling
// (server-win) — the backend's src/utils/releaseProduct.ts translates
// to/from Prisma's internal underscored enum value before this ever leaves
// the API.
export type ReleaseProduct = "server-win" | "android" | "ios";
export type ReleaseChannel = "stable" | "beta";

export interface Release {
  id: string;
  product: ReleaseProduct;
  version: string;
  channel: ReleaseChannel;
  // Only set for an uploaded file (server-win). Null for a link-only
  // android/ios entry.
  fileSize: number | null;
  sha256: string | null;
  // Only set for a link-only android/ios entry. Null for an uploaded file.
  externalUrl: string | null;
  notes: string | null;
  minPlanCode: TierPresetName | null;
  isPublished: boolean;
  publishedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalCustomers: number;
  totalLicenses: number;
  licensesByStatus: { active: number; revoked: number; expired: number };
  licensesExpiringSoon: number;
  recentActivity: AuditLogEntry[];
}

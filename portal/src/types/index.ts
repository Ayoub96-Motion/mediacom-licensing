// Mirrors mediacom-licensing's actual response shapes (see
// src/routes/portalAuth.ts, portalAccount.ts, portalReleases.ts) — not guessed.

export interface Customer {
  id: string;
  name: string;
  email: string;
}

export interface Entitlements {
  maxLocations: number;
  maxRoomsPerLocation: number;
  maxUsers: number;
  guestAccess: boolean;
  multiLocationBroadcast: boolean;
  whiteLabel: boolean;
}

export type LicenseStatus = "active" | "revoked" | "expired";
export type LicenseType = "perpetual" | "subscription";

export interface PortalLicense {
  id: string;
  planCode: string | null;
  type: LicenseType;
  status: LicenseStatus;
  deviceLimit: number;
  activeDeviceCount: number;
  expiresAt: string | null;
  features: Entitlements;
  keyAvailable: boolean;
}

export interface PortalDevice {
  id: string;
  licenseId: string;
  fingerprint: string | null;
  machineName: string | null;
  appVersion: string | null;
  activatedAt: string;
  lastSeenAt: string;
  deactivatedAt: string | null;
  label: string | null;
  status: "active" | "deactivated";
}

export type ReleaseProduct = "server-win" | "android" | "ios";
export type ReleaseChannel = "stable" | "beta";

export interface PortalRelease {
  id: string;
  product: ReleaseProduct;
  version: string;
  channel: ReleaseChannel;
  fileSize: number | null;
  sha256: string | null;
  externalUrl: string | null;
  notes: string | null;
  minPlanCode: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  downloadUrl: string | null;
}

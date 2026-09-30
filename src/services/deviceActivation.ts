// Shared activation/business logic for BOTH the new /api/device/* endpoints
// and the deprecated /activate + /validate shim (src/routes/public.ts) — one
// lookup/locking/device-limit implementation, not two. The two callers only
// diverge at the final token-signing step (see public.ts's comment on why).
//
// Verified empirically against a real MySQL connection (not assumed) that
// Prisma's $queryRaw returns JSON columns as parsed objects, DATETIME columns
// as real Date instances, and INT columns as numbers — so the raw row below
// can be typed and used directly like a normal Prisma result.

import type { Prisma } from "@prisma/client";
import { ApiError } from "../lib/errors";
import { isTierPresetName, type Entitlements, type TierPresetName } from "../constants/tiers";

type Tx = Prisma.TransactionClient;

/** License.planCode is a free-form nullable string at the DB level (not a FK/enum) — narrow it to the actual payload type here, once, rather than casting at every call site. */
export function resolvePlanCode(planCode: string | null): TierPresetName | "custom" {
  return planCode && isTierPresetName(planCode) ? planCode : "custom";
}

export interface LicenseRow {
  id: string;
  customerId: string;
  keyHash: string;
  planCode: string | null;
  type: "perpetual" | "subscription";
  status: "active" | "revoked" | "expired";
  deviceLimit: number;
  expiresAt: Date | null;
  features: Entitlements;
}

/**
 * Throws ApiError(403, <code>) for revoked/expired, matching the spec's
 * "403 with code" — shared by every lookup variant below so the status/
 * expiry rules exist in exactly one place.
 */
async function validateLicenseStatus(tx: Tx, license: LicenseRow): Promise<void> {
  if (license.status === "revoked") {
    throw new ApiError(403, "LICENSE_REVOKED", "This license has been revoked");
  }

  const isPastExpiry = license.expiresAt !== null && license.expiresAt.getTime() < Date.now();
  if (license.status === "expired" || isPastExpiry) {
    if (license.status !== "expired") {
      await tx.license.update({ where: { id: license.id }, data: { status: "expired" } });
    }
    throw new ApiError(403, "LICENSE_EXPIRED", "This license has expired");
  }
}

/**
 * Locks the License row for the duration of the enclosing transaction
 * (SELECT ... FOR UPDATE — Prisma's fluent API has no row-lock primitive, so
 * this has to be raw SQL) and validates it. Not-found is also a 403 (not
 * 404) per spec — doesn't leak whether a key format is well-formed vs simply
 * doesn't exist.
 */
export async function resolveLicenseForUpdate(tx: Tx, keyHash: string): Promise<LicenseRow> {
  const rows = await tx.$queryRaw<LicenseRow[]>`
    SELECT id, customerId, keyHash, planCode, type, status, deviceLimit, expiresAt, features
    FROM License WHERE keyHash = ${keyHash} FOR UPDATE
  `;

  if (rows.length === 0) {
    throw new ApiError(403, "LICENSE_NOT_FOUND", "No license matches this key");
  }
  const license = rows[0];
  await validateLicenseStatus(tx, license);
  return license;
}

/**
 * Same as resolveLicenseForUpdate, but by id — for /refresh and /deactivate,
 * where the caller has a verified token (which carries licenseId, never the
 * raw key) rather than a raw key to hash and look up by.
 */
export async function resolveLicenseByIdForUpdate(tx: Tx, licenseId: string): Promise<LicenseRow> {
  const rows = await tx.$queryRaw<LicenseRow[]>`
    SELECT id, customerId, keyHash, planCode, type, status, deviceLimit, expiresAt, features
    FROM License WHERE id = ${licenseId} FOR UPDATE
  `;

  if (rows.length === 0) {
    throw new ApiError(403, "LICENSE_NOT_FOUND", "No license matches this token");
  }
  const license = rows[0];
  await validateLicenseStatus(tx, license);
  return license;
}

export interface ActivateDeviceParams {
  tx: Tx;
  licenseId: string;
  deviceLimit: number;
  fingerprintHash: string;
  // Only the legacy shim passes these (raw fingerprint for the deprecated
  // column, deviceLabel for the existing `label` field) — the new API never
  // stores a raw fingerprint at all, per decision 3.
  rawFingerprint?: string;
  label?: string;
  machineName?: string;
  appVersion?: string;
}

export interface ActivateDeviceResult {
  device: Prisma.DeviceGetPayload<object>;
  isNewActivation: boolean;
}

/**
 * "If same fingerprint already active → reuse activation, re-issue token."
 * — reuse bypasses the device-limit check entirely (it's already counted).
 * A brand-new fingerprint OR reviving a previously-deactivated one both
 * consume a slot, so both go through the limit check. Revive updates the
 * existing row (the unique (licenseId, fingerprintHash) constraint means a
 * second insert for the same pair would fail anyway).
 */
export async function activateOrReuseDevice(params: ActivateDeviceParams): Promise<ActivateDeviceResult> {
  const { tx, licenseId, deviceLimit, fingerprintHash } = params;
  const now = new Date();

  const existing = await tx.device.findUnique({
    where: { licenseId_fingerprintHash: { licenseId, fingerprintHash } },
  });

  if (existing && !existing.deactivatedAt) {
    const device = await tx.device.update({
      where: { id: existing.id },
      data: {
        lastSeenAt: now,
        ...(params.machineName !== undefined ? { machineName: params.machineName } : {}),
        ...(params.appVersion !== undefined ? { appVersion: params.appVersion } : {}),
      },
    });
    return { device, isNewActivation: false };
  }

  const activeCount = await tx.device.count({ where: { licenseId, deactivatedAt: null } });
  if (activeCount >= deviceLimit) {
    throw new ApiError(
      409,
      "LICENSE_DEVICE_LIMIT",
      `This license allows at most ${deviceLimit} device(s). Deactivate a device before activating a new one.`
    );
  }

  const device = existing
    ? await tx.device.update({
        where: { id: existing.id },
        data: {
          deactivatedAt: null,
          activatedAt: now,
          lastSeenAt: now,
          fingerprintHash,
          ...(params.rawFingerprint !== undefined ? { fingerprint: params.rawFingerprint } : {}),
          ...(params.label !== undefined ? { label: params.label } : {}),
          ...(params.machineName !== undefined ? { machineName: params.machineName } : {}),
          ...(params.appVersion !== undefined ? { appVersion: params.appVersion } : {}),
        },
      })
    : await tx.device.create({
        data: {
          licenseId,
          fingerprintHash,
          fingerprint: params.rawFingerprint ?? null,
          label: params.label,
          machineName: params.machineName,
          appVersion: params.appVersion,
          activatedAt: now,
          lastSeenAt: now,
        },
      });

  return { device, isNewActivation: existing === null };
}

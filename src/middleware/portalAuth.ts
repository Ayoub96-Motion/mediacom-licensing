// TODO(phase4-portal-auth): stand-in for real customer portal authentication,
// per the explicit Phase 3 instruction to stub this rather than block Phase 3
// on Phase 4's login/session system, which doesn't exist yet.
//
// Until then, the raw license key IS the credential on every portal request
// — the same trust model /api/device/activate already uses (see
// docs/DEVICE-API.md). This is fine for THIS phase's purpose (unblocking the
// admin releases/download plumbing the portal will need) but is NOT how a
// real customer-facing portal should authenticate long-term: a raw secret
// key on every request, rather than a session/JWT established once at login
// and tied to a customer account (which may own several licenses). Replace
// this before the portal in Phase 4 actually ships.

import { prisma } from "../lib/prisma";
import { hashKeyWithPepper } from "../lib/keygen";
import { resolveLicenseForUpdate, type LicenseRow } from "../services/deviceActivation";

/**
 * Resolves and validates a license from a raw key, reusing the exact same
 * tested status rules (LICENSE_NOT_FOUND / LICENSE_REVOKED / LICENSE_EXPIRED,
 * all 403) as the device activation API — no separate copy of that logic.
 * A plain PrismaClient structurally satisfies the Prisma.TransactionClient
 * parameter type resolveLicenseForUpdate expects, so no transaction wrapper
 * is needed for this read-only lookup (the FOR UPDATE lock it takes is
 * released immediately since it isn't wrapped in one).
 */
export function resolveLicenseFromKey(rawKey: string): Promise<LicenseRow> {
  const keyHash = hashKeyWithPepper(rawKey);
  return resolveLicenseForUpdate(prisma, keyHash);
}

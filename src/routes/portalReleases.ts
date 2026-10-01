import { Router } from "express";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { ApiError, paramId } from "../lib/errors";
import { portalDownloadQuerySchema, portalReleasesQuerySchema } from "../schemas";
import { publicLicenseRateLimit } from "../middleware/rateLimit";
import { requirePortalSession } from "../middleware/portalAuth";
import { meetsMinPlan } from "../constants/tiers";
import { serializeRelease, toApiProduct, toPrismaProduct } from "../utils/releaseProduct";
import { signDownloadToken, verifyDownloadToken } from "../services/releaseDownload";
import { createFileReadStream } from "../lib/releaseStorage";
import { logAction } from "../utils/auditLog";

export const portalReleasesRouter = Router();

function isLicenseUsable(license: { status: string; expiresAt: Date | null }): boolean {
  if (license.status !== "active") return false;
  return !license.expiresAt || license.expiresAt.getTime() > Date.now();
}

// Session-authenticated (Phase 4 — requirePortalSession) rather than a raw
// license key: a customer may own several licenses, so visibility is now
// computed across ALL of their active, non-expired ones — a release is
// visible if ANY of them meets its minPlanCode.
portalReleasesRouter.get(
  "/",
  requirePortalSession,
  publicLicenseRateLimit,
  asyncHandler(async (req, res) => {
    const query = portalReleasesQuerySchema.parse(req.query);

    const licenses = await prisma.license.findMany({ where: { customerId: req.customerId! } });
    const usableLicenses = licenses.filter(isLicenseUsable);

    const releases = await prisma.release.findMany({
      where: {
        isPublished: true,
        ...(query.product ? { product: toPrismaProduct(query.product) } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    const visible = releases.filter((release) =>
      usableLicenses.some((license) => meetsMinPlan(license.planCode, release.minPlanCode))
    );

    const items = visible.map((release) => {
      const dto = serializeRelease(release);
      if (release.storageKey) {
        // Short-lived, single-release, single-customer token — see
        // src/services/releaseDownload.ts. No object storage means no real
        // pre-signed URL; this is the token-checked-stream alternative.
        const token = signDownloadToken({ releaseId: release.id, customerId: req.customerId! });
        return { ...dto, downloadUrl: `/api/portal/releases/${release.id}/download?token=${token}` };
      }
      // android/ios — externalUrl is already a public app-store link, no token needed.
      return { ...dto, downloadUrl: release.externalUrl };
    });

    res.json({ items });
  })
);

// NOT behind requirePortalSession — the browser follows this as a plain
// link/navigation (so the file downloads with a normal Save dialog rather
// than being fetched via authenticated XHR), and its own signed token is
// the credential, scoped to exactly one release for 10 minutes.
portalReleasesRouter.get(
  "/:id/download",
  publicLicenseRateLimit,
  asyncHandler(async (req, res) => {
    const id = paramId(req, "id");
    const { token } = portalDownloadQuerySchema.parse(req.query);

    let payload;
    try {
      payload = verifyDownloadToken(token);
    } catch {
      throw new ApiError(403, "TOKEN_INVALID", "This download link is invalid or has expired");
    }
    if (payload.releaseId !== id) {
      throw new ApiError(403, "TOKEN_INVALID", "This download link does not match the requested release");
    }

    const release = await prisma.release.findUnique({ where: { id } });
    // Re-checked at download time (not just at list time): the token is
    // opaque to whether the release is still published, so a release
    // unpublished during the token's 10-minute window must still be
    // rejected here.
    if (!release || !release.isPublished || !release.storageKey) {
      throw new ApiError(404, "release_not_found", "Release not found or not available for download");
    }

    await logAction({
      actorType: "customer",
      action: "release.download",
      targetType: "Release",
      targetId: release.id,
      metadata: { customerId: payload.customerId, product: release.product, version: release.version },
    });

    const ext = path.extname(release.storageKey);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${toApiProduct(release.product)}-${release.version}${ext}"`
    );
    if (release.fileSize) res.setHeader("Content-Length", String(release.fileSize));

    const stream = createFileReadStream(release.storageKey);
    stream.on("error", () => {
      if (!res.headersSent) res.status(500);
      res.end();
    });
    stream.pipe(res);
  })
);

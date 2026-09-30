import { Router } from "express";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { ApiError, paramId } from "../lib/errors";
import { portalDownloadQuerySchema, portalReleasesQuerySchema } from "../schemas";
import { publicLicenseRateLimit } from "../middleware/rateLimit";
import { resolveLicenseFromKey } from "../middleware/portalAuth";
import { meetsMinPlan } from "../constants/tiers";
import { serializeRelease, toApiProduct, toPrismaProduct } from "../utils/releaseProduct";
import { signDownloadToken, verifyDownloadToken } from "../services/releaseDownload";
import { createFileReadStream } from "../lib/releaseStorage";
import { logAction } from "../utils/auditLog";

export const portalReleasesRouter = Router();

// Same trust model as src/routes/public.ts and apiDevice.ts — no admin auth,
// no CORS restriction, IP rate-limited. (Phase 4 may want a dedicated CORS
// origin once the actual customer portal domain exists; nothing to restrict
// to yet.)

portalReleasesRouter.get(
  "/",
  publicLicenseRateLimit,
  asyncHandler(async (req, res) => {
    const query = portalReleasesQuerySchema.parse(req.query);
    // Throws 403 LICENSE_NOT_FOUND / LICENSE_REVOKED / LICENSE_EXPIRED — see
    // src/middleware/portalAuth.ts's TODO on this being a stand-in for real
    // portal auth.
    const license = await resolveLicenseFromKey(query.licenseKey);

    const releases = await prisma.release.findMany({
      where: {
        isPublished: true,
        ...(query.product ? { product: toPrismaProduct(query.product) } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    const visible = releases.filter((release) => meetsMinPlan(license.planCode, release.minPlanCode));

    const items = visible.map((release) => {
      const dto = serializeRelease(release);
      if (release.storageKey) {
        // Short-lived, single-release, single-license token — see
        // src/services/releaseDownload.ts. No object storage means no real
        // pre-signed URL; this is the token-checked-stream alternative.
        const token = signDownloadToken({ releaseId: release.id, licenseId: license.id });
        return { ...dto, downloadUrl: `/api/portal/releases/${release.id}/download?token=${token}` };
      }
      // android/ios — externalUrl is already a public app-store link, no token needed.
      return { ...dto, downloadUrl: release.externalUrl };
    });

    res.json({ items });
  })
);

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
      metadata: { licenseId: payload.licenseId, product: release.product, version: release.version },
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

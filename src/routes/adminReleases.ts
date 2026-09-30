import { Router } from "express";
import multer from "multer";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { ApiError, paramId } from "../lib/errors";
import { listReleasesQuerySchema, updateReleaseSchema, uploadReleaseSchema } from "../schemas";
import { computeSha256, deleteFile, ensureStorageDirExists, generateStorageKey, getFileSize } from "../lib/releaseStorage";
import { serializeRelease, toPrismaProduct } from "../utils/releaseProduct";
import { logAction } from "../utils/auditLog";
import { env } from "../config/env";

export const adminReleasesRouter = Router();

// diskStorage streams directly to disk as multer parses the multipart body —
// never buffered into memory, per the task spec's requirement. The
// filename() callback needs req.body.product/version already populated,
// which only works because the frontend's upload form appends those text
// fields to the FormData BEFORE the file field: multer processes multipart
// parts in stream order, so a field declared after the file in the request
// body is not yet on req.body when filename() runs. This is a real multer
// constraint, not a bug here — see frontend/src/components/UploadReleaseForm.
const upload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      try {
        await ensureStorageDirExists();
        cb(null, env.releasesStorageDir!);
      } catch (err) {
        cb(err as Error, "");
      }
    },
    filename: (req, file, cb) => {
      const product = req.body.product;
      const version = req.body.version;
      if (!product || !version) {
        cb(new Error("`product` and `version` fields must be sent before `file` in the multipart form"), "");
        return;
      }
      cb(null, generateStorageKey(product, version, file.originalname));
    },
  }),
  limits: { fileSize: env.releaseMaxUploadSizeMb * 1024 * 1024 },
});

adminReleasesRouter.post(
  "/",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const data = uploadReleaseSchema.parse(req.body);
    const file = req.file; // present for server-win uploads, absent for android/ios link-only entries

    if (data.product === "server-win") {
      if (!file) {
        throw new ApiError(400, "validation_error", "`file` is required for product 'server-win'");
      }
      if (data.externalUrl) {
        await deleteFile(file.filename);
        throw new ApiError(400, "validation_error", "`externalUrl` must not be set for product 'server-win'");
      }
    } else {
      if (file) {
        await deleteFile(file.filename);
        throw new ApiError(400, "validation_error", `product '${data.product}' is link-only — do not attach a file`);
      }
      if (!data.externalUrl) {
        throw new ApiError(400, "validation_error", `\`externalUrl\` is required for product '${data.product}'`);
      }
    }

    const prismaProduct = toPrismaProduct(data.product);

    // Cheap pre-check before doing the (potentially large) sha256 read below
    // — the real safety net against a race is the DB's (product, version)
    // unique constraint, caught as P2002 further down.
    const existing = await prisma.release.findUnique({
      where: { product_version: { product: prismaProduct, version: data.version } },
    });
    if (existing) {
      if (file) await deleteFile(file.filename);
      throw new ApiError(409, "DUPLICATE_VERSION", `Version ${data.version} already exists for ${data.product}`);
    }

    let storageKey: string | null = null;
    let fileSize: number | null = null;
    let sha256: string | null = null;
    if (file) {
      storageKey = file.filename;
      // Streamed reads, computed from the file already on disk — never the
      // in-flight upload buffer (there isn't one; see diskStorage above).
      [fileSize, sha256] = await Promise.all([getFileSize(storageKey), computeSha256(storageKey)]);
    }

    let release;
    try {
      release = await prisma.release.create({
        data: {
          product: prismaProduct,
          version: data.version,
          channel: data.channel,
          storageKey,
          fileSize,
          sha256,
          externalUrl: data.externalUrl ?? null,
          notes: data.notes ?? null,
          minPlanCode: data.minPlanCode ?? null,
          createdBy: req.admin!.sub,
        },
      });
    } catch (err) {
      if (storageKey) await deleteFile(storageKey);
      if ((err as { code?: string }).code === "P2002") {
        throw new ApiError(409, "DUPLICATE_VERSION", `Version ${data.version} already exists for ${data.product}`);
      }
      throw err;
    }

    await logAction({
      adminId: req.admin!.sub,
      action: "release.upload",
      targetType: "Release",
      targetId: release.id,
      metadata: { product: data.product, version: release.version, channel: release.channel, fileSize, sha256 },
    });

    res.status(201).json(serializeRelease(release));
  })
);

adminReleasesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = listReleasesQuerySchema.parse(req.query);
    const where = {
      ...(query.product ? { product: toPrismaProduct(query.product) } : {}),
      ...(query.channel ? { channel: query.channel } : {}),
      ...(query.isPublished !== undefined ? { isPublished: query.isPublished } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.release.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.release.count({ where }),
    ]);

    res.json({
      items: items.map(serializeRelease),
      page: query.page,
      pageSize: query.pageSize,
      total,
    });
  })
);

adminReleasesRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = paramId(req, "id");
    const data = updateReleaseSchema.parse(req.body);

    const existing = await prisma.release.findUnique({ where: { id } });
    if (!existing) {
      throw new ApiError(404, "release_not_found", "Release not found");
    }

    const wasPublished = existing.isPublished;
    const willBePublished = data.isPublished ?? wasPublished;

    const release = await prisma.release.update({
      where: { id },
      data: {
        ...(data.channel !== undefined ? { channel: data.channel } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.minPlanCode !== undefined ? { minPlanCode: data.minPlanCode } : {}),
        ...(data.isPublished !== undefined
          ? {
              isPublished: data.isPublished,
              // Set once, on the transition to published — never overwritten
              // by a later notes/channel edit, and never cleared back to
              // null on unpublish (keeps "when was this first published"
              // even if it's later pulled and republished).
              publishedAt: data.isPublished && !wasPublished ? new Date() : undefined,
            }
          : {}),
      },
    });

    await logAction({
      adminId: req.admin!.sub,
      action: willBePublished !== wasPublished ? (willBePublished ? "release.publish" : "release.unpublish") : "release.update",
      targetType: "Release",
      targetId: release.id,
      metadata: { before: existing, after: release },
    });

    res.json(serializeRelease(release));
  })
);

adminReleasesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = paramId(req, "id");
    const release = await prisma.release.findUnique({ where: { id } });
    if (!release) {
      throw new ApiError(404, "release_not_found", "Release not found");
    }
    if (release.isPublished) {
      throw new ApiError(409, "RELEASE_PUBLISHED", "Unpublish this release before deleting it");
    }

    await prisma.release.delete({ where: { id } });
    if (release.storageKey) await deleteFile(release.storageKey);

    await logAction({
      adminId: req.admin!.sub,
      action: "release.delete",
      targetType: "Release",
      targetId: id,
      metadata: { product: release.product, version: release.version },
    });

    res.status(204).send();
  })
);

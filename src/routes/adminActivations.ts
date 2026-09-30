import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { ApiError, paramId } from "../lib/errors";
import { logAction } from "../utils/auditLog";

export const adminActivationsRouter = Router();

// Soft-delete counterpart to the existing DELETE
// /admin/licenses/:id/devices/:deviceId (hard delete, unchanged, still the
// primary path — see Step 1's reasoning). This one sets deactivatedAt
// instead of removing the row, preserving activation history for
// GET /admin/licenses/:id/activations.
adminActivationsRouter.post(
  "/:id/deactivate",
  asyncHandler(async (req, res) => {
    const id = paramId(req, "id");
    const device = await prisma.device.findUnique({ where: { id } });
    if (!device) {
      throw new ApiError(404, "device_not_found", "Activation not found");
    }
    if (device.deactivatedAt) {
      throw new ApiError(409, "ALREADY_DEACTIVATED", "This activation is already deactivated");
    }

    const updated = await prisma.device.update({
      where: { id },
      data: { deactivatedAt: new Date() },
    });

    await logAction({
      adminId: req.admin!.sub,
      action: "device.deactivate",
      targetType: "Device",
      targetId: device.id,
      metadata: { licenseId: device.licenseId, fingerprint: device.fingerprint, label: device.label, method: "soft_deactivate" },
    });

    res.json(updated);
  })
);

import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { adminLoginSchema } from "../schemas";
import { ApiError } from "../lib/errors";
import { env } from "../config/env";
import type { AdminJwtPayload } from "../middleware/adminAuth";

export const adminAuthRouter = Router();

adminAuthRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = adminLoginSchema.parse(req.body);

    const admin = await prisma.adminUser.findUnique({ where: { email } });
    if (!admin) {
      throw new ApiError(401, "invalid_credentials", "Invalid email or password");
    }

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) {
      throw new ApiError(401, "invalid_credentials", "Invalid email or password");
    }

    const payload: AdminJwtPayload = { sub: admin.id, email: admin.email };
    const token = jwt.sign(payload, env.adminJwtSecret, {
      expiresIn: env.adminJwtExpiresIn as jwt.SignOptions["expiresIn"],
    });

    res.json({ token, admin: { id: admin.id, email: admin.email, name: admin.name } });
  })
);

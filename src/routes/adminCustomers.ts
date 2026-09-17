import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { createCustomerSchema, listCustomersQuerySchema } from "../schemas";
import { ApiError, paramId } from "../lib/errors";

export const adminCustomersRouter = Router();

adminCustomersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = createCustomerSchema.parse(req.body);
    const customer = await prisma.customer.create({ data });
    res.status(201).json(customer);
  })
);

adminCustomersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { q, page, pageSize } = listCustomersQuerySchema.parse(req.query);

    const where = q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
            { company: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.customer.count({ where }),
    ]);

    res.json({ items, page, pageSize, total });
  })
);

adminCustomersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const customer = await prisma.customer.findUnique({
      where: { id: paramId(req, "id") },
      include: { licenses: true },
    });
    if (!customer) {
      throw new ApiError(404, "customer_not_found", "Customer not found");
    }
    res.json(customer);
  })
);

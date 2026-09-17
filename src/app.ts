import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { publicRouter } from "./routes/public";
import { adminAuthRouter } from "./routes/adminAuth";
import { adminCustomersRouter } from "./routes/adminCustomers";
import { adminLicensesRouter } from "./routes/adminLicenses";
import { requireAdminAuth } from "./middleware/adminAuth";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

export function createApp() {
  const app = express();

  app.use(express.json());

  // Public routes: called by the desktop app's own backend, not a browser —
  // no CORS restriction needed, but they are rate-limited (see routes/public.ts).
  app.use(publicRouter);

  // Admin routes: browser-based dashboard, restricted to a configured origin.
  const adminCors = cors({ origin: env.adminDashboardOrigin });

  app.use("/admin", adminCors, adminAuthRouter);
  app.use("/admin/customers", adminCors, requireAdminAuth, adminCustomersRouter);
  app.use("/admin/licenses", adminCors, requireAdminAuth, adminLicensesRouter);

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

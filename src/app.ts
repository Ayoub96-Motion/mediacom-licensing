import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { publicRouter } from "./routes/public";
import { apiDeviceRouter } from "./routes/apiDevice";
import { adminAuthRouter } from "./routes/adminAuth";
import { adminCustomersRouter } from "./routes/adminCustomers";
import { adminLicensesRouter } from "./routes/adminLicenses";
import { adminAuditLogRouter } from "./routes/adminAuditLog";
import { adminStatsRouter } from "./routes/adminStats";
import { adminActivationsRouter } from "./routes/adminActivations";
import { adminPlansRouter } from "./routes/adminPlans";
import { requireAdminAuth } from "./middleware/adminAuth";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

export function createApp() {
  const app = express();

  app.use(express.json());

  // Public routes: called by the desktop app's own backend, not a browser —
  // no CORS restriction needed, but they are rate-limited (see routes/public.ts).
  app.use(publicRouter);

  // Phase 1 device activation API — same trust model as publicRouter above
  // (no admin auth, no CORS restriction, IP rate-limited), just a new path
  // prefix and new endpoints. See routes/apiDevice.ts.
  app.use("/api/device", apiDeviceRouter);

  // Admin routes: browser-based dashboard, restricted to a configured origin.
  const adminCors = cors({ origin: env.adminDashboardOrigin });

  app.use("/admin", adminCors, adminAuthRouter);
  app.use("/admin/customers", adminCors, requireAdminAuth, adminCustomersRouter);
  app.use("/admin/licenses", adminCors, requireAdminAuth, adminLicensesRouter);
  app.use("/admin/audit-log", adminCors, requireAdminAuth, adminAuditLogRouter);
  app.use("/admin/stats", adminCors, requireAdminAuth, adminStatsRouter);
  app.use("/admin/activations", adminCors, requireAdminAuth, adminActivationsRouter);
  app.use("/admin/plans", adminCors, requireAdminAuth, adminPlansRouter);

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

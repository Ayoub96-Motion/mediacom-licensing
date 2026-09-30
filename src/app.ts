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
import { adminReleasesRouter } from "./routes/adminReleases";
import { portalReleasesRouter } from "./routes/portalReleases";
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

  // Phase 3: customer-portal-facing release listing/download. Same trust
  // model as apiDeviceRouter above (no admin auth, no CORS restriction, IP
  // rate-limited) — see routes/portalReleases.ts. Portal auth is stubbed
  // (a raw license key stands in for a session) until Phase 4's real portal
  // auth exists — see middleware/portalAuth.ts's TODO.
  app.use("/api/portal/releases", portalReleasesRouter);

  // Admin routes: browser-based dashboard, restricted to a configured origin.
  const adminCors = cors({ origin: env.adminDashboardOrigin });

  app.use("/admin", adminCors, adminAuthRouter);
  app.use("/admin/customers", adminCors, requireAdminAuth, adminCustomersRouter);
  app.use("/admin/licenses", adminCors, requireAdminAuth, adminLicensesRouter);
  app.use("/admin/audit-log", adminCors, requireAdminAuth, adminAuditLogRouter);
  app.use("/admin/stats", adminCors, requireAdminAuth, adminStatsRouter);
  app.use("/admin/activations", adminCors, requireAdminAuth, adminActivationsRouter);
  app.use("/admin/plans", adminCors, requireAdminAuth, adminPlansRouter);
  app.use("/admin/releases", adminCors, requireAdminAuth, adminReleasesRouter);

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

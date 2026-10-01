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
import { portalAuthRouter } from "./routes/portalAuth";
import { portalAccountRouter } from "./routes/portalAccount";
import { requireAdminAuth } from "./middleware/adminAuth";
import { requirePortalSession } from "./middleware/portalAuth";
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

  // Phase 4: customer portal — browser app, session cookie based (see
  // middleware/portalAuth.ts, services/portalSession.ts). Needs its own CORS
  // instance with credentials:true (cookies aren't sent cross-origin
  // otherwise) and an explicit origin — "*" is invalid alongside
  // credentials:true per the Fetch spec, and cors() enforces that.
  const portalCors = cors({ origin: env.portalUrl, credentials: true });

  // Defense-in-depth for the download route's token-in-query-string design
  // (see docs/SECURITY.md — accepted limitation, not fully fixed): without
  // this, navigating from a portal page to any third-party link would send
  // that page's full URL, including a live download token, as the Referer
  // header. Applied to every /api/portal/* response, not just the download
  // route, per the same review's recommendation.
  const noReferrer = (_req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  };

  app.use("/api/portal/auth", portalCors, noReferrer, portalAuthRouter);
  // portalReleasesRouter's own /:id/download route intentionally isn't
  // behind requirePortalSession (see its comment — a signed token in the
  // URL is its credential, for a plain browser navigation/download, not an
  // authenticated fetch); the list route inside it applies the middleware
  // itself.
  app.use("/api/portal/releases", portalCors, noReferrer, portalReleasesRouter);
  app.use("/api/portal", portalCors, noReferrer, requirePortalSession, portalAccountRouter);

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

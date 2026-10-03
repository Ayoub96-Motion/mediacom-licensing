import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3000),

  databaseUrl: required("DATABASE_URL"),

  licenseSigningPrivateKey: required("LICENSE_SIGNING_PRIVATE_KEY"),

  adminJwtSecret: required("ADMIN_JWT_SECRET"),
  adminJwtExpiresIn: process.env.ADMIN_JWT_EXPIRES_IN ?? "1h",

  adminDashboardOrigin: required("ADMIN_DASHBOARD_ORIGIN"),

  // Phase 1 (device activation API) — optional at this layer, not globally
  // required, so environments that haven't set these up yet (the main .env)
  // don't crash on import. src/services/licenseSigner.ts validates
  // licensePrivateKeyPath itself, lazily, only when actually asked to sign.
  licensePrivateKeyPath: process.env.LICENSE_PRIVATE_KEY_PATH,
  leaseDays: Number(process.env.LEASE_DAYS ?? 30),

  // Staging-only override for Windows/LAN testing of license-expiry
  // ("degraded mode") behavior without waiting out a real multi-day lease —
  // see leaseMinutesOverride's use in licenseSigner.ts's computeLeaseUntil().
  // Refuses to even load in production (checked immediately below, not
  // lazily) so this can never silently ship a minutes-long lease window.
  leaseMinutesOverride: process.env.LEASE_MINUTES !== undefined ? Number(process.env.LEASE_MINUTES) : undefined,

  // Also lazily validated at point of use (src/lib/keygen.ts,
  // src/lib/keyEncryption.ts), not here — same reasoning as
  // licensePrivateKeyPath above.
  licenseKeyPepper: process.env.LICENSE_KEY_PEPPER,
  licenseKeyEncKey: process.env.LICENSE_KEY_ENC_KEY,
  fingerprintSalt: process.env.FINGERPRINT_SALT,

  // Phase 3 (release management) — local-disk storage for uploaded
  // installers (no object storage configured for this project — see
  // prisma/schema.prisma's Release model comment). Also lazily validated at
  // point of use (src/lib/releaseStorage.ts, src/services/releaseDownload.ts),
  // same reasoning as the Phase 1 vars above.
  releasesStorageDir: process.env.RELEASES_STORAGE_DIR,
  releaseDownloadSecret: process.env.RELEASE_DOWNLOAD_SECRET,
  releaseDownloadTtlMinutes: Number(process.env.RELEASE_DOWNLOAD_TTL_MINUTES ?? 10),
  releaseMaxUploadSizeMb: Number(process.env.RELEASE_MAX_UPLOAD_SIZE_MB ?? 500),

  // Phase 4 (customer portal auth) — also lazily validated at point of use
  // (src/services/portalSession.ts, src/routes/portalAuth.ts), same
  // reasoning as the Phase 1/3 vars above.
  customerSessionSecret: process.env.CUSTOMER_SESSION_SECRET,
  customerSessionDays: Number(process.env.CUSTOMER_SESSION_DAYS ?? 14),
  magicLinkTtlMinutes: Number(process.env.MAGIC_LINK_TTL_MINUTES ?? 15),
  portalUrl: process.env.PORTAL_URL ?? "http://localhost:5175",

  // Public landing page (landing/) — the only browser origin allowed to call
  // POST /public/signup-request, and (alongside portalUrl) the only other
  // origin allowed to call POST /api/portal/auth/request-link, for its
  // /login page. See src/app.ts.
  landingUrl: process.env.LANDING_URL ?? "http://localhost:5174",
};

// Checked eagerly (crashes at startup, not lazily at first sign()) — a
// minutes-long lease window reaching production by accident (a copy-pasted
// staging env var, a misconfigured deploy) would mean every licensed
// install drops into degraded mode within minutes of its last successful
// /device/refresh instead of the intended days-long offline grace window.
if (env.nodeEnv === "production" && env.leaseMinutesOverride !== undefined) {
  throw new Error(
    "LEASE_MINUTES is set but NODE_ENV=production — refusing to start. " +
      "LEASE_MINUTES is a staging-only override for testing lease expiry; " +
      "remove it from the production environment (LEASE_DAYS governs production)."
  );
}

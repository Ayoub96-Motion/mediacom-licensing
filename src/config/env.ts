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
};

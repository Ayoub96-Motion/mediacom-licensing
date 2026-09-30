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
};

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
};

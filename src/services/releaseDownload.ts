// Short-lived, signed download tokens for GET /api/portal/releases/:id/download.
// No object storage means no real pre-signed URL (S3/R2-style) is available
// — this is the "token-checked stream" alternative the task spec calls out.
// Reuses jsonwebtoken (already a dependency, used by admin auth) rather than
// hand-rolling another signing scheme.

import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface DownloadTokenPayload {
  releaseId: string;
  licenseId: string;
}

function secret(): string {
  if (!env.releaseDownloadSecret) {
    throw new Error("RELEASE_DOWNLOAD_SECRET is not set — cannot sign/verify release download tokens");
  }
  return env.releaseDownloadSecret;
}

export function signDownloadToken(payload: DownloadTokenPayload): string {
  return jwt.sign(payload, secret(), { expiresIn: `${env.releaseDownloadTtlMinutes}m` });
}

/** Throws (jsonwebtoken's own TokenExpiredError/JsonWebTokenError) on an invalid or expired token — callers catch and map to a 403. */
export function verifyDownloadToken(token: string): DownloadTokenPayload {
  const decoded = jwt.verify(token, secret());
  if (typeof decoded === "string" || !decoded.releaseId || !decoded.licenseId) {
    throw new Error("malformed download token payload");
  }
  return { releaseId: decoded.releaseId, licenseId: decoded.licenseId };
}

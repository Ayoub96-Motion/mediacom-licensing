// The device API receives the raw device fingerprint but never stores it —
// only its salted hash (2026-09-30 decision 3), in Device.fingerprintHash.

import { createHash } from "node:crypto";
import { env } from "../config/env";

export function hashFingerprint(rawFingerprint: string): string {
  if (!env.fingerprintSalt) {
    throw new Error("FINGERPRINT_SALT is not set — cannot hash device fingerprints");
  }
  return createHash("sha256").update(rawFingerprint + env.fingerprintSalt, "utf8").digest("hex");
}

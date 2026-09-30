// AES-256-GCM encryption of the raw license key, for later admin-portal
// "reveal key" display — a separate concern from keyHash (which is for
// lookup, one-way, never reversible). LICENSE_KEY_ENC_KEY must be exactly 32
// bytes (hex-encoded, 64 hex chars) — validated below, not assumed.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "../config/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV, the recommended/standard size for GCM

function getKey(): Buffer {
  if (!env.licenseKeyEncKey) {
    throw new Error("LICENSE_KEY_ENC_KEY is not set — cannot encrypt/decrypt license keys");
  }
  const key = Buffer.from(env.licenseKeyEncKey, "hex");
  if (key.length !== 32) {
    throw new Error(`LICENSE_KEY_ENC_KEY must be 32 bytes (64 hex chars) — got ${key.length} bytes`);
  }
  return key;
}

/** Returns "iv.authTag.ciphertext", each base64url — stored in License.keyEncrypted. */
export function encryptKey(rawKey: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(rawKey, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("base64url"), authTag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

/** Inverse of encryptKey() — throws if the ciphertext was tampered with (GCM auth tag check). */
export function decryptKey(encrypted: string): string {
  const parts = encrypted.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted key — expected iv.authTag.ciphertext");
  }
  const [ivB64, authTagB64, ciphertextB64] = parts;

  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64url"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64url")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

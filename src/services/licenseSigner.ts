// Signing for the Phase 1 device activation API's license tokens.
// node:crypto only — no external crypto library, per the "no new
// dependencies unless unavoidable" constraint, and Node has supported
// Ed25519 natively (crypto.sign/verify with a null algorithm — Ed25519 is a
// "pure" scheme, no separate digest step) since Node 12. This is a
// SEPARATE keypair/format from the older @noble/ed25519-based
// src/lib/signing.ts, which the deprecated /activate + /validate shim
// (Step 3) still uses for backward compat — the two do not interoperate.

import { readFileSync, existsSync } from "node:fs";
import { createPrivateKey, createPublicKey, sign, verify, type KeyObject } from "node:crypto";
import { env } from "../config/env";
import type { TierPresetName, Entitlements } from "../constants/tiers";

export const TOKEN_VERSION = 1;

export interface LicenseTokenPayload {
  v: 1;
  licenseId: string;
  customerId: string;
  plan: TierPresetName | "custom";
  entitlements: Entitlements;
  fingerprintHash: string;
  issuedAt: string; // ISO
  expiresAt: string | null; // ISO, null = perpetual
  leaseUntil: string; // ISO — offline grace window; never beyond expiresAt
}

let cachedPrivateKey: KeyObject | null = null;

function loadPrivateKey(): KeyObject {
  if (cachedPrivateKey) return cachedPrivateKey;

  const keyPath = env.licensePrivateKeyPath;
  if (!keyPath) {
    throw new Error("LICENSE_PRIVATE_KEY_PATH is not set — cannot sign license tokens");
  }
  if (!existsSync(keyPath)) {
    throw new Error(`LICENSE_PRIVATE_KEY_PATH points to a file that doesn't exist: ${keyPath}`);
  }

  const pem = readFileSync(keyPath, "utf8");
  cachedPrivateKey = createPrivateKey({ key: pem, format: "pem", type: "pkcs8" });
  return cachedPrivateKey;
}

/** Derives the public key from the loaded private key — for this process's own use (e.g. self-checks); external verifiers use their own copy of the public key PEM. */
export function getPublicKeyPem(): string {
  const publicKey = createPublicKey(loadPrivateKey());
  return publicKey.export({ type: "spki", format: "pem" }).toString();
}

/**
 * leaseUntil = min(now + LEASE_DAYS, expiresAt) — the offline grace window
 * a device trusts before it must call /refresh again, but NEVER extended
 * past the license's actual expiry.
 */
export function computeLeaseUntil(now: Date, expiresAt: Date | null): Date {
  const leaseCandidate = new Date(now.getTime() + env.leaseDays * 24 * 60 * 60 * 1000);
  if (expiresAt && expiresAt.getTime() < leaseCandidate.getTime()) {
    return expiresAt;
  }
  return leaseCandidate;
}

export interface BuildPayloadInput {
  licenseId: string;
  customerId: string;
  plan: TierPresetName | "custom";
  entitlements: Entitlements;
  fingerprintHash: string;
  expiresAt: Date | null;
  now?: Date;
}

export function buildLicensePayload(input: BuildPayloadInput): LicenseTokenPayload {
  const now = input.now ?? new Date();
  return {
    v: TOKEN_VERSION,
    licenseId: input.licenseId,
    customerId: input.customerId,
    plan: input.plan,
    entitlements: input.entitlements,
    fingerprintHash: input.fingerprintHash,
    issuedAt: now.toISOString(),
    expiresAt: input.expiresAt ? input.expiresAt.toISOString() : null,
    leaseUntil: computeLeaseUntil(now, input.expiresAt).toISOString(),
  };
}

/** base64url(JSON payload) + "." + base64url(Ed25519 signature over the payload bytes) */
export function signLicense(payload: LicenseTokenPayload): string {
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadJson, "utf8").toString("base64url");
  const signature = sign(null, Buffer.from(payloadB64, "utf8"), loadPrivateKey());
  return `${payloadB64}.${signature.toString("base64url")}`;
}

export interface VerifyResult {
  valid: boolean;
  payload?: LicenseTokenPayload;
  reason?: string;
}

/**
 * Verifies a token against a given public key PEM (not the process's own
 * loaded private key) — this is the shape a caller with only the public key
 * (tests, or eventually the Electron app in Phase 2) actually has.
 */
export function verifyLicense(token: string, publicKeyPem: string): VerifyResult {
  const parts = token.split(".");
  if (parts.length !== 2) {
    return { valid: false, reason: "malformed-token" };
  }
  const [payloadB64, signatureB64] = parts;

  let publicKey: KeyObject;
  try {
    publicKey = createPublicKey({ key: publicKeyPem, format: "pem", type: "spki" });
  } catch {
    return { valid: false, reason: "invalid-public-key" };
  }

  let signatureValid: boolean;
  try {
    signatureValid = verify(
      null,
      Buffer.from(payloadB64, "utf8"),
      publicKey,
      Buffer.from(signatureB64, "base64url")
    );
  } catch {
    return { valid: false, reason: "signature-check-error" };
  }
  if (!signatureValid) {
    return { valid: false, reason: "invalid-signature" };
  }

  let payload: LicenseTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return { valid: false, reason: "invalid-payload-json" };
  }

  return { valid: true, payload };
}

import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha2.js";
import { env } from "../config/env";
import type { Entitlements } from "../constants/tiers";

ed.hashes.sha512 = sha512;

const TOKEN_VALIDITY_MS = 30 * 24 * 60 * 60 * 1000; // 30-day offline grace period

export interface LicenseTokenPayload {
  licenseId: string;
  customerId: string;
  type: "perpetual" | "subscription";
  expiresAt: string | null; // ISO string, null = perpetual
  status: "active" | "revoked" | "expired";
  features: Entitlements;
  deviceFingerprint: string;
  issuedAt: string; // ISO string, when this token was signed
  tokenExpiresAt: string; // ISO string — desktop app must re-validate after this
}

export interface SignedLicenseToken {
  payload: LicenseTokenPayload;
  signature: string; // hex-encoded Ed25519 signature over the JSON-encoded payload
}

function getSecretKey(): Uint8Array {
  return new Uint8Array(Buffer.from(env.licenseSigningPrivateKey, "base64"));
}

function canonicalize(payload: LicenseTokenPayload): Uint8Array {
  // Stable key order so the signature is deterministic and verifiable
  // by any implementation that reconstructs the same JSON.
  const ordered = {
    licenseId: payload.licenseId,
    customerId: payload.customerId,
    type: payload.type,
    expiresAt: payload.expiresAt,
    status: payload.status,
    features: payload.features,
    deviceFingerprint: payload.deviceFingerprint,
    issuedAt: payload.issuedAt,
    tokenExpiresAt: payload.tokenExpiresAt,
  };
  return new TextEncoder().encode(JSON.stringify(ordered));
}

export function signLicenseToken(
  fields: Omit<LicenseTokenPayload, "issuedAt" | "tokenExpiresAt">
): SignedLicenseToken {
  const now = new Date();
  const payload: LicenseTokenPayload = {
    ...fields,
    issuedAt: now.toISOString(),
    tokenExpiresAt: new Date(now.getTime() + TOKEN_VALIDITY_MS).toISOString(),
  };

  const message = canonicalize(payload);
  const signature = ed.sign(message, getSecretKey());

  return {
    payload,
    signature: Buffer.from(signature).toString("hex"),
  };
}

/** For completeness / server-side self-checks. The desktop app verifies with the public key, offline. */
export function verifyLicenseToken(token: SignedLicenseToken): boolean {
  const message = canonicalize(token.payload);
  const publicKey = ed.getPublicKey(getSecretKey());
  return ed.verify(Buffer.from(token.signature, "hex"), message, publicKey);
}

import { randomBytes, createHash, createHmac } from "node:crypto";
import { env } from "../config/env";

// 32-symbol alphabet: A-Z and 2-9, minus 0/O/1/I to avoid visual ambiguity
// when a customer hand-types the key. 5 bits of entropy per character.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

const GROUPS = 4; // MDCM-XXXX-XXXX-XXXX-XXXX
const CHARS_PER_GROUP = 4;
const PREFIX = "MDCM";

/**
 * Generates a human-typeable raw license key, e.g. "MDCM-7K9P-QX4M-2WJH-VN8T".
 *
 * Entropy: 4 groups * 4 chars * 5 bits/char = 80 bits, drawn from a CSPRNG
 * (node:crypto randomBytes). At 80 bits, the birthday-bound collision
 * probability stays negligible even at huge scale: issuing 1 billion (1e9)
 * keys gives a collision probability of roughly (1e9)^2 / (2 * 2^80) ~= 4e-7
 * (about 1 in 2.5 million) — and callers should still enforce a DB-level
 * unique constraint / retry-on-collision as a hard backstop regardless.
 *
 * Only the SHA-256 hash of this value is ever persisted (see hashKey below).
 * The raw value is returned to the caller exactly once and must never be
 * logged or stored.
 */
export function generateRawKey(): string {
  const groups: string[] = [];
  for (let g = 0; g < GROUPS; g++) {
    let group = "";
    const bytes = randomBytes(CHARS_PER_GROUP);
    for (let i = 0; i < CHARS_PER_GROUP; i++) {
      group += ALPHABET[bytes[i] % ALPHABET.length];
    }
    groups.push(group);
  }
  return `${PREFIX}-${groups.join("-")}`;
}

/** Deterministic SHA-256 hash of a raw key, hex-encoded. Stored, never the raw key.
 *  SUPERSEDED by hashKeyWithPepper() for all new licenses (Phase 1, 2026-09-30
 *  decision 3: "No dual-lookup / legacy hash support"). Kept only because it's
 *  the exact function name/behavior this repo has always used; not called by
 *  any new code path. */
export function hashKey(rawKey: string): string {
  return createHash("sha256").update(rawKey, "utf8").digest("hex");
}

// ── Phase 1: new key format + peppered hash ─────────────────────────────────

// Crockford base32 (per Phase 1 spec) — excludes I, L, O, U (not 0/1, unlike
// the older ALPHABET above) to avoid confusion with similar-looking letters.
const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const NEW_PREFIX = "MC";

/**
 * New key format for Phase 1: "MC-XXXX-XXXX-XXXX-XXXX", Crockford base32.
 * Same 80-bit entropy budget (4 groups * 4 chars * 5 bits/char) and the same
 * collision-math reasoning as generateRawKey() above — see its doc comment.
 */
export function generateRawKeyV2(): string {
  const groups: string[] = [];
  for (let g = 0; g < GROUPS; g++) {
    let group = "";
    const bytes = randomBytes(CHARS_PER_GROUP);
    for (let i = 0; i < CHARS_PER_GROUP; i++) {
      group += CROCKFORD_ALPHABET[bytes[i] % CROCKFORD_ALPHABET.length];
    }
    groups.push(group);
  }
  return `${NEW_PREFIX}-${groups.join("-")}`;
}

/**
 * HMAC-SHA256(rawKey, LICENSE_KEY_PEPPER), hex — what every new License row's
 * keyHash stores, and what the new /api/device/* endpoints look up by. A
 * pepper (server-side secret, not per-record) means a stolen DB dump alone
 * can't be brute-forced against a rainbow table the way plain SHA-256 could.
 */
export function hashKeyWithPepper(rawKey: string): string {
  if (!env.licenseKeyPepper) {
    throw new Error("LICENSE_KEY_PEPPER is not set — cannot hash license keys");
  }
  return createHmac("sha256", env.licenseKeyPepper).update(rawKey, "utf8").digest("hex");
}

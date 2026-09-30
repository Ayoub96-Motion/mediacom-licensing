# Device Activation API — contract for Phase 2 (Electron client)

This is the contract the `intercom-app` Electron client should build
against going forward. It covers the new `/api/device/*` endpoints, the
token format they issue, and how to verify that token offline with
`node:crypto`. It also documents the deprecated `/activate` + `/validate`
shim the Electron app currently calls, and when that shim goes away.

Server-side source: `src/routes/apiDevice.ts`, `src/services/deviceActivation.ts`,
`src/services/licenseSigner.ts`.

## Base URL and trust model

`/api/device/*` has no admin auth and no CORS restriction — it's called
directly by customer desktop installs, the same trust model the old
`/activate`/`/validate` routes used. It is IP rate-limited (see below).

## Endpoints

### `POST /api/device/activate`

Activates a device against a license key, or re-issues a token if this
device (identified by fingerprint) is already an active activation of
that license.

Rate limit: `deviceActivateRateLimit` — 10 requests / 15 minutes per IP by
default (`DEVICE_ACTIVATE_RATE_LIMIT` / `DEVICE_ACTIVATE_RATE_WINDOW_MS` can
override in non-production environments; production uses the default).

**Request body**

```json
{
  "key": "MC-XXXX-XXXX-XXXX-XXXX",
  "fingerprint": "<raw device fingerprint>",
  "machineName": "optional, e.g. \"DESKTOP-AB12\"",
  "appVersion": "optional, e.g. \"1.4.2\""
}
```

- `key` — required, non-empty string. The raw license key as given to the
  customer. Never transmit or store this anywhere except this request.
- `fingerprint` — required, non-empty string. The **raw** device
  fingerprint. The server salts and hashes it (see "Fingerprint
  requirements" below); it never stores or echoes back the raw value for
  this endpoint.
- `machineName`, `appVersion` — optional, non-empty strings if present.
  Stored for admin-dashboard display only, not used in any logic.

**Success response — `200`**

```json
{ "license": "<token>" }
```

`token` is the signed license token described in "Token format" below.

**Behavior notes**

- If this fingerprint is already an active (non-deactivated) device on
  this license, the existing activation is reused and a fresh token is
  issued — this does **not** count against the device limit again.
- If this fingerprint was previously deactivated on this license, or is
  brand new, it consumes one device-limit slot (see `LICENSE_DEVICE_LIMIT`
  below).

**Error responses** — see "Error codes" below. Relevant to this endpoint:
`LICENSE_NOT_FOUND`, `LICENSE_REVOKED`, `LICENSE_EXPIRED`,
`LICENSE_DEVICE_LIMIT`, `validation_error`, `rate_limited`.

### `POST /api/device/refresh`

Re-issues a token for an already-activated device, using a previously
issued token (not the raw key — the client should not need to keep the
raw key around after the first activation).

Rate limit: `publicLicenseRateLimit` — 20 requests / hour per IP.

**Request body**

```json
{ "token": "<previously issued token>" }
```

**Success response — `200`**

```json
{ "license": "<new token>" }
```

The server re-verifies the token's signature, re-fetches current license
status/expiry/entitlements from the database (never trusts the old
token's embedded snapshot for anything but identifying which
license/device this is), and re-checks the device is still an active
activation before issuing a new token with a fresh `issuedAt`/`leaseUntil`.

**Error responses**: `TOKEN_INVALID`, `LICENSE_NOT_FOUND`,
`LICENSE_REVOKED`, `LICENSE_EXPIRED`, `ACTIVATION_NOT_FOUND`,
`validation_error`, `rate_limited`.

### `POST /api/device/deactivate`

Deactivates this device's activation (soft delete — frees up a device-limit
slot, the device can later be reactivated via `/activate` with the same
fingerprint).

Rate limit: `publicLicenseRateLimit` — 20 requests / hour per IP.

**Request body**

```json
{ "token": "<previously issued token>" }
```

**Success response — `200`**

```json
{ "success": true }
```

**Error responses**: `TOKEN_INVALID`, `ACTIVATION_NOT_FOUND`,
`validation_error`, `rate_limited`.

Note: unlike `/activate` and `/refresh`, `/deactivate` does not re-check
license status (revoked/expired) — deactivating should always be possible
regardless of license state, since it's the way a device frees up a slot.

## Error codes

Every error response has the shape:

```json
{ "error": { "code": "SOME_CODE", "message": "human-readable string" } }
```

| Code | HTTP status | Meaning | Endpoints |
|---|---|---|---|
| `LICENSE_NOT_FOUND` | 403 | No license matches this key (or, for `/refresh`, the token's licenseId). Also returned — not 404 — to avoid leaking whether a key is well-formed but nonexistent vs. simply malformed. | activate, refresh |
| `LICENSE_REVOKED` | 403 | License status is `revoked`. | activate, refresh |
| `LICENSE_EXPIRED` | 403 | License status is `expired`, or `expiresAt` has passed (the server lazily flips status to `expired` at this point). | activate, refresh |
| `LICENSE_DEVICE_LIMIT` | 409 | Activating this fingerprint would exceed `deviceLimit`. Message includes the limit. Client should prompt the user to deactivate another device first. | activate |
| `TOKEN_INVALID` | 403 | Token is malformed, or its signature does not verify against the current public key. | refresh, deactivate |
| `ACTIVATION_NOT_FOUND` | 403 | Token verified, but no active (non-deactivated) device matches its `licenseId`+`fingerprintHash`. | refresh, deactivate |
| `validation_error` | 400 | Request body failed schema validation (e.g. missing `key`/`fingerprint`/`token`, or empty string). `message` lists the specific field(s). | all |
| `rate_limited` | 429 | Per-IP rate limit exceeded. | all |
| `internal_error` | 500 | Unhandled server error. | all |

Legacy shim only (see below): `DEVICE_NOT_REGISTERED` (403, `/validate`
only).

## Token format

A token is a single string:

```
base64url(JSON payload) + "." + base64url(Ed25519 signature)
```

The signature is computed over the **base64url-encoded payload string's
UTF-8 bytes** (not over the raw JSON bytes, and not over a re-serialization
— sign/verify exactly the string on either side of the `.`).

### Payload fields (`LicenseTokenPayload`)

```ts
{
  v: 1,                              // token format version, currently always 1
  licenseId: string,
  customerId: string,
  plan: TierPresetName | "custom",   // see src/constants/tiers.ts for the preset names
  entitlements: Entitlements,        // JSON snapshot of the license's feature flags at issue/refresh time
  fingerprintHash: string,           // salted SHA-256 hash of the device fingerprint (hex)
  issuedAt: string,                  // ISO 8601, when this specific token was signed
  expiresAt: string | null,          // ISO 8601, null = perpetual license
  leaseUntil: string,                // ISO 8601 — see "Lease rules" below
}
```

Notes for the client:
- `entitlements` and `plan` are a **snapshot at sign time** — always trust
  the token's copy while it's within its lease window, don't try to
  re-derive entitlements from `plan` alone (a license can be individually
  customized, `plan: "custom"`).
- `fingerprintHash` in the payload is the hash, never the raw fingerprint —
  the server never sends the raw fingerprint back.

### Lease rules

```
leaseUntil = min(now + LEASE_DAYS, expiresAt)
```

`LEASE_DAYS` defaults to 30 (server env var, `env.leaseDays`). This is the
offline grace window: the client should treat the token as valid for
day-to-day use until `leaseUntil`, and must call `/api/device/refresh`
before then to keep working — `leaseUntil` is never extended past the
license's own `expiresAt`, so a token never outlives its license
regardless of `LEASE_DAYS`.

`expiresAt` itself is a separate, harder boundary: a perpetual license has
`expiresAt: null` and no expiry, but every token — perpetual or not — still
carries a `leaseUntil` and needs periodic refreshing to detect revocation.

### Verifying a token with `node:crypto`

The client needs only the **production public key PEM** (SPKI format),
embedded in the Electron build — never the private key.

```js
const { createPublicKey, verify } = require("node:crypto");

function verifyLicenseToken(token, publicKeyPem) {
  const [payloadB64, signatureB64] = token.split(".");
  if (!payloadB64 || !signatureB64) {
    return { valid: false, reason: "malformed-token" };
  }

  const publicKey = createPublicKey({ key: publicKeyPem, format: "pem", type: "spki" });

  // Ed25519 is a "pure" signature scheme — pass algorithm = null,
  // sign/verify over the raw message bytes directly, no separate digest.
  const signatureValid = verify(
    null,
    Buffer.from(payloadB64, "utf8"),
    publicKey,
    Buffer.from(signatureB64, "base64url")
  );
  if (!signatureValid) {
    return { valid: false, reason: "invalid-signature" };
  }

  const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  return { valid: true, payload };
}
```

After verifying, the client should also check `leaseUntil` (and
`expiresAt`, if not null) against the local clock before trusting the
license as still active offline.

## Fingerprint requirements

- The client computes a **raw fingerprint string** (its own algorithm —
  machine ID, disk serial, etc. — not specified by this API) and sends it
  as-is in the `fingerprint` field on `/activate`. It must be stable across
  restarts for the same machine, and different across machines.
- The server salts and SHA-256-hashes it server-side
  (`src/lib/fingerprint.ts`, salt from `FINGERPRINT_SALT`) and stores only
  the hash (`fingerprintHash`) — the client never computes or sends a hash
  itself, and never receives the salt.
- `/refresh` and `/deactivate` identify the device via the token's embedded
  `fingerprintHash`, not a re-submitted fingerprint — the client does not
  need to resend the raw fingerprint on those calls.

## Deprecated shim: `/activate` and `/validate`

`src/routes/public.ts` — the routes `intercom-app/server-manager/main.js`
currently calls. Kept only for backward compatibility; do not build new
Phase 2 code against these.

- Shares the same license lookup / device-limit / row-locking logic as
  `/api/device/*`, but signs responses with the **old**, incompatible
  `@noble/ed25519`-based format (`src/lib/signing.ts`): a JSON object
  `{ payload, payloadRaw, signature }` (hex signature), not the new
  `base64url.base64url` token. The Electron app's current
  `licenseVerify.js` has the **old** public key hardcoded and would reject
  new-format tokens outright — this is why the shim signs with the old
  key rather than forwarding to the new signer.
- `POST /activate` — same request/behavior as `/api/device/activate`
  (`key`, `deviceFingerprint`, optional `deviceLabel`), same error codes
  except it returns the old response shape.
- `POST /validate` — takes `{ key, deviceFingerprint }`. Unlike
  `/activate`, it does **not** register a new device: an unrecognized
  fingerprint returns `DEVICE_NOT_REGISTERED` (403) instead of activating.
  This is the one behavioral difference from `/api/device/refresh`, which
  the new API doesn't need to replicate since Phase 2 will hold a token
  instead of re-sending the raw key.

**Deprecation date (proposed):** remove `/activate`, `/validate`,
`src/lib/signing.ts`, and the `Device.fingerprint`/`Device.label` columns
in the first Electron release that ships a client built against
`/api/device/*`. Until that release ships and is confirmed adopted by
existing installs (auto-update rollout, not just released), the shim stays
in place — existing installed copies of the app have the old public key
hardcoded and cannot be force-migrated server-side.

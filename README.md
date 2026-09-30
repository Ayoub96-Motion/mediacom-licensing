# mediacom-licensing

Standalone licensing API for MediaCom, a desktop intercom app sold under a
one-time-purchase (perpetual) model, with subscription support designed for
but not yet built. This repo is independent — it does not import from or
reference the `mediacom-app` desktop repo.

## Stack

- Node.js + Express 5 + TypeScript
- Prisma ORM + PostgreSQL (Supabase/Neon in production)
- `@noble/ed25519` for signing license tokens
- `bcrypt` for admin password hashing
- Transactional email is stubbed behind `sendLicenseEmail()` (see "Email" below)

### Why `@noble/ed25519` over `tweetnacl`

`@noble/ed25519` is audited, actively maintained, pure TypeScript with full
type definitions, zero runtime dependencies (besides `@noble/hashes` for
SHA-512), and a much smaller footprint than `tweetnacl` (which is
effectively unmaintained and ships as untyped JS). Ergonomics are
comparable — both expose simple `sign`/`verify`/`getPublicKey` functions —
so there was no real tradeoff to ask about.

### A note on Prisma version

Prisma 7+ replaced the schema's `datasource { url = env(...) }` field with a
`prisma.config.ts` + driver-adapter model. That's a bigger paradigm shift
than this project needs, so **this repo pins Prisma to the 6.x line**
(`6.19.3`), which uses the conventional, widely-documented
`DATABASE_URL`-in-schema approach the spec assumes. `npm audit` will flag a
`deepmerge-ts` advisory pulled in transitively by Prisma's own CLI config
loader (`@prisma/config`) — that's dev-tooling used only by the `prisma` CLI
itself at build/migrate time, not part of the runtime `@prisma/client` your
server ships, and not exposed to attacker-controlled input in this project's
usage.

## Data model

See `prisma/schema.prisma`. Summary:

- **Customer** — name, company, email (unique), phone.
- **License** — belongs to a Customer. Stores only `keyHash` (SHA-256 of the
  raw key) — the raw key is never persisted. `type` is `perpetual` or
  `subscription` (subscription fields/billing logic are not implemented yet
  — the schema just supports the value). `features` is a JSON entitlements
  blob (see below). `expiresAt` is nullable; null means perpetual.
- **Device** — an activated install, unique per `(licenseId, fingerprint)`.
- **AdminUser** — email + bcrypt password hash for dashboard/API auth. No
  signup endpoint by design; provisioned via `npm run seed`.

### Entitlements shape (`License.features`)

```ts
{
  maxLocations: number,
  maxRoomsPerLocation: number,
  maxUsers: number,
  guestAccess: boolean,
  multiLocationBroadcast: boolean,
  whiteLabel: boolean
}
```

"Unlimited" is represented as the sentinel `1_000_000` (see
`src/constants/tiers.ts`) rather than `null`/`Infinity`, so the desktop app
can always do a plain `count < maxX` comparison without a null-check branch.

### Tier presets

Hardcoded in `src/constants/tiers.ts` (not DB rows, so you can edit them in
code and redeploy):

| Tier | Locations | Rooms/location | Users | Guest access | Multi-location broadcast | White-label |
|---|---|---|---|---|---|---|
| starter | 1 | 6 | 15 | no | no | no |
| studio | 1 | unlimited | 50 | yes | no | no |
| enterprise | unlimited | unlimited | unlimited | yes | yes | yes |

`POST /admin/licenses` accepts either `"tier": "starter"|"studio"|"enterprise"`
to expand into these values, or a fully custom `"features": {...}` object.

## Raw key format

Generated as `MDCM-XXXX-XXXX-XXXX-XXXX` — 16 characters drawn from a
32-symbol alphabet (`A-Z` and `2-9`, excluding `0/O/1/I` to avoid
hand-typing ambiguity), sourced from `node:crypto.randomBytes` (a CSPRNG).
See `src/lib/keygen.ts`.

**Collision probability**: 16 chars × 5 bits/char = 80 bits of entropy.
Using the birthday-bound approximation `p ≈ n² / (2N)`, issuing even 1
billion keys (`n = 1e9`) against a keyspace of `N = 2^80` gives
`p ≈ (1e9)² / (2 × 2^80) ≈ 4×10⁻⁷` — about 1 in 2.5 million, at a scale far
beyond what a per-tenant licensing system will ever issue. `POST
/admin/licenses` also re-checks the hash against the DB and retries
generation (up to 3 attempts) as a hard backstop regardless.

**The raw key is only ever available once** — in the JSON response body of
`POST /admin/licenses`, immediately after creation, and in the (stubbed)
email sent to the customer. Only `SHA-256(rawKey)` is stored server-side.
There is no "show key again" endpoint.

## Signing

`POST /activate` and `POST /validate` return a JSON payload + Ed25519
signature (hex-encoded) — not a JWT, since the desktop app needs to verify
it fully offline against a hardcoded public key with no library dependency
beyond an Ed25519 verify function.

```ts
{
  payload: {
    licenseId, customerId, type, expiresAt, status, features,
    deviceFingerprint, issuedAt, tokenExpiresAt
  },
  payloadRaw: "<exact JSON string that was signed>",
  signature: "<hex>"
}
```

Verifiers should check `signature` against `payloadRaw` (the exact bytes that were
signed), not a re-serialization of `payload` — that avoids depending on
JSON.stringify reproducing identical key order across a network hop.

`tokenExpiresAt` is 30 days out from `issuedAt` — this is the offline grace
period the desktop app should trust before it must call `/validate` again.

### Generating the signing keypair

```
npm run generate-keypair
```

This prints a private and public key (base64-encoded 32-byte Ed25519 keys)
and exits. It does **not** write any file.

- Set the **private** key as `LICENSE_SIGNING_PRIVATE_KEY` in this server's
  `.env`. Never commit it, never log it, rotate it if it ever leaks (every
  previously issued token becomes unverifiable against the new key, so plan
  a rollover if you ever need to rotate in production).
- Hand the **public** key to whoever embeds it in the desktop app
  (`mediacom-app` repo) so it can verify tokens offline. The public key is
  not stored anywhere in this repo.

## Setup

### 1. Install dependencies

```
npm install
```

(If you hit an npm arborist bug with peer-dependency resolution, use
`npm install --legacy-peer-deps`.)

### 2. Configure environment

```
cp .env.example .env
```

Fill in `DATABASE_URL` (a Supabase or Neon Postgres connection string in
production — see the comments in `.env.example`), run
`npm run generate-keypair` and paste the private key into
`LICENSE_SIGNING_PRIVATE_KEY`, and set `ADMIN_JWT_SECRET` to a long random
string.

### 3. Run migrations

```
npm run prisma:migrate
```

(In production, use `npm run prisma:deploy` instead, which applies existing
migrations without prompting to create new ones.)

### 4. Create the first admin user

There is no signup endpoint by design — admins are provisioned out-of-band:

```
ADMIN_EMAIL=you@mediacom.com ADMIN_PASSWORD=changeme ADMIN_NAME="Your Name" npm run seed
```

### 5. Run the server

```
npm run dev      # tsx watch, for local development
npm run build && npm start   # compiled, for production
```

### 6. Issue a real license without a dashboard yet

There's no admin dashboard UI built yet. Until there is, `scripts/issue-license.ts`
is a stand-in — it exercises the admin API end-to-end (login, find-or-create
customer, issue a license) and prints the raw key so you have something real
to test against the desktop app's activation screen:

```
ADMIN_EMAIL=you@mediacom.com ADMIN_PASSWORD=changeme \
  npm run issue-license -- --email=test@studio.com --name="Studio Nova" --tier=starter
```

Args: `--email`, `--name`, `--company`, `--tier` (`starter`/`studio`/`enterprise`,
default `starter`), `--deviceLimit` (default 1), `--type` (`perpetual`/
`subscription`, default `perpetual`). Any you omit fall back to the `DEFAULTS`
object at the top of the script, which you can edit directly instead of typing
args every time. If `ADMIN_EMAIL`/`ADMIN_PASSWORD` aren't set, it prompts for
them interactively (unmasked — this is a local dev tool, not for shared
terminals). It targets `LICENSING_API_URL` (default
`http://localhost:$PORT`) — override it if your API runs elsewhere.
Re-running with the same `--email` reuses the existing customer rather than
creating a duplicate.

## This was tested against a real local Postgres

Local development in this walkthrough used a real Postgres 16 instance
(`createdb mediacom_licensing`, `DATABASE_URL="postgresql://<user>@localhost:5432/mediacom_licensing"`)
— **not** SQLite. Production must be Postgres (Supabase/Neon); nothing in
this codebase assumes SQLite, and no SQLite fallback was added.

## API reference with example requests

All error responses share the shape `{ "error": { "code": string, "message": string } }`.

### Public (rate-limited: 20 req/hour/IP, no auth, no CORS restriction)

**`POST /activate`**
```
curl -X POST http://localhost:3000/activate \
  -H "Content-Type: application/json" \
  -d '{"key":"MDCM-XXXX-XXXX-XXXX-XXXX","deviceFingerprint":"abc123","deviceLabel":"Studio A - Main PC"}'
```
Errors: `license_not_found` (404), `license_revoked` (403), `license_expired`
(403), `device_limit_reached` (403).

**`POST /validate`**
```
curl -X POST http://localhost:3000/validate \
  -H "Content-Type: application/json" \
  -d '{"key":"MDCM-XXXX-XXXX-XXXX-XXXX","deviceFingerprint":"abc123"}'
```
Same errors as `/activate`, plus `device_not_registered` (403) if the
fingerprint was never activated — `/validate` never creates a Device row.

### Admin (JWT auth via `Authorization: Bearer <token>`, CORS-restricted to `ADMIN_DASHBOARD_ORIGIN`)

**`POST /admin/login`**
```
curl -X POST http://localhost:3000/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@mediacom.com","password":"changeme"}'
```

**`POST /admin/customers`**
```
curl -X POST http://localhost:3000/admin/customers \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Studio Nova","company":"Nova Broadcasting","email":"contact@nova.example.com","phone":"555-0100"}'
```

**`GET /admin/customers?q=nova&page=1&pageSize=20`**
```
curl "http://localhost:3000/admin/customers?q=nova" -H "Authorization: Bearer $TOKEN"
```

**`GET /admin/customers/:id`**
```
curl http://localhost:3000/admin/customers/$CUSTOMER_ID -H "Authorization: Bearer $TOKEN"
```
Response items from `GET /admin/customers` also include `licenseCount` (added for the admin dashboard's customer list — not present on `GET /admin/customers/:id`, which includes the full `licenses` array instead).

**`GET /admin/customers/:id/devices`** — every device across all of this customer's licenses in one call, each annotated with which license it belongs to (`license: {id, type, status}`).
```
curl http://localhost:3000/admin/customers/$CUSTOMER_ID/devices -H "Authorization: Bearer $TOKEN"
```

**`PATCH /admin/customers/:id`**
```
curl -X PATCH http://localhost:3000/admin/customers/$CUSTOMER_ID \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"phone":"555-0199"}'
```

**`POST /admin/licenses`** (preset tier)
```
curl -X POST http://localhost:3000/admin/licenses \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"customerId":"'"$CUSTOMER_ID"'","tier":"starter","deviceLimit":2,"type":"perpetual"}'
```
Response includes `rawKey` — **shown only this once**.

**`POST /admin/licenses`** (custom features)
```
curl -X POST http://localhost:3000/admin/licenses \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"customerId":"'"$CUSTOMER_ID"'","features":{"maxLocations":2,"maxRoomsPerLocation":10,"maxUsers":25,"guestAccess":true,"multiLocationBroadcast":false,"whiteLabel":false},"deviceLimit":3}'
```

**`GET /admin/licenses?status=active&type=perpetual`**
```
curl "http://localhost:3000/admin/licenses?status=active" -H "Authorization: Bearer $TOKEN"
```

**Expiry filtering** — two ways to query it, combinable:
- `status=expiring_soon` — a computed shorthand, not a real `LicenseStatus` stored anywhere. Expands to `status=active AND expiresAt` within `expiringWithinDays` (default 30 when this shorthand is used alone).
- `expiringWithinDays=N` — independently filters to `expiresAt IS NOT NULL AND expiresAt` between now and N days out. Can be combined with a real `status` value too, e.g. `status=active&expiringWithinDays=7`.
```
curl "http://localhost:3000/admin/licenses?status=expiring_soon" -H "Authorization: Bearer $TOKEN"
curl "http://localhost:3000/admin/licenses?expiringWithinDays=7&type=subscription" -H "Authorization: Bearer $TOKEN"
```

**`GET /admin/licenses/expiring-soon?withinDays=30`** — a summary count for a dashboard widget, not a list. `withinDays` defaults to 30.
```
curl "http://localhost:3000/admin/licenses/expiring-soon" -H "Authorization: Bearer $TOKEN"
# {"count": 3, "withinDays": 30}
```

**`GET /admin/licenses/:id`**
```
curl http://localhost:3000/admin/licenses/$LICENSE_ID -H "Authorization: Bearer $TOKEN"
```

**`PATCH /admin/licenses/:id`**
```
curl -X PATCH http://localhost:3000/admin/licenses/$LICENSE_ID \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"deviceLimit":5}'
```

**`POST /admin/licenses/:id/revoke`**
```
curl -X POST http://localhost:3000/admin/licenses/$LICENSE_ID/revoke -H "Authorization: Bearer $TOKEN"
```

**`DELETE /admin/licenses/:id/devices/:deviceId`** (frees a seat)
```
curl -X DELETE http://localhost:3000/admin/licenses/$LICENSE_ID/devices/$DEVICE_ID -H "Authorization: Bearer $TOKEN"
```

## Dashboard overview stats

**`GET /admin/stats`** — one aggregate endpoint for the dashboard's Overview
page, not five separate round trips. At current (and any realistic
near-term) data volume this is five cheap `COUNT`s plus one indexed
audit-log query, run concurrently — composing it from existing endpoints
client-side would just mean more requests for no real benefit. Reuses the
same expiry-window logic as `GET /admin/licenses/expiring-soon` and the
same query as the audit-log endpoints — nothing here is reimplemented.
```
curl http://localhost:3000/admin/stats -H "Authorization: Bearer $TOKEN"
```
```json
{
  "totalCustomers": 12,
  "totalLicenses": 34,
  "licensesByStatus": { "active": 28, "revoked": 4, "expired": 2 },
  "licensesExpiringSoon": 3,
  "recentActivity": [ /* last 10 AuditLog entries, same shape as GET /admin/audit-log — the
                          human-readable summary is a client-side concern, formatted by the
                          same code the per-record Activity views use, not duplicated here */ ]
}
```

## Audit log

Every mutating admin action (`customer.create`, `customer.update`,
`license.create`, `license.update`, `license.revoke`, `device.deactivate`)
is recorded in the `AuditLog` table via `logAction()` (`src/utils/auditLog.ts`)
— who (from the authenticated JWT's `sub`, not a new identification path),
what, when, and a `{before, after}` diff for updates. **A logging failure
never blocks the real request** — `logAction()` catches its own errors and
only logs them server-side.

**`GET /admin/audit-log`** (global, filterable)
```
curl "http://localhost:3000/admin/audit-log?targetType=License&page=1" -H "Authorization: Bearer $TOKEN"
```
Query params: `targetType` (`License`/`Customer`/`Device`), `targetId`, `adminId`, `from`/`to` (ISO datetimes), `page`, `pageSize`.

**`GET /admin/customers/:id/audit-log`** and **`GET /admin/licenses/:id/audit-log`** — the
same thing, pre-scoped to one record. The license-scoped one also includes
`device.deactivate` entries for that license's devices (those target a
`Device`, not the `License`, but belong in its history).
```
curl http://localhost:3000/admin/licenses/$LICENSE_ID/audit-log -H "Authorization: Bearer $TOKEN"
```

## Verified end-to-end locally

The flow below was run against a real local Postgres instance and produced
real output (not simulated):

1. `npm run seed` → created admin `oulhaj.aim@gmail.com`.
2. `POST /admin/login` → got a JWT.
3. `POST /admin/customers` → created "Studio Nova".
4. `POST /admin/licenses` with `tier: starter` → got raw key
   `MDCM-QYB6-76MP-7PA2-LW2H` and Starter entitlements, and the stub logged
   an outbound email.
5. `POST /activate` with a fake fingerprint → got a signed token; signature
   verified with `verifyLicenseToken()`.
6. `POST /validate` with the same fingerprint → got a fresh token with a
   rolled-forward `tokenExpiresAt`, no new Device row created.
7. `POST /validate` with a different, never-activated fingerprint →
   rejected with `device_not_registered`.
8. `POST /admin/licenses/:id/revoke` → status flipped to `revoked`.
9. `POST /validate` again with the original fingerprint → rejected with
   `license_revoked`, confirming revocation takes effect immediately.

## Email

`sendLicenseEmail()` (`src/lib/email.ts`) is stubbed behind an
`EmailProvider` interface and currently just logs to the console. To wire
up Resend or Postmark, implement `EmailProvider.send()` against their API
and swap the `ConsoleEmailProvider` instantiation — no call sites change.

## Admin dashboard

`frontend/` is a React + TypeScript + Vite admin dashboard for this API —
customers, licenses, issuing/revoking, device management. See
`frontend/README.md` for setup. It required two small additive backend
changes (documented there and in the endpoint list above): `licenseCount`
on `GET /admin/customers` list items, and a new `PATCH
/admin/customers/:id` (didn't exist before).

## Subscription support (designed, not built)

`License.type` already supports `"subscription"` and the schema has no
perpetual-only assumptions baked in (`expiresAt` is nullable and generic,
not perpetual-specific). What's intentionally **not** built yet: billing
provider integration, renewal/grace-period logic distinct from the
offline-token grace period, dunning/payment-failure handling, and any
webhook receivers. When that's ready, it should hook in at license
creation/renewal without touching the `/activate` or `/validate` contract.

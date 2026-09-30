# Production cutover — Phase 1 (license signing + device activation API)

Do not run any of this until it's time to actually cut production over.
Everything up to now (schema, signing, `/api/device/*`, admin UI, the
regression script) has been built and tested against an isolated staging
database/container only — production has not been touched.

**Production data state (confirmed 2026-09-30): all test data, no real
customers yet.** That simplifies the "reissue licenses" step below to a
clean wipe-and-reissue — no customer outreach, no migration-without-
downtime concerns. If that changes before cutover happens, re-derive that
step instead of following it as written.

## 1. Generate fresh production secrets

**Never reuse staging's secrets or keypair for production.** Staging's
`.env.staging` values (pepper, AES key, fingerprint salt, both keypairs)
must not appear anywhere in production config.

Generate, on a machine you trust, not committed anywhere:

```bash
# Ed25519 keypair for /api/device/* (node:crypto, PKCS8/SPKI PEM)
LICENSE_PRIVATE_KEY_PATH=/absolute/path/outside/any/repo/prod_license_signing_key.pem \
  npm run generate-signing-keys
# -> prints the PUBLIC key PEM to stdout. Save it; you need it in step 6.

# Legacy Ed25519 keypair, still required for the /activate+/validate shim
# until it's removed (see docs/DEVICE-API.md's deprecation section) —
# intercom-app's CURRENT installed base has the staging/dev public key
# hardcoded, so this keypair must be the same one already embedded in
# whatever Electron build your real customers will install. Do not
# regenerate this one blindly — confirm with whoever controls the
# intercom-app release that's about to ship, or you'll invalidate every
# license token that build can verify.
npm run generate-keypair

# Pepper (HMAC key for License.keyHash lookup)
openssl rand -hex 32   # -> LICENSE_KEY_PEPPER

# AES-256-GCM key for License.keyEncrypted (must be exactly 32 bytes / 64 hex chars)
openssl rand -hex 32   # -> LICENSE_KEY_ENC_KEY

# Fingerprint salt
openssl rand -hex 32   # -> FINGERPRINT_SALT
```

**Private key storage**: the new Ed25519 private key file
(`prod_license_signing_key.pem`) must live **outside this repo**, on the
production host only, with restrictive file permissions (the generation
script already writes it `0600`). Additionally:

- Keep an encrypted offline backup (e.g. a password-manager attachment or
  an encrypted USB drive kept off-site) — if this file is lost, every
  license ever issued becomes unverifiable and every customer needs a
  reissued license.
- Do not email it, Slack it, or put it in any ticket/doc, including this
  one.
- The legacy keypair's private key needs the same offline-backup treatment
  if it isn't already backed up somewhere.

## 2. Back up production before touching it

```bash
mysqldump -h <prod-host> -u <prod-user> -p <prod-db-name> \
  > backups/mediacom_licensing_prod_pre_phase1_$(date +%Y%m%d_%H%M%S).sql
```

Verify the dump is non-empty and has real `INSERT` statements for every
table before proceeding (`grep -c INSERT <file>`, spot-check a few rows).
`backups/` is gitignored — this file stays local/off the repo, copy it
somewhere durable (it's your rollback path).

## 3. Run migrations against production

Non-interactively (production shells generally can't do `prisma migrate
dev`'s interactive prompts, same constraint we hit on staging):

```bash
DATABASE_URL="<prod-database-url>" npx prisma migrate deploy
```

This applies, in order: the MySQL/MariaDB datasource migration (if
production was still on the old Postgres schema — confirm this first;
if production is already MySQL, this migration should already be a
no-op there) and the two Phase 1 migrations
(`20260930175321_phase1_device_activation_signing`,
`20260930204357_device_fingerprint_nullable`).

Verify after: `Device.fingerprint` is nullable, `License.keyHash` and
`License.keyEncrypted` columns exist, `AuditLog.adminId` is nullable and
`actorType` exists — a quick `DESCRIBE License; DESCRIBE Device; DESCRIBE
AuditLog;` against prod confirms this without needing a full app restart.

## 4. Reissue licenses

Since production is confirmed all test data: **do not attempt to preserve
or migrate any existing rows.** Truncate the test data and start clean
rather than trying to backfill `keyHash`/`keyEncrypted`/`planCode` onto
placeholder rows that no real customer depends on:

```sql
-- Only after step 2's backup is confirmed good.
TRUNCATE TABLE Device;
TRUNCATE TABLE License;
-- Leave Customer/AdminUser tables alone unless they're also test-only —
-- confirm before truncating those, this doc assumes only License/Device
-- rows are the "test data" in question.
```

Then issue real licenses going forward through the admin dashboard (which
already uses `generateRawKeyV2`/`hashKeyWithPepper`/`encryptKey` and sets
`planCode` — no separate reissue script needed, this is just normal
license issuance from here on).

If it turns out there *is* real customer data mixed in by the time this
runs, stop and don't truncate — that requires a per-customer reissue plan
(new key, notify the customer, no forced simultaneous cutover) instead of
this section, since the "all test data" assumption this section was
written under would no longer hold.

## 5. Configure production environment

Set in production's env (never committed):

```
DATABASE_URL=<prod mysql url>
LICENSE_SIGNING_PRIVATE_KEY=<prod legacy keypair, base64>
LICENSE_PRIVATE_KEY_PATH=<absolute path to the new prod .pem, outside the repo>
LICENSE_KEY_PEPPER=<from step 1>
LICENSE_KEY_ENC_KEY=<from step 1>
FINGERPRINT_SALT=<from step 1>
LEASE_DAYS=30
# DEVICE_ACTIVATE_RATE_LIMIT — leave UNSET in production (defaults to the
# spec'd 10/15min). This var only exists to let scripts/test-licensing.js
# run its full sequence on staging without self-tripping the limiter.
ADMIN_JWT_SECRET=<separate from staging/dev>
ADMIN_JWT_EXPIRES_IN=1h
ADMIN_DASHBOARD_ORIGIN=<prod admin dashboard URL>
PORT=<prod port>
NODE_ENV=production
```

Do **not** run `scripts/test-licensing.js` against production —
`assertStagingEnv()` already refuses to run unless `NODE_ENV=staging` and
`DATABASE_URL` matches `/staging/i`, so this is enforced, not just a
guideline.

## 6. Embed the production public key in the Electron build

Phase 2's Electron client must embed the **production** new-format public
key (printed in step 1, SPKI PEM) — not staging's. Staging's public key
must never ship in a production build; a build with the wrong public key
will reject every real license token as `TOKEN_INVALID`.

If any Electron build was ever built against staging's public key for
internal testing, confirm it is not the build being distributed to real
customers.

## 7. Deploy the app and smoke-test

1. Deploy the updated backend (this branch) to production.
2. Hit `GET /health` — confirm `{ ok: true }`.
3. Issue one real license via the admin dashboard.
4. Call `/api/device/activate` with that license's key against production,
   confirm a `200` with a token back, and confirm you can verify that
   token's signature with the production public key from step 1 (using
   the `node:crypto` snippet in `docs/DEVICE-API.md`).
5. Confirm the old `/activate`/`/validate` shim still works against a
   real (or the same) license and the token it returns verifies against
   the **legacy** public key currently hardcoded in the deployed
   Electron build.

## Rollback

If something is wrong after deploy:

1. Stop routing traffic to the new deployment (revert to the previous
   backend deployment/version — this app has no destructive migration
   that needs "undoing" at the app-code level if you just roll the
   process back).
2. If the migrations from step 3 need reverting: restore from the step-2
   mysqldump into a fresh database, then repoint `DATABASE_URL` at it.
   There is no auto-generated "down" migration for the Phase 1 changes —
   a full restore from backup is the rollback path, not a reverse
   migration.
3. If licenses were already reissued (step 4) before the rollback
   decision: those new keys are lost on restore-from-backup (pre-step-4
   state won't have them) — re-issue again after the restore completes,
   since production was confirmed to have no real customers depending on
   continuity here.
4. If the production Ed25519 private key was already rotated and any
   token was already issued/distributed with it: rolling the database
   back does not invalidate those tokens (they're not stored anywhere to
   roll back) — if the key itself needs to be un-rotated too, restore the
   old key file from its offline backup rather than regenerating, or
   every token issued under the new key becomes unverifiable.

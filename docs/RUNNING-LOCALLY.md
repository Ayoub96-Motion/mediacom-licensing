# Running everything locally (staging-pointed)

This brings up the licensing API, the admin dashboard, and the customer
portal together, all pointed at the staging database and staging secrets —
never the main dev DB, never production. One command once it's set up:

```bash
npm run dev:all
```

which prints, then keeps running with labeled/colored output from all three:

```
  Admin:  http://localhost:5173
  Portal: http://localhost:5175
  API:    http://localhost:4100
```

Everything below is the one-time setup `dev:all` assumes is already in place.

## 1. Start the staging MySQL container

```bash
docker run -d \
  --name mediacom-mysql-staging \
  -p 3308:3306 \
  -e MYSQL_ROOT_PASSWORD=staging_root_pass \
  -e MYSQL_DATABASE=mediacom_licensing \
  -e MYSQL_USER=mediacom_staging \
  -e MYSQL_PASSWORD=staging_devpass \
  -v mediacom-mysql-staging-data:/var/lib/mysql \
  mysql:8
```

If the container already exists (you've done this before), just start it:

```bash
docker start mediacom-mysql-staging
```

Confirm it's up: `docker ps --filter name=mediacom-mysql-staging` should show
`Up` and `0.0.0.0:3308->3306/tcp`.

## 2. Install dependencies (three separate apps, three `node_modules`)

```bash
npm install              # root — the API
npm install --prefix frontend   # admin dashboard
npm install --prefix portal     # customer portal
```

## 3. Create `.env.staging`

This file is gitignored (it holds real secrets) — copy `.env.example` to
`.env.staging` and fill in the staging-specific values. At minimum:

```bash
cp .env.example .env.staging
```

Then edit `.env.staging`:

- `DATABASE_URL="mysql://mediacom_staging:staging_devpass@127.0.0.1:3308/mediacom_licensing"`
- `NODE_ENV=staging`
- `PORT=4100`
- `ADMIN_DASHBOARD_ORIGIN="http://localhost:5173"`
- `PORTAL_URL="http://localhost:5175"`
- Legacy signing keypair: `npm run generate-keypair` (prints a base64 private
  key for `LICENSE_SIGNING_PRIVATE_KEY`)
- New signing keypair: `LICENSE_PRIVATE_KEY_PATH` pointed somewhere **outside
  this repo** (e.g. `~/.mediacom-licensing-staging/license_signing_key.pem`),
  then `LICENSE_PRIVATE_KEY_PATH=... npm run generate-signing-keys`
- `LICENSE_KEY_PEPPER`, `LICENSE_KEY_ENC_KEY`, `FINGERPRINT_SALT`,
  `ADMIN_JWT_SECRET`, `RELEASE_DOWNLOAD_SECRET`, `CUSTOMER_SESSION_SECRET`:
  each `openssl rand -hex 32`
- `RELEASES_STORAGE_DIR` pointed somewhere outside this repo (e.g.
  `~/.mediacom-licensing-staging/releases-storage`) — `mkdir -p` it
- Optional, only if you want to test the portal's magic-link login without a
  real inbox (see "Magic-link emails" below): `TEST_EXPOSE_MAGIC_LINK=1`

## 4. Run migrations against staging

```bash
DATABASE_URL="mysql://mediacom_staging:staging_devpass@127.0.0.1:3308/mediacom_licensing" npx prisma migrate deploy
npx prisma generate
```

## 5. Create a staging admin user

```bash
DOTENV_CONFIG_PATH=.env.staging ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=changeme npm run seed
```

## 6. Run it

```bash
npm run dev:all
```

This runs, concurrently, with labeled/colored output:
- **api** — `tsx watch src/server.ts` with `DOTENV_CONFIG_PATH=.env.staging`
- **admin** — the dashboard's Vite dev server on port 5173 (`--strictPort`:
  fails loudly instead of silently drifting to another port, which would
  break `ADMIN_DASHBOARD_ORIGIN`'s CORS match)
- **portal** — the customer portal's Vite dev server on port 5175

Both frontends get `VITE_API_BASE_URL=http://localhost:4100` injected
directly (no `frontend/.env` or `portal/.env` file needed for this).

Stopping any one of the three (Ctrl+C, or a crash) stops the other two —
`concurrently`'s `killOthers` is set for both success and failure exits, so
you don't end up with orphaned dev servers.

## Magic-link emails in dev/staging: logged to console, not sent

There is no real email provider wired up (`src/lib/email.ts`'s
`ConsoleEmailProvider` is the only one that exists) — "sending" an email just
logs it. Outside production, the **full body** is logged too (not just
to/subject), specifically so a magic-link login can be tested locally at
all, since only the token's SHA-256 hash is ever persisted:

```
[email:stub] would send email: {
  to: 'someone@example.com',
  subject: 'Your MediaCom portal login link',
  text: 'Click the link below to log in...\n\nhttp://localhost:5175/login/verify?token=<raw-token>\n\n...'
}
```

So to log into the portal locally: request a link from
`http://localhost:5175/login`, then copy the `http://localhost:5175/login/verify?token=...`
URL out of the **api** process's console output (in the `dev:all` window,
look for the `[api]`-prefixed lines), open it, and click the "Log in to
MediaCom" button it shows (loading the page itself does not log you in —
see docs/SECURITY.md's note on why).

If you'd rather not read server logs for this, set `TEST_EXPOSE_MAGIC_LINK=1`
in `.env.staging` — `POST /api/portal/auth/request-link`'s JSON response then
also includes `debugToken` (the raw token), which `scripts/test-licensing.js`
already relies on for its own automated login flow. **Never set this in
production** — it's gated on `NODE_ENV==='staging'` as well, so it has no
effect even if accidentally left in a non-staging env file.

# Customer portal security notes

This documents findings from a security test pass against the Phase 4
customer portal (`portal/`, `src/routes/portalAuth.ts`,
`src/routes/portalAccount.ts`, `src/routes/portalReleases.ts`), run against
staging on 2026-10-01, and what was done about each.

## Accepted limitation: release download tokens are bearer capabilities

**What was found**: `GET /api/portal/releases/:id/download?token=<jwt>` has no
session check — it's designed to be followed as a plain browser
navigation/link (so a native "Save As" download works, including resuming a
partial download), not fetched via authenticated XHR. The signed token in
the query string is the *only* credential. Confirmed experimentally:
customer A's exact download URL, used by customer B with no cookie/session
at all, succeeds. The token's embedded `customerId` is recorded for the
audit log entry, but nothing re-checks it against the requester.

**Decision: accepted, not fixed.** Binding the download to a session would
mean giving up plain-link navigation (an authenticated fetch can't trigger a
native browser "Save As" dialog, and bearer-cookie-restricted navigation to
cross-origin or even same-origin direct links is awkward to get right with
`SameSite=Lax`), and would break resuming a large partial download via
`Range` requests across a page reload. The actual exposure is narrow:

- The token is a 32-byte-signature-backed JWT — not guessable, only
  obtainable by whoever the portal legitimately showed it to.
- It expires in 10 minutes.
- It is scoped to exactly one release.

The realistic risk is a leaked URL (shared, logged, left in browser history)
being used by someone else within that 10-minute window — not an open IDOR
where releases can be enumerated or accessed without ever having a valid
session in the first place (confirmed separately: no token at all, or a
tampered token, both get an identical 403 regardless of whether the `:id`
in the URL is real or fake — existence is never leaked).

**Mitigations applied**:

- **`Referrer-Policy: no-referrer`** on every `/api/portal/*` response
  (`src/app.ts`'s `noReferrer` middleware) — without this, navigating from a
  portal page to any third-party link would leak that page's full URL
  (including a live download token, if the page happened to display one) via
  the `Referer` header.
- **Access logs**: this app has no request/access-log middleware of its own
  today (confirmed — no morgan, no `req.url` logging anywhere in `src/`), so
  there is nothing in-app to redact right now. If request logging is ever
  added (an `morgan`-style middleware, or a reverse-proxy/cPanel access log
  in front of this app), the download route's query string **must** be
  excluded or redacted in that log configuration — it carries a live bearer
  token. Flagging this here so it isn't missed when that logging gets added.
- **TTL and multi-use are both intentional, not an oversight**: the token
  stays valid for its full 10-minute window across multiple requests
  (no single-use tracking) specifically so a large installer download can
  resume (`Range` requests, a retried connection, etc.) without forcing the
  customer back through the portal to get a fresh link mid-download.

## Fixed: portal sessions are now server-side, logout actually revokes

**What was found**: the first Phase 4 pass used a stateless JWT (same
pattern as admin auth) in the session cookie. `POST /api/portal/auth/logout`
only cleared the client's cookie — the JWT itself remained valid, signature
and all, until its 14-day expiry. Confirmed: calling the exact same
(logged-out) cookie value against `GET /api/portal/me` after logout still
returned a 200 with real customer data.

**Fix**: sessions are now rows in `PortalSession` (see
`prisma/schema.prisma`), not JWTs:

- The cookie holds a raw, random 32-byte token. Only its SHA-256 hash is
  ever persisted (`src/services/portalSession.ts`) — same principle as
  `License.keyHash` and `MagicLinkToken.tokenHash`.
- `requirePortalSession` (`src/middleware/portalAuth.ts`) looks the hash up
  on every request and rejects if the row is missing, `revokedAt` is set, or
  `expiresAt` has passed. `lastSeenAt` is touched at most once per 5 minutes
  (not on every request).
- **Logout** (`POST /api/portal/auth/logout`) sets `revokedAt` on that one
  session row server-side, then clears the cookie. Idempotent.
- **Logout all devices** (`POST /api/portal/auth/logout-all`, exposed in the
  portal UI) revokes every non-revoked session for the customer, not just
  the current one.
- **License revocation** (`POST /admin/licenses/:id/revoke`) now also
  revokes every portal session belonging to that license's customer — a
  customer whose only license just got revoked shouldn't keep portal access
  because their cookie hasn't expired yet. (There is no "deactivate a
  customer" feature in this codebase yet; `revokeAllSessionsForCustomer()`
  in `src/services/portalSession.ts` is ready to be called from one if it's
  ever added.)
- **Sensitive actions require a fresh session**: revealing a license key
  (`POST /api/portal/licenses/:id/reveal-key`) additionally requires the
  session to have been created within the last 24 hours
  (`isSessionFreshEnough()`), even if it's still otherwise valid for up to
  14 days. A session older than that gets `403 REAUTH_REQUIRED`; the portal
  UI prompts for (and can send) a fresh magic link in place, without forcing
  a full logout of the customer's other activity.
- Admin auth is unchanged — still a stateless JWT. Out of scope for this
  pass (noted explicitly, not an oversight).

Re-verified end to end against staging after the fix (see
`scripts/test-licensing.js` cases 9/10 and the full security-case run):
replaying a logged-out session cookie now gets 401, and revoking a license
revokes the customer's sessions immediately.

## Fixed: magic links failing with "invalid, already used, or expired" on first use

**What was found** (2026-10-01, reported as every fresh link failing): two
independent bugs, both stemming from the original `/verify` page design,
where loading the page auto-called the mutating verify endpoint in a
`useEffect`:

1. **React StrictMode double-invoke.** In development, React intentionally
   mounts → cleans up → re-mounts every component once, specifically to
   surface effects with side effects that aren't idempotent. The old
   `VerifyPage` called `verifyMagicLink(token)` directly in a `useEffect`; a
   `cancelled` flag suppressed the resulting `setState` on the first
   invocation but did **not** stop the actual HTTP request from going out.
   Confirmed live via Playwright: a single page load fired two real
   `POST /api/portal/auth/verify` requests.
2. **A real race in the verify endpoint**, exposed by (1) but not caused by
   it — `/verify` did a `findUnique` (check `usedAt`/`expiresAt`) followed by
   a separate `update` (set `usedAt`), with no transaction or row lock
   between them. Two near-simultaneous requests for the same token could
   both pass the "not yet used" check before either write committed.
   Confirmed live: two such requests both returned `200`, each issuing its
   own session, for a token meant to be single-use. Depending on exact
   timing this race can also resolve the other way (the second request's
   `findUnique` runs after the first's `update` has already committed),
   which is the "already used" symptom that was actually reported — same
   root cause, timing-dependent outcome.

Ruled out (each confirmed independently, not assumed): timezone handling
(`NOW()`, `UTC_TIMESTAMP()`, and Node's clock all agreed to the second;
MySQL's session `time_zone` is `SYSTEM`, which is UTC on this container);
token hashing (an independently-computed SHA-256 of a freshly issued raw
token matched the stored `tokenHash` exactly — no URL-encoding mismatch);
and the link URL itself (pointed at the correct portal origin and a route
the frontend did handle).

**Fix**:

- `POST /api/portal/auth/verify`'s claim is now a single atomic conditional
  `updateMany` (`WHERE tokenHash = ? AND usedAt IS NULL AND expiresAt > NOW()`),
  not a separate check-then-update — this closes the race itself, independent
  of whatever client calls it, however many times, concurrently or not.
- The portal's login-link page moved from `/verify` to `/login/verify` and no
  longer calls the verify endpoint on page load. It renders a "Log in to
  MediaCom" button; only clicking it calls `POST /api/portal/auth/verify`.
  This fixes the StrictMode issue (no mount-time side effect left to
  double-invoke) and, as a second, independent benefit, means an email
  security scanner pre-fetching the link (common — many corporate email
  gateways `GET` every link in an inbox before a person ever opens it) can no
  longer burn the token before the real customer clicks through.
- The button's click handler is itself guarded by a ref (`hasSubmitted`) so
  a double-click (or anything else that could fire it twice) can't send two
  requests either — belt-and-suspenders on top of the server-side atomic fix,
  not a substitute for it.

Regression cases added to `scripts/test-licensing.js` (see cases 25-26):
case 25 fires two `GET`s at the verify URL (confirming neither logs anyone
in) and then the real `POST`, confirming login still succeeds; case 26 fires
two truly concurrent `POST`s for one fresh token and asserts exactly one
succeeds and the other gets `TOKEN_INVALID`, never both and never neither.

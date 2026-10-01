# Windows real-device test plan — license enforcement over LAN

Tests the full licensing loop end to end on real hardware: a Windows machine
running the packaged MediaCom app, talking over LAN to the staging licensing
API running on a Mac. Covers activation, normal operation, API-unreachable
behavior, lease expiry ("degraded mode"), revocation, deactivation, and a
clock-rollback attempt — all against real network conditions, not mocks.

## What "degraded mode" actually means

When the license becomes invalid (lease expired, revoked, deactivated, or
never activated), the MediaCom server running on the Windows machine:

- **Blocks**: creating new groups (`POST /api/rooms`), duplicating a group
  (`POST /api/rooms/:id/duplicate`), creating new locations
  (`POST /api/locations`).
- **Does NOT touch**: joining an existing group, push-to-talk (Socket.IO),
  LiveKit audio itself, admin login/auth token refresh. An already-active
  call must keep working exactly as before — this is the main thing Step C
  below exists to prove under real conditions, not just by code inspection.

The Electron app (server-manager) owns all license-checking logic; the
server has none of its own. The app pushes its current mode to the server's
`POST /api/internal/license-state` (shared-secret + loopback-only — see
`server/routes/internal.ts` in the mediacom-app repo) every 15 seconds and
immediately after every activation/refresh attempt, success or failure.

## One-time setup

### On the Mac (licensing API)

```bash
cd mediacom-licensing
DOTENV_CONFIG_PATH=.env.staging npm run dev
```

With the Phase 5 changes, this prints both URLs on start:

```
mediacom-licensing API listening on port 4100 (staging)
  Local: http://localhost:4100
  LAN:   http://192.168.X.X:4100
```

Note the **LAN** URL — that's what the Windows machine will use as its
Licensing API URL. Confirm the Mac's firewall allows inbound connections on
that port from the LAN (macOS will usually prompt the first time something
connects; allow it).

For steps C/D (lease expiry), restart the API with a short lease:

```bash
DOTENV_CONFIG_PATH=.env.staging LEASE_MINUTES=2 npm run dev
```

(`LEASE_MINUTES` refuses to even start the server if `NODE_ENV=production`
— see `docs/SECURITY.md`/`src/config/env.ts` — so there's no way to
accidentally leave this on in production.)

Issue a real staging license from the admin dashboard before starting
(`npm run dev --prefix frontend`, default `http://localhost:5173`) — note
the raw key, it's only shown once.

### On the Windows machine (MediaCom app)

1. Install the packaged build (or run from source in dev mode — either
   works, the license-checking code path is identical either way).
2. On first launch, the activation screen appears. Before entering the key,
   open the **License** panel (left sidebar) and set **Licensing API URL**
   to the Mac's LAN URL from above (e.g. `http://192.168.1.50:4100`), click
   **Save API URL**. No rebuild, no restart needed — it takes effect on the
   next API call.
3. Enter the staging license key, activate.

## Test steps

Each step: do this → expect this. If it doesn't match, screenshot what's
noted and stop — don't continue to the next step on a failure, since later
steps assume the earlier ones held.

### A. Activate → device visible in admin + portal

**Do**: Activate on Windows with a real staging key (per setup above).

**Expect**:
- License panel shows **Activated: Yes**, correct **Plan**, a **Lease
  until** timestamp ~`LEASE_DAYS`/`LEASE_MINUTES` out, mode **Normal**.
- Admin dashboard (`GET /admin/licenses/:id/activations`) shows this device
  in the list, status `active`.
- Customer portal (`http://localhost:5175`, logged in as this license's
  customer) shows the license with `activeDeviceCount: 1`.

**If it fails, screenshot**: the License panel, the admin dashboard's
device list for this license, and the Windows machine's error (if the
activation screen rejected the key).

### B. Stop API on Mac → restart Windows app → starts, audio works, normal mode

**Do**: Stop the Mac's `npm run dev` (Ctrl+C). Fully quit and relaunch the
MediaCom app on Windows.

**Expect**:
- The app starts normally — no network call blocks startup (`checkLicense()`
  is purely local, verifying the cached token against the embedded public
  key — see `server-manager/licenseClient.js`).
- License panel still shows **Normal** mode (the cached lease hasn't
  expired yet) and the **same** lease-until timestamp as before (unchanged,
  since no refresh could succeed).
- Node/LiveKit status chips go green, join a group and confirm two-way
  audio works.

**If it fails, screenshot**: the License panel (to check whether mode
incorrectly flipped to degraded despite an unexpired lease) and the splash
screen / startup log if the app hung or crashed on launch.

### C. `LEASE_MINUTES=2`, API stopped → wait for lease expiry → degraded mode

**Do**: Restart the Mac API with `LEASE_MINUTES=2` (see setup), activate (or
re-activate) on Windows so the cached token's lease is the short one, then
stop the Mac API again. Wait at least 2–3 minutes without the API running.

**Expect** (checked ~15–30s after the 2-minute mark, since that's the local
mode-watcher's poll interval, not immediately at the exact second):
- License panel flips to **Degraded — LEASE_EXPIRED** on its own within
  ~10s while left open on that tab (it polls `get-license-state` locally —
  no network call of its own — every 10s while visible; switching tabs away
  and back also refreshes it immediately). This build does not add a
  persistent banner outside the License panel itself.
- `POST /api/locations` and `POST /api/rooms` now return `403
  LICENSE_DEGRADED` (confirm with the admin dashboard's "create group"/
  "create location" UI — it should show an error, not silently fail).
- Joining an **existing** group still works.

**Mid-call check (do this explicitly, don't skip it)**: with a user actively
talking in an existing group, let the lease expire while the call is live.

**Expect**: audio does not drop, does not glitch, does not disconnect. The
call is entirely unaffected by the transition into degraded mode — LiveKit
media never routes through the licensing check at all (see
`mediacom-app`'s `server/routes/internal.ts` comment on why the gate is
scoped to only the two creation routes).

**If it fails, screenshot**: the License panel's mode/reason, the exact
error (if any) from attempting to create a group/location, and — if audio
drops — the moment it happened relative to the lease-expiry time shown in
the panel.

### D. Restart API → "Check license now" → back to normal mode

**Do**: Restart the Mac API (same `LEASE_MINUTES=2` or back to normal, your
choice). On Windows, click **Check license now** in the License panel.

**Expect**:
- Button shows "Checking…" then returns.
- License panel updates immediately: **Activated: Yes**, mode **Normal**,
  **Last refresh** timestamp updates to now, **Lease until** extends.
- Creating a group/location now succeeds again.

**If it fails, screenshot**: the License panel before and after the click,
and the Mac API's terminal output for the `/api/device/refresh` request (to
see what it actually returned).

### E. Revoke in admin → Check now → degraded, no crash, no audio drop

**Do**: In the admin dashboard, revoke this license. On Windows, click
**Check license now**. If a call is active in an existing group at the
moment of the check, don't end it first — that's the point of this step.

**Expect**:
- License panel shows mode **Degraded — LICENSE_REVOKED**.
- The app does not crash, does not force-quit, does not close the main
  window.
- Any in-progress call is unaffected — audio keeps flowing.
- New group/location creation is now blocked (403 `LICENSE_DEGRADED`).

**If it fails, screenshot**: any crash dialog / dev tools console error,
the License panel's resulting state, and — if audio dropped — same as step
C's mid-call note.

### F. Deactivate from portal → Check now → server shows not activated

**Do**: In the customer portal, deactivate this specific device (License
card → Manage devices → Deactivate). On Windows, click **Check license
now**.

**Expect**:
- `/api/device/refresh` returns `403 ACTIVATION_NOT_FOUND`.
- License panel shows **Activated: No**, mode **Degraded —
  DEVICE_DEACTIVATED**.
- The cached license record is cleared (confirm by checking the panel
  no longer shows a plan/lease — matches `clearLicenseRecord()` in
  `server-manager/main.js`).
- Re-activating with the same raw key succeeds again (self-deactivation is
  meant to free the seat, not burn the key).

**If it fails, screenshot**: the License panel's state, and the portal's
device list (to confirm the deactivation actually went through server-side
before blaming the Electron app).

### G. Clock rollback: Windows clock back 2 days → no lease extension

**Do**: With the app activated and in normal mode, set the Windows system
clock back 2 days. Do **not** touch the Mac. Wait ~30s (for the local
mode-watcher tick), then check the License panel without clicking "Check
license now" yet.

**Expect**:
- The lease does **not** appear extended or reset — `leaseUntil` is an
  absolute timestamp embedded in the signed token
  (`src/services/licenseSigner.ts`'s `computeLeaseUntil`), not a
  relative "N days from whenever the clock last ran" countdown, so rolling
  the clock backward can only ever make the cached lease look **further**
  in the future relative to the (now earlier) "now" — it cannot shrink an
  already-elapsed lease back to unexpired, and cannot be used to extend a
  lease past what the server actually signed.
- If the clock rollback happens to put "now" before the token's `issuedAt`,
  that's a client-clock anomaly outside this test's scope — the one thing
  being verified here is specifically that winding the clock back does
  **not** let an already-degraded install claim a fresh lease window
  without a real server round-trip.
- Clicking **Check license now** still requires actually reaching the Mac
  API — a rolled-back clock doesn't substitute for one.

**If it fails, screenshot**: the License panel's `leaseUntil` value before
and after the clock change, and the system clock itself (timestamped) to
prove the rollback actually took effect.

## Cleanup after the full run

- Re-activate (or leave deactivated) the test license as appropriate — it
  was created solely for this test pass.
- Reset the Windows clock to the correct time (step G).
- Stop `LEASE_MINUTES` overrides on the Mac before using that staging
  instance for anything else — a 2-minute lease is disruptive outside this
  specific test.

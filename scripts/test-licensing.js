#!/usr/bin/env node
// Standalone Phase 1 regression script — plain Node, no test framework, uses
// global fetch (Node 18+). Deliberately NOT TypeScript: this should be
// runnable with nothing but `node`, decoupled from the app's own build.
//
// Usage:
//   DOTENV_CONFIG_PATH=.env.staging npm run test:licensing
//   DOTENV_CONFIG_PATH=.env.staging npm run test:licensing -- --rate-limit
//
// Refuses to run unless the loaded env clearly points at staging (checks
// both NODE_ENV and DATABASE_URL — see assertStagingEnv()) — this creates
// real customers/licenses/devices and revokes/deactivates things; it must
// never be pointed at a real database.
//
// The --rate-limit case is opt-in and separate from the main run: it
// deliberately exhausts the 10-req/15-min /activate limiter, which would
// otherwise lock out every other case in the same run for 15 minutes.

require("dotenv").config({ path: process.env.DOTENV_CONFIG_PATH || ".env" });

const crypto = require("node:crypto");
const fs = require("node:fs");

const BASE_URL = process.env.LICENSING_API_URL || `http://localhost:${process.env.PORT || 3000}`;
const RUN_RATE_LIMIT = process.argv.includes("--rate-limit");

// ── Safety guard ─────────────────────────────────────────────────────────────
function assertStagingEnv() {
  const nodeEnv = process.env.NODE_ENV || "";
  const dbUrl = process.env.DATABASE_URL || "";
  const looksStaging = nodeEnv === "staging" && /staging/i.test(dbUrl);
  if (!looksStaging) {
    const redacted = dbUrl.replace(/:[^:@/]*@/, ":****@");
    console.error("Refusing to run — this script only runs against a staging environment.");
    console.error(`  NODE_ENV=${nodeEnv || "(unset)"}`);
    console.error(`  DATABASE_URL=${redacted || "(unset)"}`);
    console.error("Run with: DOTENV_CONFIG_PATH=.env.staging npm run test:licensing");
    process.exit(1);
  }
  console.log(`Staging env confirmed (NODE_ENV=${nodeEnv}, DATABASE_URL matches /staging/). Target API: ${BASE_URL}\n`);
}

// ── Admin credentials ────────────────────────────────────────────────────────
async function getAdminCredentials() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD env vars before running this script.");
    process.exit(1);
  }
  return { email, password };
}

// ── Generic API fetch ────────────────────────────────────────────────────────
async function apiFetch(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = {};
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, body: json };
}

// ── Token verification (standalone reimplementation, mirrors
//    src/services/licenseSigner.ts's verifyLicense() — deliberately not
//    importing the app's TS module, to keep this script dependency-free) ──
function getPublicKeyFromPrivateKeyFile() {
  const keyPath = process.env.LICENSE_PRIVATE_KEY_PATH;
  if (!keyPath || !fs.existsSync(keyPath)) {
    throw new Error(`LICENSE_PRIVATE_KEY_PATH not set or file missing: ${keyPath}`);
  }
  const pem = fs.readFileSync(keyPath, "utf8");
  const privateKey = crypto.createPrivateKey({ key: pem, format: "pem", type: "pkcs8" });
  return crypto.createPublicKey(privateKey);
}

function decodeTokenPayload(token) {
  const [payloadB64] = token.split(".");
  return JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
}

function verifyTokenSignature(token, publicKey) {
  const [payloadB64, sigB64] = token.split(".");
  if (!payloadB64 || !sigB64) return false;
  try {
    return crypto.verify(null, Buffer.from(payloadB64, "utf8"), publicKey, Buffer.from(sigB64, "base64url"));
  } catch {
    return false;
  }
}

function tamperPayload(token) {
  const [payloadB64, sigB64] = token.split(".");
  const decoded = Buffer.from(payloadB64, "base64url").toString("utf8");
  // Flip one character firmly inside the JSON (not the first/last byte,
  // where base64 alignment can occasionally make a single-char flip a
  // no-op — see mediacom-licensing's own dev notes on this exact gotcha).
  const mid = Math.floor(decoded.length / 2);
  const ch = decoded[mid];
  const replacement = ch === "a" ? "b" : "a";
  const tampered = decoded.slice(0, mid) + replacement + decoded.slice(mid + 1);
  return Buffer.from(tampered).toString("base64url") + "." + sigB64;
}

// ── Test harness ─────────────────────────────────────────────────────────────
const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push({ name, pass: true });
    console.log(`  PASS  ${name}`);
  } catch (err) {
    results.push({ name, pass: false, error: err.message });
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err.message}`);
  }
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  assertStagingEnv();
  const { email, password } = await getAdminCredentials();
  const publicKey = getPublicKeyFromPrivateKeyFile();

  const login = await apiFetch("/admin/login", { method: "POST", body: { email, password } });
  assert(login.status === 200, `admin login failed: ${JSON.stringify(login.body)}`);
  const adminToken = login.body.token;
  console.log("Logged in as admin.\n");

  const stamp = Date.now();
  const customerEmail = `regression-test-${stamp}@example.com`;
  const customer = await apiFetch("/admin/customers", {
    method: "POST",
    token: adminToken,
    body: { name: `Regression Test ${stamp}`, email: customerEmail },
  });
  assert(customer.status === 201, `customer creation failed: ${JSON.stringify(customer.body)}`);
  const customerId = customer.body.id;
  console.log(`Created throwaway customer: ${customerId}\n`);

  const createdLicenseIds = [];
  async function createLicense(opts) {
    const res = await apiFetch("/admin/licenses", {
      method: "POST",
      token: adminToken,
      body: { customerId, tier: "starter", deviceLimit: 1, type: "perpetual", ...opts },
    });
    assert(res.status === 201, `license creation failed: ${JSON.stringify(res.body)}`);
    createdLicenseIds.push(res.body.license.id);
    return { id: res.body.license.id, rawKey: res.body.rawKey };
  }

  // M: the main license driving cases 1,2,3,4,6,7,8,9
  const licenseM = await createLicense({});
  console.log(`License M (main, limit 1): ${licenseM.id}`);

  let tokenA, tokenB;

  console.log("\n--- Cases 1-4, 6-9: main sequence on license M ---");

  await test("1. activate device A -> 200, signature verifies", async () => {
    const res = await apiFetch("/api/device/activate", {
      method: "POST",
      body: { key: licenseM.rawKey, fingerprint: `fp-A-${stamp}`, machineName: "Test-A" },
    });
    assert(res.status === 200, `expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    tokenA = res.body.license;
    assert(verifyTokenSignature(tokenA, publicKey), "token A signature did not verify against the public key");
  });

  await test("2. refresh A -> new token, leaseUntil extended", async () => {
    const before = decodeTokenPayload(tokenA);
    await new Promise((r) => setTimeout(r, 1100)); // ensure a real clock difference
    const res = await apiFetch("/api/device/refresh", { method: "POST", body: { token: tokenA } });
    assert(res.status === 200, `expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    const newToken = res.body.license;
    const after = decodeTokenPayload(newToken);
    assert(
      new Date(after.leaseUntil).getTime() > new Date(before.leaseUntil).getTime(),
      `leaseUntil did not extend: before=${before.leaseUntil} after=${after.leaseUntil}`
    );
    tokenA = newToken;
  });

  await test("3. activate A again (same fingerprint) -> reuses seat, no new row", async () => {
    const activationsBefore = await apiFetch(`/admin/licenses/${licenseM.id}/activations`, { token: adminToken });
    const countBefore = activationsBefore.body.items.length;

    const res = await apiFetch("/api/device/activate", {
      method: "POST",
      body: { key: licenseM.rawKey, fingerprint: `fp-A-${stamp}` },
    });
    assert(res.status === 200, `expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);

    const activationsAfter = await apiFetch(`/admin/licenses/${licenseM.id}/activations`, { token: adminToken });
    assert(
      activationsAfter.body.items.length === countBefore,
      `expected row count to stay at ${countBefore}, got ${activationsAfter.body.items.length}`
    );
  });

  await test("4. activate device B (different fingerprint) -> 409 LICENSE_DEVICE_LIMIT", async () => {
    const res = await apiFetch("/api/device/activate", {
      method: "POST",
      body: { key: licenseM.rawKey, fingerprint: `fp-B-${stamp}` },
    });
    assert(res.status === 409, `expected 409, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body.error?.code === "LICENSE_DEVICE_LIMIT", `expected LICENSE_DEVICE_LIMIT, got ${res.body.error?.code}`);
  });

  console.log("\n--- Case 5: concurrency / race ---");

  const licenseR = await createLicense({});
  console.log(`License R (race, limit 1): ${licenseR.id}`);

  await test("5. 5 parallel activations, different fingerprints -> exactly 1 succeeds", async () => {
    const attempts = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        apiFetch("/api/device/activate", {
          method: "POST",
          body: { key: licenseR.rawKey, fingerprint: `fp-race-${i}-${stamp}` },
        })
      )
    );
    const successes = attempts.filter((a) => a.status === 200);
    const conflicts = attempts.filter((a) => a.status === 409);
    assert(successes.length === 1, `expected exactly 1 success, got ${successes.length}`);
    assert(conflicts.length === 4, `expected exactly 4 conflicts, got ${conflicts.length}`);
    assert(
      conflicts.every((c) => c.body.error?.code === "LICENSE_DEVICE_LIMIT"),
      "not all conflicts were LICENSE_DEVICE_LIMIT"
    );
  });

  console.log("\n--- back to license M: cases 6-9 ---");

  await test("6. deactivate A, then refresh A's token -> rejected", async () => {
    const deactivateRes = await apiFetch("/api/device/deactivate", { method: "POST", body: { token: tokenA } });
    assert(deactivateRes.status === 200, `deactivate failed: ${JSON.stringify(deactivateRes.body)}`);

    const refreshRes = await apiFetch("/api/device/refresh", { method: "POST", body: { token: tokenA } });
    assert(refreshRes.status === 403, `expected 403, got ${refreshRes.status}: ${JSON.stringify(refreshRes.body)}`);
    assert(
      refreshRes.body.error?.code === "ACTIVATION_NOT_FOUND",
      `expected ACTIVATION_NOT_FOUND, got ${refreshRes.body.error?.code}`
    );
  });

  await test("7. activate device B -> 200 (seat freed)", async () => {
    const res = await apiFetch("/api/device/activate", {
      method: "POST",
      body: { key: licenseM.rawKey, fingerprint: `fp-B-${stamp}` },
    });
    assert(res.status === 200, `expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    tokenB = res.body.license;
  });

  await test("8. admin deactivates B, then refresh B -> rejected", async () => {
    const activations = await apiFetch(`/admin/licenses/${licenseM.id}/activations`, { token: adminToken });
    const deviceB = activations.body.items.find((d) => d.status === "active");
    assert(deviceB, "could not find active device B via admin API");

    const deactivateRes = await apiFetch(`/admin/activations/${deviceB.id}/deactivate`, {
      method: "POST",
      token: adminToken,
    });
    assert(deactivateRes.status === 200, `admin deactivate failed: ${JSON.stringify(deactivateRes.body)}`);

    const refreshRes = await apiFetch("/api/device/refresh", { method: "POST", body: { token: tokenB } });
    assert(refreshRes.status === 403, `expected 403, got ${refreshRes.status}: ${JSON.stringify(refreshRes.body)}`);
  });

  await test("9. admin revokes license, then activate -> 403 LICENSE_REVOKED", async () => {
    const revokeRes = await apiFetch(`/admin/licenses/${licenseM.id}/revoke`, { method: "POST", token: adminToken });
    assert(revokeRes.status === 200, `revoke failed: ${JSON.stringify(revokeRes.body)}`);

    const activateRes = await apiFetch("/api/device/activate", {
      method: "POST",
      body: { key: licenseM.rawKey, fingerprint: `fp-C-${stamp}` },
    });
    assert(activateRes.status === 403, `expected 403, got ${activateRes.status}: ${JSON.stringify(activateRes.body)}`);
    assert(
      activateRes.body.error?.code === "LICENSE_REVOKED",
      `expected LICENSE_REVOKED, got ${activateRes.body.error?.code}`
    );
  });

  console.log("\n--- Case 10: tampered token ---");

  await test("10. tampered token (flipped payload char) -> rejected by refresh", async () => {
    // Reuses tokenB (already deactivated in case 8) purely as a source of a
    // real, well-formed token — tamper-detection happens before any DB
    // lookup in the route, so the underlying activation's own state doesn't
    // affect what this case is actually proving.
    const tampered = tamperPayload(tokenB);
    const res = await apiFetch("/api/device/refresh", { method: "POST", body: { token: tampered } });
    assert(res.status === 403, `expected 403, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body.error?.code === "TOKEN_INVALID", `expected TOKEN_INVALID, got ${res.body.error?.code}`);
  });

  console.log("\n--- Cases 11-12: expiry edge cases ---");

  const in5Days = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
  const licenseS = await createLicense({ type: "subscription", expiresAt: in5Days.toISOString() });
  console.log(`License S (subscription, expires in 5 days): ${licenseS.id}`);

  await test("11. subscription expiring in 5 days -> leaseUntil <= expiresAt", async () => {
    const res = await apiFetch("/api/device/activate", {
      method: "POST",
      body: { key: licenseS.rawKey, fingerprint: `fp-S-${stamp}` },
    });
    assert(res.status === 200, `expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    const payload = decodeTokenPayload(res.body.license);
    assert(
      new Date(payload.leaseUntil).getTime() <= new Date(payload.expiresAt).getTime(),
      `leaseUntil (${payload.leaseUntil}) exceeds expiresAt (${payload.expiresAt})`
    );
  });

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const licenseE = await createLicense({ expiresAt: yesterday.toISOString() });
  console.log(`License E (already expired): ${licenseE.id}`);

  await test("12. already-expired license -> 403 LICENSE_EXPIRED", async () => {
    const res = await apiFetch("/api/device/activate", {
      method: "POST",
      body: { key: licenseE.rawKey, fingerprint: `fp-E-${stamp}` },
    });
    assert(res.status === 403, `expected 403, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body.error?.code === "LICENSE_EXPIRED", `expected LICENSE_EXPIRED, got ${res.body.error?.code}`);
  });

  if (RUN_RATE_LIMIT) {
    console.log("\n--- Optional: rate limit (--rate-limit) ---");
    // Reads the SAME env var the server's rateLimit.ts reads (both processes
    // load the same .env.staging) — fires limit+1 requests against whatever
    // is actually configured, rather than a hardcoded "11" that would be
    // wrong the moment DEVICE_ACTIVATE_RATE_LIMIT changes.
    const configuredLimit = Number(process.env.DEVICE_ACTIVATE_RATE_LIMIT ?? 10);
    const licenseRL = await createLicense({});
    await test(`rate-limit: attempt ${configuredLimit + 1} in the window -> 429`, async () => {
      let last;
      for (let i = 0; i < configuredLimit + 1; i++) {
        last = await apiFetch("/api/device/activate", {
          method: "POST",
          body: { key: licenseRL.rawKey, fingerprint: `fp-rl-${i}-${stamp}` },
        });
      }
      assert(
        last.status === 429,
        `expected 429 on attempt ${configuredLimit + 1}, got ${last.status}: ${JSON.stringify(last.body)}`
      );
    });
  } else {
    console.log("\n(skipping rate-limit case — pass --rate-limit to run it separately)");
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────
  console.log("\n--- Cleanup: revoking all licenses created by this run ---");
  for (const id of createdLicenseIds) {
    const res = await apiFetch(`/admin/licenses/${id}/revoke`, { method: "POST", token: adminToken });
    console.log(`  revoked ${id}: ${res.status === 200 ? "ok" : "FAILED - " + JSON.stringify(res.body)}`);
  }

  // ── Report ───────────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${"=".repeat(50)}`);
  console.log(`RESULTS: ${passed} passed, ${failed} failed (of ${results.length})`);
  console.log("=".repeat(50));
  if (failed > 0) {
    console.log("\nFailed cases:");
    for (const r of results.filter((r) => !r.pass)) {
      console.log(`  - ${r.name}: ${r.error}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\nUnexpected error:", err);
  process.exit(1);
});

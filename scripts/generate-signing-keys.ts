// One-time script: generates the Ed25519 keypair for the Phase 1 device
// activation API's license tokens (src/services/licenseSigner.ts) — a
// SEPARATE keypair from the older @noble/ed25519-based one used by the
// legacy /activate and /validate endpoints (scripts/generate-keypair.ts,
// LICENSE_SIGNING_PRIVATE_KEY). Do not confuse the two: this one uses
// node:crypto's native Ed25519 support (PKCS8 PEM), not a raw base64 seed.
//
// Run with: npm run generate-signing-keys
//
// Writes the PRIVATE key to the file at LICENSE_PRIVATE_KEY_PATH (must be
// set, must point outside this repo, must already be gitignored at that
// location — this script does not gitignore anything for you). Refuses to
// overwrite an existing file: delete it yourself first if you really mean
// to rotate the key (every token signed with the old key becomes
// unverifiable the moment you do).
//
// Prints the PUBLIC key PEM to stdout — hand it to whoever embeds it in the
// Electron app in Phase 2. Not stored anywhere in this repo.

import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

function main() {
  const keyPath = process.env.LICENSE_PRIVATE_KEY_PATH;
  if (!keyPath) {
    console.error("LICENSE_PRIVATE_KEY_PATH is not set. Refusing to guess a location for a signing key.");
    process.exit(1);
  }

  if (existsSync(keyPath)) {
    console.error(
      `${keyPath} already exists — refusing to overwrite a possibly-live signing key.\n` +
        "Delete it yourself first if you really intend to rotate (this invalidates every token signed with the old key)."
    );
    process.exit(1);
  }

  const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });

  mkdirSync(dirname(keyPath), { recursive: true });
  writeFileSync(keyPath, privateKey, { mode: 0o600 });

  console.log(`Ed25519 keypair generated. Private key written to: ${keyPath} (mode 600)\n`);
  console.log("PUBLIC KEY (embed this in the Electron app in Phase 2 — not stored in this repo):\n");
  console.log(publicKey);
}

main();

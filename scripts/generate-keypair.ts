// One-time script: generates an Ed25519 keypair for signing license tokens.
//
// Run with: npm run generate-keypair
//
// The PRIVATE key must be stored as the LICENSE_SIGNING_PRIVATE_KEY env var
// on this server and NEVER committed to git or shared. The PUBLIC key gets
// embedded in the desktop app later (in the mediacom-app repo, not this one)
// so it can verify tokens offline without calling this API.

import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha2.js";

ed.hashes.sha512 = sha512;

function main() {
  const secretKey = ed.utils.randomSecretKey();
  const publicKey = ed.getPublicKey(secretKey);

  const secretKeyB64 = Buffer.from(secretKey).toString("base64");
  const publicKeyB64 = Buffer.from(publicKey).toString("base64");

  console.log("Ed25519 keypair generated.\n");
  console.log("PRIVATE KEY (set as LICENSE_SIGNING_PRIVATE_KEY, never commit this):");
  console.log(secretKeyB64);
  console.log("\nPUBLIC KEY (embed this in the desktop app to verify tokens offline):");
  console.log(publicKeyB64);
  console.log(
    "\nNext steps:\n" +
      "  1. Add LICENSE_SIGNING_PRIVATE_KEY to your .env (never commit it).\n" +
      "  2. Hand the public key to the desktop app team — it is not stored in this repo.\n"
  );
}

main();

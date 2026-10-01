import os from "node:os";
import { createApp } from "./app";
import { env } from "./config/env";

const app = createApp();

// Binds to all interfaces outside production so a Windows machine on the
// same LAN can reach this API during real-device testing (see
// docs/WINDOWS-TEST-PLAN.md) — production stays on the default loopback-only
// bind (cPanel's Node.js App feature fronts it with its own reverse proxy,
// nothing should ever connect to this process directly from off-box there).
const host = env.nodeEnv === "production" ? undefined : "0.0.0.0";

function getLanIp(): string | null {
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === "IPv4" && !addr.internal) return addr.address;
    }
  }
  return null;
}

function listen(onListening: () => void) {
  if (host) {
    app.listen(env.port, host, onListening);
  } else {
    app.listen(env.port, onListening);
  }
}

listen(() => {
  console.log(`mediacom-licensing API listening on port ${env.port} (${env.nodeEnv})`);
  if (host) {
    const lanIp = getLanIp();
    console.log(`  Local: http://localhost:${env.port}`);
    console.log(`  LAN:   http://${lanIp ?? "<no LAN interface found>"}:${env.port}`);
  }
});

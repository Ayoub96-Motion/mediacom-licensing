// Stand-in for the (not-yet-built) admin dashboard: exercises the admin API
// end-to-end to issue a real license key for local testing against the
// desktop app's activation screen.
//
// Usage:
//   npm run issue-license -- --email=test@studio.com --name="Studio Nova" --tier=starter
//
// Customer name/company/email can also just be edited as the DEFAULTS below
// if you'd rather not pass CLI args every time.
//
// Admin credentials: read from ADMIN_EMAIL / ADMIN_PASSWORD env vars if set
// (convenient for repeated runs / scripting), otherwise prompted for
// interactively (convenient for a one-off run without exporting env vars
// first). Password input is not masked — Node has no built-in masked
// prompt, and pulling in a dependency for this internal-only script isn't
// worth it; just don't run this on a shared terminal.

import "dotenv/config";
import * as readline from "node:readline/promises";

const BASE_URL = process.env.LICENSING_API_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;

// Edit these if you'd rather not pass --email/--name/--company every time.
const DEFAULTS = {
  email: "test@studio.example.com",
  name: "Test Studio",
  company: "",
  tier: "starter" as "starter" | "studio" | "enterprise",
  deviceLimit: 1,
  type: "perpetual" as "perpetual" | "subscription",
};

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (const raw of argv) {
    const match = /^--([^=]+)=(.*)$/.exec(raw);
    if (match) args[match[1]] = match[2];
  }
  return args;
}

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

async function getAdminCredentials(): Promise<{ email: string; password: string }> {
  let email = process.env.ADMIN_EMAIL;
  let password = process.env.ADMIN_PASSWORD;

  if (!email) {
    email = await prompt("Admin email: ");
  }
  if (!password) {
    password = await prompt("Admin password: ");
  }
  return { email, password };
}

interface ApiErrorBody {
  error: { code: string; message: string };
}

async function apiFetch<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  const body = await res.json();

  if (!res.ok) {
    const err = body as ApiErrorBody;
    throw new Error(`${path} -> ${res.status} ${err.error?.code ?? "unknown_error"}: ${err.error?.message ?? JSON.stringify(body)}`);
  }

  return body as T;
}

interface Customer {
  id: string;
  name: string;
  company: string | null;
  email: string;
  phone: string | null;
}

interface License {
  id: string;
  customerId: string;
  status: string;
  type: string;
  deviceLimit: number;
  expiresAt: string | null;
  features: Record<string, unknown>;
}

async function findOrCreateCustomer(token: string, params: { email: string; name: string; company?: string }): Promise<Customer> {
  const searchResult = await apiFetch<{ items: Customer[] }>(
    `/admin/customers?q=${encodeURIComponent(params.email)}`,
    { token }
  );

  const existing = searchResult.items.find((c) => c.email.toLowerCase() === params.email.toLowerCase());
  if (existing) {
    console.log(`Reusing existing customer: ${existing.name} <${existing.email}> (${existing.id})`);
    return existing;
  }

  const created = await apiFetch<Customer>("/admin/customers", {
    method: "POST",
    token,
    body: JSON.stringify({
      name: params.name,
      email: params.email,
      ...(params.company ? { company: params.company } : {}),
    }),
  });
  console.log(`Created new customer: ${created.name} <${created.email}> (${created.id})`);
  return created;
}

function printBoxed(lines: string[]) {
  const width = Math.max(...lines.map((l) => l.length)) + 2;
  const border = "═".repeat(width);
  console.log(`\n╔${border}╗`);
  for (const line of lines) {
    console.log(`║ ${line.padEnd(width - 2)} ║`);
  }
  console.log(`╚${border}╝\n`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const customerParams = {
    email: args.email ?? DEFAULTS.email,
    name: args.name ?? DEFAULTS.name,
    company: args.company ?? DEFAULTS.company,
  };
  const tier = (args.tier as typeof DEFAULTS.tier) ?? DEFAULTS.tier;
  const deviceLimit = args.deviceLimit ? Number(args.deviceLimit) : DEFAULTS.deviceLimit;
  const type = (args.type as typeof DEFAULTS.type) ?? DEFAULTS.type;

  console.log(`Target API: ${BASE_URL}`);

  const { email: adminEmail, password: adminPassword } = await getAdminCredentials();

  const login = await apiFetch<{ token: string }>("/admin/login", {
    method: "POST",
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  console.log("Logged in as admin.");

  const customer = await findOrCreateCustomer(login.token, customerParams);

  const licenseResult = await apiFetch<{ license: License; rawKey: string; warning: string }>(
    "/admin/licenses",
    {
      method: "POST",
      token: login.token,
      body: JSON.stringify({
        customerId: customer.id,
        tier,
        deviceLimit,
        type,
      }),
    }
  );

  printBoxed([
    "RAW LICENSE KEY — shown only once, copy it now",
    "",
    licenseResult.rawKey,
  ]);

  console.log("License record:");
  console.log(`  License ID:   ${licenseResult.license.id}`);
  console.log(`  Customer ID:  ${licenseResult.license.customerId}`);
  console.log(`  Tier:         ${tier}`);
  console.log(`  Type:         ${licenseResult.license.type}`);
  console.log(`  Device limit: ${licenseResult.license.deviceLimit}`);
  console.log(`  Expires at:   ${licenseResult.license.expiresAt ?? "never (perpetual)"}`);
}

main().catch((err) => {
  console.error("\nFailed:", err instanceof Error ? err.message : err);
  process.exit(1);
});

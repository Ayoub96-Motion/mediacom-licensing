#!/usr/bin/env node
'use strict';
// Starts the licensing API, admin dashboard, customer portal, and public
// landing page together
// for local development — all three pointed at the staging database/secrets
// (see .env.staging). Never touches the main/production DB; see
// docs/RUNNING-LOCALLY.md for the full setup (including the staging MySQL
// container these all expect to already be running).
//
// Run: npm run dev:all

const path = require('node:path');
const { concurrently } = require('concurrently');

const ROOT = path.resolve(__dirname, '..');

const API_URL = 'http://localhost:4100';
const ADMIN_URL = 'http://localhost:5173';
const PORTAL_URL = 'http://localhost:5175';
const LANDING_URL = 'http://localhost:5174';

console.log('');
console.log(`  Admin:  ${ADMIN_URL}`);
console.log(`  Portal: ${PORTAL_URL}`);
console.log(`  Landing: ${LANDING_URL}`);
console.log(`  API:    ${API_URL}`);
console.log('');

const { result } = concurrently(
  [
    {
      name: 'api',
      command: 'npm run dev',
      cwd: ROOT,
      env: { DOTENV_CONFIG_PATH: '.env.staging' },
      prefixColor: 'blue',
    },
    {
      // --strictPort: fail loudly instead of silently drifting to another
      // port if 5173 is already taken — a silent port change here would
      // break ADMIN_DASHBOARD_ORIGIN's CORS match in .env.staging.
      name: 'admin',
      command: 'npm run dev -- --port 5173 --strictPort',
      cwd: path.join(ROOT, 'frontend'),
      env: { VITE_API_BASE_URL: API_URL },
      prefixColor: 'green',
    },
    {
      // portal's own "dev" script already pins --port 5175 (matching
      // PORTAL_URL in .env.staging) — --strictPort here applies on top of it.
      name: 'portal',
      command: 'npm run dev -- --strictPort',
      cwd: path.join(ROOT, 'portal'),
      env: { VITE_API_BASE_URL: API_URL },
      prefixColor: 'magenta',
    },
    {
      // landing's own "dev" script pins --port 5174 (matching LANDING_URL,
      // which the API's CORS for /public/signup-request defaults to).
      name: 'landing',
      command: 'npm run dev -- --strictPort',
      cwd: path.join(ROOT, 'landing'),
      env: { VITE_API_BASE_URL: API_URL, VITE_PORTAL_URL: PORTAL_URL, VITE_ADMIN_URL: ADMIN_URL },
      prefixColor: 'yellow',
    },
  ],
  {
    killOthers: ['failure', 'success'],
    prefix: 'name',
  }
);

result.catch(() => process.exit(1));

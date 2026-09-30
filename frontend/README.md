# mediacom-licensing admin dashboard

Internal React + TypeScript + Vite dashboard for managing customers and
licenses against the mediacom-licensing API. Lives in this repo (not a
separate one) since it's tightly coupled to and versioned with this specific
API.

## Setup

```
cp .env.example .env   # set VITE_API_BASE_URL to your running API
npm install
npm run dev
```

The API's `ADMIN_DASHBOARD_ORIGIN` env var must match wherever this runs
(defaults to `http://localhost:5173`, Vite's default dev port).

## Auth

JWT is kept in memory + `localStorage` (acceptable for an internal tool
behind its own login, not customer-facing). Any `401` response clears it and
redirects to `/login` — see `src/api/client.ts`'s `setUnauthorizedHandler`.

## Known limitations (by design, for this pass)

- **License list customer-name search only filters the currently loaded
  page**, not the full dataset across pages — the backend's `GET
  /admin/licenses` has no server-side search-by-customer-name filter (only
  `customerId`, `status`, `type`). Adding real cross-page search would need
  a backend change (e.g. a join/filter on the customer relation) that felt
  bigger than this pass warranted. Status/type filters and the customers
  page's own search ARE server-side and correct across all pages.
- No optimistic UI / caching layer — every screen just re-fetches on
  mount and after mutations. Simple, correct, occasionally a beat slower
  than a "real" product would bother with. Fine for an internal tool.

## Backend additions made alongside this dashboard

Two small, additive changes to the API were needed and made in the same
pass (see the root README's endpoint list and `src/routes/adminCustomers.ts`):

- `GET /admin/customers` list items now include `licenseCount`.
- `PATCH /admin/customers/:id` was added — it didn't exist before (only
  create/list/detail did), but the dashboard's customer detail screen needs
  to edit name/company/email/phone.

Nothing else was touched — everything else the dashboard does maps directly
onto the existing, already-tested API.

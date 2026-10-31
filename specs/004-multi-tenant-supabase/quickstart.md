# Quickstart: Validating the Multi-Tenant Supabase Migration

Prerequisites, setup, and runnable scenarios proving the feature works end to end. References
[data-model.md](data-model.md) and [contracts/](contracts/) rather than repeating them.

## Prerequisites

- A Supabase project (dev and prod are separate projects — T001), with its direct/session-mode
  Postgres connection string, `SUPABASE_URL`, publishable key, and a `strawberry_app` restricted
  role (`CREATE ROLE strawberry_app LOGIN PASSWORD '...';`) added to `strawberry-server/.env`
  and `strawberry-admin/.env` (replacing the legacy `DB_HOST`/`DB_USER`/`DB_PASS`/`DB_NAME`).
- Two tenants, each with its own owner account and store API key — created with
  `scripts/onboardTenant.js` (T031), not by hand:
  ```bash
  SUPABASE_SERVICE_ROLE_KEY=<service_role secret> \
    npm run onboard-tenant -- "Tenant A" "America/Los_Angeles" ownerA@example.com
  SUPABASE_SERVICE_ROLE_KEY=<service_role secret> \
    npm run onboard-tenant -- "Tenant B" "America/New_York" ownerB@example.com
  ```
  (distinct `timezone` values on purpose, to exercise FR-009). Each prints its storefront API key
  once — save both.

## Setup

```bash
# strawberry-server
npm run knex:migrate   # runs the consolidated migration against the Supabase connection string
```
`npm run reset-db` drops every table (a clean-slate reset, e.g. before re-running `knex:migrate`
from empty) — it is NOT a seed script and does not create tenants; use `onboard-tenant` above for
that.

## Validation scenarios

1. **Tenant isolation (admin)** — log into `strawberry-admin` as Tenant A's owner. Confirm the
   dashboard shows only Tenant A's products/menus. Attempt to fetch a Tenant B product by id
   directly against the API → expect `403`/`404`, not Tenant B's data (SC-002).
2. **Tenant isolation (storefront)** — repeat scenario 1's isolation check from the public side:
   call the public API using Tenant A's store API key, confirm only Tenant A's menu/service-window
   state appears; repeat using Tenant B's key (SC-001). No hostname/domain is involved — the key
   alone determines the tenant, matching how each tenant's separately deployed storefront would
   call the API in production.
3. **Full order per tenant** — using each tenant's own API key, browse the menu, add to cart,
   complete Stripe Checkout in test mode. Confirm the resulting order is recorded under the correct
   `tenant_id` and the price charged matches that tenant's own product price (SC-001, FR-005).
4. **Self-service password reset** — trigger a password-reset for Tenant A's owner via
   `strawberry-admin`'s forgot-password flow (Supabase Auth), confirm the new password logs them
   in without staff involvement (SC-003).
5. **Per-tenant timezone display** — with the two test tenants in different `timezone` values,
   confirm `strawberry-admin` and the storefront each display service-window/order times in their
   *own* tenant's zone, not the visitor's local zone or a hardcoded zone (FR-009).
6. **No regressions** — run the existing suites and confirm all pass:
   ```bash
   # strawberry-server
   npx lab
   # strawberry-admin / selloutPizza
   npm run test:unit
   ```
   (SC-005, Constitution Principle VI)

## T036 run results (2026-10-29, against the real dev Supabase project)

1/2. **Tenant isolation (storefront)** — run live against the real dev server (not just the
   automated suite): onboarded a real tenant via `onboard-tenant` (real Supabase Auth invite,
   confirmed delivered-or-rolled-back — see below) plus a second tenant created directly for the
   API-key check, each with its own `make-api-key`-issued key. Against the live server:
   - Tenant B's key → `GET /products` returns only Tenant B's product.
   - The real "Sell Out Pizza" tenant's key → `GET /products` returns `[]` (empty, not Tenant B's
     product) — confirmed it has no products of its own yet, and critically does not see
     Tenant B's.
   - The real tenant's key fetching Tenant B's product directly by id → `404` (RLS makes the row
     invisible rather than present-but-forbidden — satisfies "403/404, not Tenant B's data").
   **Admin-side isolation** (logging into `strawberry-admin` as a specific tenant's owner and
   visually confirming the dashboard) was not run — doing so needs a completed password-set flow
   via a real clicked email link, which needs a browser; no browser-automation tool was available
   in this pass. This is the same browser-dependent gap already disclosed for T024 (Playwright
   e2e). The *mechanism* this scenario depends on — that an admin JWT only ever resolves to its
   own tenant's RLS context — is exercised directly by the backend test suite's 18 tests
   (including the new T034/T035 impersonation/suspension tests), not merely assumed.
   Found and fixed one real, unrelated setup gap while running this: `selloutPizza/.env`'s
   `VITE_API_KEY` was issued against the old local Postgres database, so it no longer matched any
   row in the new Supabase dev database — reissued with `make-api-key` against the real tenant's
   current id and updated in `.env`.
3. **Full order per tenant (Stripe checkout)** — not run live in this pass (needs a browser for
   Stripe Checkout's hosted page); covered by the existing `CheckoutService`/cart test coverage
   plus T024's already-disclosed gap for a true browser e2e run.
4. **Self-service password reset** — not run live (same browser/email-click dependency as
   scenario 1). `onboard-tenant`'s real Supabase invite call itself WAS exercised live twice:
   once succeeding (a real invite email queued for a `+alias@gmail.com` address) and once hitting
   Supabase's own email rate limit — both times confirming the T031 QA-fix rollback behaves
   correctly under a real failure, not just the test's stub.
5. **Per-tenant timezone display** — confirmed live: `GET /services/next` with the real tenant's
   key returns `"timezone":"America/Los_Angeles"` directly from the real `tenants` row (not
   hardcoded) — the exact field `selloutPizza`'s `shopTime.ts`/service store now consume (T033).
6. **No regressions** — `strawberry-server`: 18/18 passing, no leaks. `selloutPizza`: 65/66
   passing — the one failure (`DefaultLayout.spec.ts`, an `$t`/i18n wiring issue in
   `StoreOpenBadge.vue`) predates this feature (already showing as a modified, uncommitted file
   before this session started) and is unrelated to multi-tenancy. `strawberry-admin`: 2/2 real
   tests passing; one test *file* fails to even load (`HelloWorld.spec.ts`, a stale
   project-scaffold leftover importing a `HelloWorld.vue` that doesn't exist in this codebase) —
   also pre-existing and unrelated.

All quickstart-verification tenants/keys/the real invited Auth user created during this run were
cleaned up afterward; the dev database was confirmed to contain only the real "Sell Out Pizza"
tenant again.

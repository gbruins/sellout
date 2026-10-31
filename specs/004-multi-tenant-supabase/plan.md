# Implementation Plan: Multi-Tenant Supabase Migration

**Branch**: `004-multi-tenant-supabase` | **Date**: 2026-10-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-multi-tenant-supabase/spec.md`

## Summary

Migrate `strawberry-server`'s self-hosted Postgres to Supabase, and add multi-tenancy so one
deployment can host multiple independent pizza shops with isolated data (FR-001–FR-011). Technical
approach (full detail in [research.md](research.md)): keep Knex/Hapi and all existing cart,
checkout, Stripe, and menu/discount logic as-is; add a shared-schema `tenant_id` + Postgres
Row-Level Security model for isolation; replace the admin's single hardcoded credential with
Supabase Auth (JWT verified server-side) plus a `public.admin_users` authorization table; move the
storefront's store API key from a single env var to one key per tenant in `tenant_api_keys` —
`strawberry-server` is the one shared deployment, while each tenant (including the platform
owner's own `selloutPizza`) runs its own separate storefront deployment identified solely by its
own key. This is an incremental refactor across three repos
(`strawberry-server`, `strawberry-admin`, `selloutPizza`), per Constitution Principle VII, not a
rewrite.

## Technical Context

**Language/Version**: Node.js, ESM (`strawberry-server`); Vue 3.5 + TypeScript/JavaScript mixed
(`strawberry-admin`, `selloutPizza`)

**Primary Dependencies**: Existing — Hapi 21, Knex 3, `pg` 8, Joi, Stripe SDK (server); Vue 3,
Pinia, Axios, `date-fns-tz` (admin). New — `jose` (server, JWT/JWKS verification against Supabase
Auth); `@supabase/supabase-js` (admin only, client-side login/signup/password-reset); `date-fns-tz`
added to the storefront (admin already has it).

**Storage**: Supabase-managed Postgres, replacing self-hosted Postgres (`DB_HOST=localhost`).
Accessed via the existing Knex query layer over Supabase's direct (non-pooled) connection string —
see [research.md](research.md) #1.

**Testing**: No new framework. `@hapi/lab` + `@hapi/code` (server, existing pattern), `vitest`
(admin + storefront unit), `playwright` (storefront e2e) — see [research.md](research.md) #8.

**Target Platform**: `strawberry-server` keeps its existing Render web-service hosting; only its
database target changes. Admin and storefront remain Vite-built SPAs, hosting unchanged.

**Project Type**: Web application spanning three repos (backend API, admin SPA, storefront SPA) —
Constitution Principle VII applies; this plan documents per-repo changes below.

**Performance Goals**: None newly introduced — the spec's success criteria (SC-001–SC-005) are
isolation- and correctness-focused, not throughput-focused. No regression versus current behavior.

**Constraints**: Existing cart/checkout/Stripe/discount behavior MUST be unchanged (FR-010). RLS
policies MUST NOT be bypassable by a route that forgets to filter by tenant (SC-002) — enforced via
`SET LOCAL app.current_tenant_id` before any tenant-scoped query, not by convention alone.

**Scale/Scope**: A handful of staff-provisioned tenants (FR-007) — not designed for self-service
onboarding at scale (explicitly out of scope per the spec's Q1 answer).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design — no changes required
after design; all gates below reflect the post-design state.*

| Principle | Status | Basis |
|---|---|---|
| I. Server Owns the Truth | PASS | FR-005 keeps pricing/inventory computed server-side from DB values; RLS (research #3) is isolation defense-in-depth, not a truth-computation mechanism — business logic stays in existing Hapi plugins. |
| II. Store Access Is Least-Privilege | PASS | FR-006 keeps the per-cart SHA-256 token model; the store API-key mechanism is extended (research #9), not weakened — now one key per tenant instead of one shared key, still a non-secret public client. |
| III. Cards Only, Stripe-Hosted | PASS (unaffected) | No change to payment flow; each tenant's existing Stripe price/product id columns are preserved (FR-010). |
| IV. Pickup Only | PASS (unaffected) | No delivery capability is introduced; `allowed_streets`/`address_discounts` only gain a `tenant_id` column. |
| V. Time Is Stored in UTC, Displayed in Each Tenant's Configured Time Zone | PASS | Principle amended to v1.1.0 specifically to support FR-009 before this plan was written (see spec.md Assumptions and the constitution's Sync Impact Report). |
| VI. Verify Before Done | PASS | [quickstart.md](quickstart.md) defines end-to-end validation scenarios; SC-005 requires all existing tests to keep passing. |
| VII. Specs Span Repos | PASS | This spec/plan lives once in `selloutPizza/specs/`; per-repo changes are listed below. |

No unjustified violations. One deliberate architectural complexity is tracked below.

## Project Structure

### Documentation (this feature)

```text
specs/004-multi-tenant-supabase/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/
│   ├── admin-auth.md
│   └── tenant-resolution.md
└── tasks.md              # Phase 2 output (/speckit-tasks — not created by this command)
```

### Source code (three repos, per Constitution Principle VII)

```text
strawberry-server/                         # Node.js backend (Hapi + Knex + pg)
├── server/plugins/auth/                   # AuthService.js: cookie strategy → JWT/JWKS bearer
│                                           #   verification (contracts/admin-auth.md)
├── server/plugins/serverExtensions/       # Hapi auth strategy registration
├── server/plugins/base/BaseService.js     # existing aspirational tenant_id comment becomes real
├── server/plugins/{cart,products,service,
│   serviceMenus,addressDiscounts,
│   allowedStreets}/*Model.js              # Joi models gain tenant_id
├── server/db/migrations/                  # new: 96_multi_tenant_foundation.js — a single
│                                           #   consolidated migration (tenants, admin_users,
│                                           #   tenant_api_keys, tenant_id columns, RLS policies),
│                                           #   not one file per step: this is a fresh, pre-launch
│                                           #   database with no need for separately revertible
│                                           #   steps. Numbered `96_` because Knex sorts migration
│                                           #   filenames as plain strings (tasks.md migration
│                                           #   numbering note) — a timestamp prefix would sort
│                                           #   before this repo's existing `20_carts.js`-style
│                                           #   files and break a fresh-database migration run
├── scripts/makeApiKey.js                  # extended: one key per tenant
└── scripts/reset_db.js                    # seed: multi-tenant fixtures (quickstart.md)

strawberry-admin/                          # Admin SPA (Vue 3 + Pinia)
├── src/pages/LoginPage.vue,
│   LogoutPage.vue                         # rework for Supabase Auth; add signup/forgot-password
├── src/plugins/api.js                     # withCredentials cookie → Authorization: Bearer
├── src/stores/app.ts                      # store tenant_id/role from GET /admin/me
└── src/composables/useBroadcastChannels.js # 401 handling adapts to bearer-token expiry

selloutPizza/                              # Storefront SPA for ONE tenant (the platform owner's
│                                           #   own shop) — other tenants deploy their own,
│                                           #   separate frontend; not part of this repo
├── (no tenant-resolution code changes — this deployment's existing store API key, now looked
│     up against tenant_api_keys instead of a single env var, already identifies its tenant)
└── (timezone display additions)
    → add date-fns-tz, use tenant's configured zone (FR-009)
```

**Structure Decision**: No new repos or top-level structure — this is additive within the three
existing repos, consistent with "refactor, not rewrite." `selloutPizza`'s exact file list is kept
generic above pending the task-breakdown phase (`/speckit-tasks`), since this plan intentionally
does not enumerate implementation-level file edits.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Per-request `SET LOCAL app.current_tenant_id` + transaction wrapper around tenant-scoped Knex queries | Postgres RLS session variables (`current_setting`) are connection/transaction-scoped; Knex's pooled connections are shared across requests, so the tenant context must be set and scoped per request, not globally | Filtering `tenant_id` manually in application code on every query (no RLS) was rejected — it reintroduces exactly the "a route forgets to filter" risk this migration exists to eliminate, with zero defense-in-depth if it happens |
| A second, restricted Postgres role (`SUPABASE_APP_DB_USER`) for the app's runtime connection, separate from the migration-owning role | Found while implementing T006: table owners and superusers bypass RLS regardless of `FORCE ROW LEVEL SECURITY` (verified empirically) — Supabase's default `postgres` connection role is documented to behave the same way, so using it for runtime queries would make RLS a no-op in production, not just locally | Relying on `FORCE ROW LEVEL SECURITY` alone was tried first and found insufficient — it only closes the "non-superuser owner" gap, not the superuser one, so a second role is unavoidable, not a convenience choice |

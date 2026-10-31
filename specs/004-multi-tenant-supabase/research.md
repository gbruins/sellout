# Phase 0 Research: Multi-Tenant Supabase Migration

Each entry: Decision / Rationale / Alternatives considered. Grounded in the existing stacks
(`strawberry-server`: Hapi 21 + Knex 3 + pg 8, ESM; `strawberry-admin`: Vue 3.5 + Pinia + Axios +
date-fns-tz; `selloutPizza` storefront: Vue 3.5 + Pinia) and the constitution (v1.1.0).

## 1. Database connection: Knex stays, points at Supabase directly (not the pooler)

**Decision**: Point Knex's existing `pg` connection at Supabase's direct (session-mode, port 5432)
Postgres connection string. Do not route through Supabase's pgbouncer transaction-mode pooler
(port 6543).

**Rationale**: `strawberry-server`'s README already documents that the SSE "next service" stream
needs Postgres `LISTEN/NOTIFY` and checkout creation needs a DB-held lock in a future multi-instance
deployment — both need session-scoped connection behavior. The new per-request tenant-scoping
mechanism (see #3) also needs `SET LOCAL` inside a held transaction, which transaction-mode pooling
does not support reliably. Knex migrations run unmodified against a direct connection.

**Alternatives considered**: Switch to `supabase-js`'s query client, or PostgREST — both rejected;
either would mean rewriting every existing Knex-based plugin (`cart`, `products`, `service`,
`stripe`, …) for no behavioral gain, contradicting the agreed "refactor, not rewrite" direction.

## 2. Admin auth: Supabase Auth (client-side) + JWT verification (server-side)

**Decision**: `strawberry-admin` uses `@supabase/supabase-js` in the browser for login, signup,
and password-reset against Supabase Auth, then sends the resulting access token as
`Authorization: Bearer <jwt>` on every call to `strawberry-server`. The current Hapi `cookieAuth`
strategy (`server/plugins/serverExtensions/index.js`, cookie name `sbsession`) is replaced with a
bearer-token strategy that verifies the JWT against Supabase's JWKS endpoint (using the `jose`
library) — no full `supabase-js` dependency needed server-side.

**Rationale**: Supabase Auth issues JWTs, not first-party cookies for a separate API origin. JWKS
verification is a small, auditable piece of code that keeps authorization decisions (which tenant a
request may touch) inside Hapi, where the rest of "Server Owns the Truth" (Principle I) already
lives, rather than deferring to Supabase's own session/cookie machinery.

**Alternatives considered**: Proxy all admin calls through Supabase Edge Functions — rejected as
unneeded indirection; `strawberry-server` already is the API. Trusting a `tenant_id` claim embedded
directly in the JWT via a custom Auth Hook — deferred (see #4); adds a hook-deployment dependency
not needed at current scale.

## 3. Tenant isolation: shared schema + `tenant_id` + Postgres RLS (per spec clarification Q2: A)

**Decision**: Every tenant-scoped table (`carts`, `cart_items`, `products`, `product_types`,
`service`, `service_menus`, `service_menu_products`, `allowed_streets`,
`address_discounts`) gets a `tenant_id uuid not null references tenants(id)` column, enforced by an
RLS policy `USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)`.
`strawberry-server` resolves the caller's `tenant_id` itself (from `admin_users` for admin requests,
from the matched store API key for storefront requests — see #9) and issues
`SET LOCAL app.current_tenant_id = '<uuid>'` at the start of the request's transaction, rather than
trusting a `tenant_id` claim read directly from the client's JWT.

**Rationale**: Resolved by the spec's own clarification. Keeping tenant resolution server-side (not
JWT-trusted) preserves Principle I even if a JWT claim were ever stale. A single shared connection
pool serves all tenants with no per-tenant connection routing.

**Alternatives considered**: schema-per-tenant, database/project-per-tenant — both explicitly
rejected in the spec's Q2 answer (operational complexity not justified at this scale).

**Addendum, found while implementing T006 (critical)**: table owners and superusers bypass RLS
regardless of `ENABLE`/`FORCE ROW LEVEL SECURITY` — confirmed empirically (identical row counts
under three different tenant contexts, including a nonexistent one, when connected as the
local dev owner role). `strawberry-server`'s `DB_USER` is the migration-owning role, and
Supabase's `postgres` connection role is documented to bypass RLS the same way — if the app's
runtime connection had used either, RLS would have been pure theater in both dev and production.
Fixed by: (1) `ALTER TABLE ... FORCE ROW LEVEL SECURITY` on every tenant-scoped table (protects
against a future non-superuser owner connection), and (2) `server/db/knex.js`'s runtime `db`
singleton now connects as a separate, restricted, non-owner/non-superuser role
(`SUPABASE_APP_DB_USER`/`DB_APPUSER` locally — this repo already had an unused `appuser` role
and `DB_APPUSER`/`DB_APPUSER_PASSWORD` env vars seemingly intended for exactly this, never wired
in) — migrations still run as the owner/superuser, since DDL needs those privileges. Verified:
the real tenant's row count is correct, a nonexistent tenant and "never set" both correctly
return zero rows. This role must be created once per Supabase project (dev and prod separately)
and granted table access by the migration itself — see tasks.md T001/T006.

**Second addendum, found by independent QA review of T006–T009**: `current_setting('app.current_tenant_id', true)::uuid` is not safe as written. It returns SQL NULL only for a
connection that has *never* touched this custom GUC. Once any transaction on a given pooled
connection has set it via `set_config(..., true)`, Postgres resets the placeholder GUC to `''`
(empty string) at commit — not back to "never set". A later transaction on that *same reused
pooled connection* that sets no context at all then gets `''`, and `''::uuid` throws, instead of
the intended "fail closed to zero rows". QA reproduced this deterministically with the pool
pinned to size 1. Fixed with a small SQL helper,
`app_current_tenant_id() RETURNS uuid AS $$ SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid $$`,
used by every policy instead of the raw expression — `NULLIF` collapses both "never set" (NULL)
and "reset to empty" (`''`) to NULL before the cast. Re-verified with the exact pool-size-1
repro QA used: now correctly returns 0 rows instead of throwing.

**Third addendum, found wiring up the real dev Supabase project (T001)**: Supabase automatically
enables RLS on every new table created in the `public` schema — including the 3 control-plane
tables (`tenants`, `admin_users`, `tenant_api_keys`), which `96_multi_tenant_foundation.js`
deliberately never enables RLS on itself (they must be readable *before* a tenant is known, to
resolve one in the first place). RLS enabled with zero policies means Postgres default-denies
every non-owner role regardless of `GRANT` — so `strawberry_app`'s `GRANT SELECT` on those 3
tables was silently a no-op. 5 of 13 server tests failed the first time the suite ran against
real Supabase (every API-key lookup and admin lookup returned nothing, surfacing as 401s). Local
Postgres has no such auto-enable behavior, so only testing against the real platform caught this.
Fixed by having the migration explicitly `ENABLE ROW LEVEL SECURITY` plus a permissive
`CREATE POLICY app_select ... FOR SELECT TO strawberry_app USING (true)` on all 3 tables,
matching the GRANT's already-intended permissiveness. Verified by resetting the dev DB to fully
empty and re-running the fixed migration from scratch, then the full test suite (13/13, no leaks).

## 4. Identity vs. authorization: `auth.users` (Supabase) + `public.admin_users` (app-owned)

**Decision**: Supabase's own `auth.users` table is the identity source (email, password hash,
password-reset flow — all Supabase-managed). A new `public.admin_users` table (one row per
Supabase user, `id` = `auth.users.id`) maps identity to `tenant_id` and `role`, and is what RLS
policies and Hapi's authorization check actually read.

**Rationale**: Standard Supabase multi-tenant pattern — Supabase Auth answers "who is this," the
app answers "what may they do." Keeps RLS policies a simple join instead of depending on custom JWT
claims.

**Alternatives considered**: Embed `tenant_id` in the JWT via a Supabase Auth Hook — viable future
optimization (saves one lookup per request) but adds a hook-deployment dependency; deferred until
the simple lookup table proves to be a bottleneck, which is unlikely at the staff-provisioned scale
implied by FR-007.

## 5. Per-tenant timezone storage

**Decision**: `tenants.timezone` stores an IANA zone string (default `'America/Los_Angeles'`).
Display conversion continues to happen in the UIs only (amended Constitution Principle V).
`strawberry-admin` already depends on `date-fns-tz` — reused as-is. The storefront (`selloutPizza`)
currently has no timezone-conversion dependency and needs `date-fns-tz` added.

**Rationale**: Minimal new dependency surface; admin already has the exact library needed.

**Alternatives considered**: Server pre-formats display strings — rejected, violates the existing
"display conversion happens in the UIs only" rule, now carried into the amended Principle V.

## 6. Out of scope: the in-process SSE hub / checkout lock

**Decision**: The in-process SSE stream hub (`GET /api/v1/services/next/stream`) and in-process
checkout-serialization lock — both called out in `strawberry-server`'s README as single-instance
-only — are **not** converted to Postgres `LISTEN/NOTIFY` as part of this feature.

**Rationale**: Multi-tenancy itself does not require multi-instance scaling; bundling that
migration here would expand scope beyond what the spec's user stories and FRs ask for. Flagged as a
follow-up feature for whenever multi-tenant traffic actually requires horizontal scaling.

**Alternatives considered**: Do it now anyway — rejected; keeps this plan scoped to the agreed
"refactor, not rewrite" framing.

## 7. Hosting

**Decision**: `strawberry-server` keeps its existing Render web-service hosting (per the
"Prepare for Render" commit); only its database target changes, from self-hosted
(`DB_HOST=localhost`)/Render-managed Postgres (`render.yaml`'s old `databases: strawberry-db`
block) to Supabase-managed Postgres. **Two separate Supabase projects** are used — one for local
development (credentials in local `.env` files), one for production (credentials set as
`sync: false` env vars directly in Render's dashboard, never committed) — the same dev/prod
separation the app already had via per-environment env vars, just with Supabase replacing both
self-hosted and Render-managed Postgres as the connection target.

**Rationale**: Minimal infrastructure change — only the data layer moves. Keeping dev and prod on
separate Supabase projects (rather than one project with separate schemas) avoids any risk of a
local migration or seed script touching production data, and matches how `DB_HOST` already
differed between local `.env` and Render's `fromDatabase`-wired production value before this
migration.

## 8. Testing approach

**Decision**: No new test framework. Server: continue using `@hapi/lab` + `@hapi/code` (existing
pattern, e.g. `server/plugins/cart/_tests/index.test.js`); add tenant-isolation tests (two tenants,
one request per tenant, assert no cross-tenant leakage) alongside existing route tests. Admin and
storefront: continue using `vitest` (and `playwright` for storefront e2e) for the new
login/signup/password-reset UI and the updated bearer-token API client.

**Rationale**: Matches Constitution Principle VI (Verify Before Done) without introducing tooling
churn unrelated to this feature.

## 9. Storefront tenant resolution (public, unauthenticated requests)

**Decision**: Storefront (public) requests resolve `tenant_id` solely from the existing store
Basic-auth API key mechanism (`scripts/makeApiKey.js` pattern), extended to generate one key per
tenant instead of one shared key. No domain/hostname lookup is involved. Each tenant runs its own
**separate** storefront deployment — its own codebase instance, configured at build/deploy time
with that one tenant's own API key. `selloutPizza` (this repo) is the storefront for exactly one
tenant: the platform owner's own shop. A new tenant builds and deploys its own frontend (which may
start as a fork of `selloutPizza` or be entirely custom) and only needs its own API key to talk to
the shared backend.

**Rationale**: Corrects an earlier misreading of "host multiple independent pizza shops under one
deployment" (feature input) — that "one deployment" refers to the shared `strawberry-server`
backend, not a shared storefront. Since each storefront is already a separate deployment with its
own configured API key (as `selloutPizza` does today, just with a shared key instead of a
per-tenant one), no new resolution mechanism is needed — the key alone identifies the tenant, the
same way it already identifies "the store" today.

**Alternatives considered**: Domain/hostname-based resolution against a single shared storefront
deployment — drawn up initially, then rejected once it was confirmed each tenant deploys its own
separate frontend; it would have added DNS/hosting coordination and a cross-check with no benefit
over the key alone.

## 10. Checkout stock reservation keeps its own short transaction, not the ambient request one

**Decision**: `reserveCheckoutStock` (the function that `FOR UPDATE`-locks the service row,
checks stock, and writes the provisional hold) opens its own transaction, scoped by a
`tenantId` value rather than reusing the caller's ambient per-request `trx`.

**Rationale**: `createCheckout` calls this, then makes a slow external Stripe API call
afterward. If the lock were held on the request's ambient transaction (open for the whole
request, including that Stripe call), two concurrent checkout attempts for a near-sold-out
service would serialize through the entire Stripe round-trip instead of just the quick DB
check — a real concurrency regression under load, not a style preference. This preserves the
pre-tenancy design's behavior (the lock was already released via its own commit before the
Stripe call; only the connection now also sets a tenant context).

**Alternatives considered**: Reusing the ambient `trx` throughout — simpler code, rejected once
the lock-duration implication was worked through; a Postgres `SAVEPOINT` (nested transaction) —
rejected because savepoints do not release row locks early, only the enclosing transaction's
commit/rollback does, so nesting would not have solved the problem at all.

## 11. The Stripe webhook resolves its tenant via a narrow SECURITY DEFINER function

**Decision**: `completeCartFromSession` (called from `POST /stripe/webhook`, `auth: false`,
authenticated by Stripe's signature rather than any tenant-bearing session) has no tenant
context to work with at all when it starts. A single-purpose Postgres function,
`get_cart_tenant_id(p_cart_id uuid) RETURNS uuid SECURITY DEFINER`, resolves the owning tenant
for one cart id, bypassing RLS for exactly that one lookup (added in migration
`96_multi_tenant_foundation.js`, callable by the restricted app role). Everything else the
webhook does then runs inside a normal tenant-scoped transaction, same as any other request.

**Rationale**: Narrow and auditable beats broad: this function returns exactly one column of
one table for one caller-supplied id — it is not a general-purpose RLS bypass, and the
restricted app role still cannot read/write any tenant-scoped table outside a properly scoped
transaction anywhere else.

**Alternatives considered**: Running the whole webhook handler as the owner/superuser
connection — rejected, that would bypass RLS for everything the webhook does, not just the one
lookup that genuinely needs it.

## 12. The SSE "live shop status" hub is now per-tenant, not per-process

**Decision**: `ServiceStream`'s in-process hub (pushes live shop-open/sold-out status to
connected storefronts) tracked a single global `lastJson`/`eventId` and broadcast to every
listener regardless of tenant. Changed to track dedup state and event ids per tenant
(`lastJsonByTenant`/`eventIdByTenant`) and filter broadcasts to only that tenant's listeners.

**Rationale**: Under RLS with no tenant context at all (the hub's original calls used the bare
`db` singleton), this would have returned empty/broken state for every tenant, including the
one real tenant that exists today — a regression this migration must not introduce, independent
of whether multi-tenant SSE sharing is fully solved. This fix makes the hub correct for however
many tenants happen to share one process; it does **not** make the hub itself horizontally
scale across multiple server processes — that remains the explicitly deferred problem from
decision #6 (would need Postgres `LISTEN/NOTIFY`).

**Alternatives considered**: Leaving the hub single-tenant and accepting broken live-status
display post-migration — rejected as an unnecessary regression for work that was actually
in scope (making existing functionality keep working under RLS, as opposed to making it support
multiple tenants simultaneously, which is the genuinely deferred part).

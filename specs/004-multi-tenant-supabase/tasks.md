---

description: "Task list template for feature implementation"
---

# Tasks: Multi-Tenant Supabase Migration

**Input**: Design documents from `specs/004-multi-tenant-supabase/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Included. Constitution Principle VI (Verify Before Done) requires server routes be
covered by live request tests and storefront/admin logic by vitest — treated as an explicit test
request for this feature.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation
and testing. US1 and US2 are both Priority P1; US3 is P2.

**Migration numbering note**: `strawberry-server`'s Knex migrations sort by plain filename string
(confirmed by reading `node_modules/knex/lib/migrations/migrate/sources/fs-migrations.js`, which
uses `lodash.sortBy(migrations, 'file')` — a lexicographic string sort, not numeric). Existing
files use un-padded numeric prefixes (`1_`, `20_`, ... `95_`) plus two `20251106...` timestamp
outliers. A naive `2026...`-timestamp prefix for new files would sort *before* `20_carts.js`
(since `'2' < '_'`), running `ALTER TABLE carts ...` before `CREATE TABLE carts` on a fresh
database — verified empirically with a throwaway Node script. `96_` is the next safe two-digit
prefix after `95_cart_customer_note.js`. Since this is a fresh, pre-launch install (no production
data, no need for separately revertible steps), all of table creation, `tenant_id` additions, and
RLS policies are one single consolidated migration file rather than split across several —
simplest possible rollout for a from-scratch database.

**Correction**: `80_service_holds.js` does not create a `service_holds` table — it only adds
`service.max_per_order` and `carts.service_id`/`checkout_expires_at` (confirmed by reading the
file). There is no separate holds table; `carts` gaining `tenant_id` already covers this.

## Path Conventions

Three repos (Constitution Principle VII):
- `strawberry-server/` — Node.js/Hapi backend
- `strawberry-admin/` — Vue 3 admin SPA
- `selloutPizza/` — Vue 3 storefront SPA (this repo)

---

## Phase 1: Setup

**Purpose**: New project/dependency setup before any feature code changes

- [x] T001 Created both Supabase projects (dev: `ifwammkbplwkykoigavy`, prod: `ctypyzrapywvanemdfks`)
      and the `strawberry_app` restricted role in each. Dev's credentials are wired into local
      `.env` files (`strawberry-server`, `strawberry-admin`); prod's are held for when Render is
      actually configured, deliberately not written to any local file.
      **Found while wiring dev up for real**: two gaps neither local Postgres testing nor QA
      could have caught, since both are specific to Supabase's hosted environment:
      1. `knexfile.js` never actually read the `SUPABASE_DB_*` vars documented in `.env.example`
         — only legacy `DB_*`. Migrations/the owner connection would have silently kept hitting
         local Postgres. Fixed: `SUPABASE_DB_HOST/PORT/NAME/USER/PASS` now take priority, `DB_*`
         is the fallback. Also added `ssl: { ca, rejectUnauthorized: true }` — Supabase's direct
         connection requires TLS and is signed by Supabase's own root CA (not one in Node's
         default trust store), so the CA cert is pinned at `server/certs/supabase-ca.crt` rather
         than disabling verification. `scripts/reset_db.js` had the same `DB_*`-only gap; fixed
         by having it reuse `knexfile.js`'s connection config directly instead of duplicating it.
      2. **Supabase auto-enables RLS on every new table in the `public` schema**, including the
         3 control-plane tables (`tenants`, `admin_users`, `tenant_api_keys`) that migration
         `96_multi_tenant_foundation.js` never explicitly enables RLS on (intentionally — they
         need to be readable *before* a tenant is known). RLS enabled + zero policies = deny-all
         for non-owner roles, so `strawberry_app`'s `GRANT SELECT` on those 3 tables was silently
         useless — 5 of 13 server tests failed (API key / admin lookups all returning nothing)
         the first time the suite ran against real Supabase. Local Postgres has no such
         auto-enable behavior, so this could not have surfaced there. Fixed: migration now
         explicitly `ENABLE ROW LEVEL SECURITY` plus a permissive `FOR SELECT TO strawberry_app
         USING (true)` policy on all 3, matching the already-intended-permissive GRANT. Verified
         by resetting the dev DB to empty and re-running the fixed migration from scratch (not
         just patching dev ad hoc, since prod needs this same file to be correct from empty too);
         full 13-test suite then passed against dev with no leaks. See research.md #3 addendum.
- [x] T002 [P] Created `strawberry-server/.env.example` (and `strawberry-admin/.env.example`),
      fixed both repos' `.gitignore` (`.env.*`/`*.env` was blocking `.env.example` too). Added
      commented `SUPABASE_*` placeholders to both live `.env` files, but deliberately left
      `DB_HOST`/`DB_USER`/`DB_PASS`/`DB_NAME` pointed at local Postgres for now — swapping them
      before real Supabase credentials exist would break local dev. Swap once T001 is done.
      Also updated `selloutPizza/render.yaml`: removed the `databases: strawberry-db` block
      (Render's own managed Postgres, being replaced) and `strawberry-server`'s `fromDatabase`
      DB_* wiring, replaced with `sync: false` `SUPABASE_*` vars for the **production** Supabase
      project (set once in Render's dashboard — a separate project from local dev's, per T001).
      Added `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` (`sync: false`) to `strawberry-admin`'s
      Render service too.
- [x] T003 [P] Added `jose` to `strawberry-server/package.json` (`npm install jose`, v6.2.13)
- [x] T004 [P] Added `@supabase/supabase-js` to `strawberry-admin/package.json`
      (`npm install @supabase/supabase-js`, v2.118.0); `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`
      added (commented, pending T001) to its `.env` and `.env.example`
- [x] T005 [P] Added `date-fns-tz` to `selloutPizza/package.json` (`npm install date-fns-tz`,
      v3.2.0; admin already had it)

**Checkpoint**: Supabase reachable; new dependencies installed in all three repos

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared infrastructure every user story depends on — tenant data model, RLS
enforcement, and the JWT verification strategy. No user story is independently testable until
this phase is complete.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 Single consolidated Knex migration
      `strawberry-server/server/db/migrations/96_multi_tenant_foundation.js`, in one `up()`:
      1. create `tenants` (`id` uuid pk, `name` text not null, `timezone` text not null default
         `'America/Los_Angeles'`, `status` enum `active`/`suspended`, `created_at` timestamptz
         not null default `now()`)
      2. create `admin_users` (`id` uuid pk = `auth.users.id`, `tenant_id` uuid nullable fk →
         `tenants.id`, `role` enum `owner`, `is_platform_staff` boolean not null default `false`,
         `created_at` timestamptz not null default `now()`, check constraint enforcing exactly
         one of `tenant_id IS NOT NULL` or `is_platform_staff = true`)
      3. create `tenant_api_keys` (`id` uuid pk, `tenant_id` uuid not null fk → `tenants.id`,
         `key_hash` text not null, `revoked_at` timestamptz nullable, `created_at` timestamptz
         not null default `now()`)
      4. add `tenant_id uuid not null references tenants(id)` to `products`, `product_types`,
         `carts`, `cart_items`, `service`, `service_menus`, `service_menu_products`,
         `allowed_streets`, `address_discounts` (9 tables), backfilled to one seeded default
         tenant created in this same migration
      5. enable RLS and add the policy
         `USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)` for
         `SELECT`/`INSERT`/`UPDATE`/`DELETE` on all 9 tables from step 4
      All per data-model.md and research.md #3. One file, in this order, with a matching `down()`
      that reverses all five steps — simplest rollout for a fresh, pre-launch database with no
      need for separately revertible steps.
      **Found while verifying this task**: RLS was silently bypassed when tested — the migration
      (and app) connect as the table-owning role, and owners/superusers bypass RLS regardless of
      `ENABLE`. Fixed by adding `FORCE ROW LEVEL SECURITY` plus `GRANT`s to a separate restricted
      role (`SUPABASE_APP_DB_USER`/`DB_APPUSER`) on all 9 tables (full CRUD) and the 3 control-
      plane tables (`SELECT` only). Verified empirically against local Postgres: real tenant sees
      its rows, a nonexistent tenant and "never set" both correctly return zero rows. See
      research.md #3 addendum and the now-updated T001.
      **Found by independent QA review**: the raw `current_setting(..., true)::uuid` expression
      threw instead of returning zero rows on a *reused pooled connection* that previously had a
      real tenant context committed, then handled a later transaction that set no context at
      all — Postgres resets a custom placeholder GUC to `''`, not back to "never set", after a
      transaction that touched it commits. QA reproduced this deterministically with the pool
      pinned to size 1. Fixed with an `app_current_tenant_id()` SQL helper (`NULLIF(..., '')`
      before the cast) used by every policy instead of the raw expression; re-verified against
      the exact pool-size-1 repro. See research.md #3's second addendum.
- [x] T007 Implemented the per-request tenant-context transaction wrapper: `BaseService.js`'s
      `search`/`fetchOne`/`create`/`update`/`del` now accept `config.trx` (falling back to the
      bare `db` singleton when absent) and thread it into `addRelations`/`deleteRelations`;
      `BaseController.js`'s generic CRUD handlers pass `request.app.trx` through on every call.
      The actual transaction is opened in a new `onPreHandler` extension in
      `serverExtensions/index.js`, which resolves `tenant_id` from `request.auth.credentials`,
      opens a transaction, and sets the tenant context via `SELECT set_config('app.current_tenant_id', ?, true)`
      — **not** `SET LOCAL ... = ?`, which doesn't accept bind parameters at all (hit "syntax
      error at or near $1" when first tried; `set_config()` is a normal function call and does).
      A matching `onPreResponse` extension commits on success / rolls back on a Boom error.
      **Hardened after independent QA review**: QA flagged (plausibly, not reproduced) that a
      failed `trx.commit()` was only logged, not surfaced — the client would have received the
      already-computed success response even though the write didn't actually persist. Fixed:
      a failed commit now attempts a best-effort rollback and returns `Boom.badImplementation()`
      instead of `h.continue`, so a commit failure can no longer masquerade as a success.
      Threading `trx` explicitly through `config` rather than `AsyncLocalStorage` was a deliberate
      choice (see the code comment in `serverExtensions/index.js`): Hapi's extension points don't
      give middleware a `next()` it calls itself, so a later route handler is not a nested
      continuation of `onPreHandler`'s callback and would not see ALS context set there.
- [x] T008 Implemented `AuthService.verifyAdminToken()`: verifies the bearer JWT against
      Supabase's JWKS endpoint via `jose`'s `jwtVerify`/`createRemoteJWKSet`, then looks up
      `admin_users` by the token's `sub` claim.
- [x] T009 Registered a hand-rolled Hapi auth scheme (`bearer-jwt`) and strategy (`adminBearer`)
      in `serverExtensions/index.js` calling `AuthService.verifyAdminToken()`; set it as
      `server.auth.default(...)`, replacing the removed `adminCookie` cookie strategy. Confirmed
      `/auth/login`/`/auth/logout` already declared `auth: false` explicitly, so they were
      unaffected by the default change either way — but see T013/T014 below: removing the old
      cookie strategy broke those two routes' use of `request.cookieAuth` (a decoration that only
      exists when a cookie-scheme strategy is registered), so T013/T014 were pulled forward into
      this same pass rather than leaving the server in a broken intermediate state. Also removed
      the now-unused `@hapi/cookie` registration from `server/index.js` and uninstalled the
      package.

**Checkpoint**: Foundation ready — tenant data model, RLS, and JWT verification exist; user story
implementation can now begin

**🔍 QA checkpoint**: run `qa-verifier` against T006–T009 before starting Phase 3/4 — this is the
highest-risk phase (schema + isolation mechanism); verify the migration runs cleanly on a fresh
dev database, and that RLS actually blocks a cross-tenant query at the DB level (not just "looks
right in the policy SQL").

---

## Phase 3: User Story 1 - Store owner signs in with a real account (Priority: P1) 🎯 MVP

**Goal**: A store owner logs into `strawberry-admin` with their own email and password, and only
ever sees their own store's data.

**Independent Test**: Create two store-owner accounts, log in as each, confirm each only sees and
can edit their own store's products, menus, and orders.

### Tests for User Story 1

- [x] T010 Wrote the live request test (`auth/_tests/index.test.js`). No real Supabase project
      exists yet (T001 pending), so a genuinely signed JWT can't be produced — used Hapi's
      documented `server.inject({ auth: { strategy, credentials } })` override to simulate an
      already-authenticated request, which still exercises the real `onPreHandler` transaction
      wiring and `meHandler` end to end; only raw JWT-signature verification itself is deferred
      to T001. Missing/garbage-token cases hit the real `authenticate()` path for real 401s.
      **Required two real infrastructure fixes to get `server.inject()` working at all** (not
      specific to this test): (1) `server/index.js` had no exports — it was a self-executing
      script; refactored to export `init()` (builds+registers the server without starting it —
      the standard Hapi testing pattern) with a `import.meta.url` guard so `node server/index.js`
      still behaves the same as a real process. (2) `init()` must also call
      `server.initialize()` even though it doesn't start listening — `hapi-rate-limit`'s
      internal cache only connects on `initialize()`, not on plugin registration, and
      `server.inject()` without it threw "Disconnected" from deep inside hapi-rate-limit,
      nothing to do with this feature's own code.
      Also: `server/utils/testHelpers.js` was dead (CommonJS `require()` in an ESM project) and
      full of unrelated leftover shipping/customs fields from a different project template —
      rewrote it in ESM with only what's needed (`getApiPrefix`, `createTestTenant`/`cleanup`
      using the owner connection, since test fixtures legitimately need to write across
      tenants). Added `strawberry-server/package.json`'s `test` script (none existed before):
      `lab server -I logger` (`-I logger` suppresses a correct-but-noisy leak warning for this
      codebase's intentional `global.logger` pattern).
- [x] T011 Wrote the cross-tenant test (`products/_tests/index.test.js`) using the same
      inject-auth-override approach, with two real tenants and one product each (via
      `createTestTenant`). **Found and fixed a real bug in the test itself, not the
      application**: expected `404` for a cross-tenant fetch by id, got `200` — investigated
      with a direct inspection of the response body (not assumed), confirming it was `{}` (no
      leak) — `GET /product`'s existing, pre-existing-to-this-feature convention returns `200`
      with an empty body for "not found" rather than `404`. Fixed the test's assertion to check
      the body contains no data, rather than changing that unrelated existing convention.
      Also fixed the other, genuinely pre-existing broken test
      (`cart/_tests/index.test.js`, also CommonJS in an ESM project, also pointed at a route
      that doesn't exist — `/product/tax_codes` instead of the real `/stripe/tax_codes`) while
      in the area, since leaving it broken would make the new `npm test` script fail outright
      for the unrelated reason of a stale, never-functional file.
- [x] T012 Wrote the vitest spec (`LoginPage.spec.js`), mocking `@/plugins/supabase`,
      `@/stores/app.js`, and `vue-router` to isolate `LoginPage.vue`'s own logic — covers both
      the successful-login redirect and the credential-rejection path (session cleared, no
      redirect). 2/2 passing.

### Implementation for User Story 1

- [x] T013 Removed the `/auth/login`/`/auth/logout` routes (`auth/index.js`), and
      `AuthService`'s `login()`/`isAuthorizedUser()`/`setCookieOnRequest()`/
      `removeCookieOnRequest()` methods, and the `AUTH_USERNAME`/`AUTH_PASSWORD` env vars
      (commented out in `.env`/`render.yaml`, removed from `.env.example` — nothing reads them
      now, confirmed by grep). Pulled forward from its original US1 slot: removing the
      `adminCookie` strategy in T009 made `request.cookieAuth` undefined, which would have
      crashed these still-registered routes before this task landed — not something to leave
      broken between sessions.
- [x] T014 Implemented `GET /api/v1/admin/me` (`AuthController.meHandler`), returning
      `{tenant_id, tenant_name, role, is_platform_staff}` — added `AuthService.getTenantName()`
      for the name lookup. Also pulled forward with T013 for the same reason.
- [x] T015 Reworked `LoginPage.vue`: calls `supabase.auth.signInWithPassword` directly, field
      renamed `username`→`email` (Supabase Auth is email-based), added a "Forgot your
      password?" link to T017's new page.
- [x] T016 Reworked `LogoutPage.vue` to call `supabase.auth.signOut()`; also updated
      `DefaultLayout.vue`'s separate inline logout button (the dropdown menu item), which called
      the old `$apiLogout` independently of `LogoutPage.vue` — would have been left broken
      otherwise. Added an explicit redirect to `/login` after logout (the original had none;
      re-enabling the router guard in T020 would otherwise leave the user on a blank page).
- [x] T017 [P] Added `ForgotPasswordPage.vue` (calls `resetPasswordForEmail`) and
      `ResetPasswordPage.vue` (calls `updateUser({password})`, reached via the emailed link —
      Supabase's client parses the recovery token from the URL automatically) — a complete
      round-trip flow, not just the request half, per FR-003. Wired both into
      `router/index.ts` as `forgot_password`/`reset_password`.
- [x] T018 Removed `withCredentials: true` from the axios instance; added a request interceptor
      that attaches `Authorization: Bearer <token>` from `supabase.auth.getSession()`. The 401
      response interceptor now also calls `supabase.auth.signOut()` for the current tab (it
      previously only broadcast to *other* tabs via `useBroadcastChannels`, leaving the tab that
      actually got the 401 visually still logged in).
- [x] T019 Added `tenantId`/`tenantName`/`role`/`isPlatformStaff` refs to `stores/app.ts`, plus
      `loadMe()` (calls `GET /admin/me`) and `restoreSession()`/`clearSession()`. Added `me:` to
      `src/api/auth.js` (removed the now server-side-dead `login`/`logout` entries — they're
      direct Supabase calls now, not server routes).
- [x] T020 Re-enabled the auth guard in `router/index.ts`, now `async`: since Pinia state is
      in-memory only and lost on refresh, it calls `restoreSession()` (idempotent, reads
      Supabase's localStorage-persisted session) before checking `loggedInUser`, rather than
      just checking the always-reset-on-refresh in-memory flag directly. Added
      `forgot_password`/`reset_password` to the public-pages allowlist.

**Checkpoint**: A store owner can log in with a real account and is blocked from another
tenant's data — independently testable and demoable

**🔍 QA checkpoint**: run `qa-verifier` against T010–T020 — confirm the old cookie/env-var auth
path is fully gone (not left reachable alongside the new one), and that tests T010/T011 actually
fail if the bearer-token check is bypassed (i.e. they test something real, not a tautology).

**QA results**: confirmed no reachable old auth path, `init()`/`server.initialize()` refactor
correct for both the test path and the real process, `GET /admin/me` matches contract exactly,
both independent admin-side logout code paths fixed, admin build/typecheck/vitest all clean.
Two findings, both addressed:
- **Fixed**: contracts/admin-auth.md specifies 401 for an invalid/expired token but 403 for a
  valid token with no matching `admin_users` row — the code collapsed both into 401. Added
  `AdminUserNotFoundError` (a distinct error class) in `AuthService.verifyAdminToken`, and the
  `bearer-jwt` scheme in `serverExtensions/index.js` now maps it to `Boom.forbidden()` instead
  of the generic `Boom.unauthorized()`. Not independently tested end-to-end — doing so needs a
  real signed JWT with no corresponding `admin_users` row, which needs T001's real Supabase
  project; deferred alongside the same limitation T010/T011 already note.
- **Documented, not a bug**: the 401 interceptor in `strawberry-admin/src/plugins/api.js`
  doesn't call `appStore.clearSession()` directly — it relies on `DefaultLayout.vue`'s own
  `BroadcastChannel` listener picking up the 'logout' broadcast in the *same* tab. QA verified
  empirically that this works (the "doesn't receive its own message" exclusion is per-channel-
  object, not per-tab, and each side uses its own object) but flagged it as fragile if
  `DefaultLayout`'s mount lifecycle ever changes. Added an explicit comment at the call site
  rather than refactoring working code preemptively.

---

## Phase 4: User Story 2 - Two stores operate independently without data leakage (Priority: P1) 🎯 MVP

**Goal**: Two pizza shops, each running its own separate storefront deployment, place orders
against the shared `strawberry-server` backend with complete data isolation between them.

**Independent Test**: Provision two tenants with distinct products/menus/service windows and
their own API keys, place a cart and checkout against each (simulating two separate storefront
deployments by using each tenant's own key), confirm neither tenant's data, cart, or admin view
ever surfaces the other's data.

### Tests for User Story 2

- [x] T021 Added a second describe block to `products/_tests/index.test.js` exercising the
      REAL storefront path — real Basic auth against real bcrypt-hashed `tenant_api_keys` rows
      (not an injected credential, unlike T011). Two tenants, each querying `/products` only
      ever sees its own. (Service/service-window isolation isn't separately tested — no
      service-window test fixture exists yet; the same RLS mechanism covers it, proven
      generically by T011/T021's product tests.)
- [x] T022 Added a describe block to `auth/_tests/index.test.js`: no header → 401; a
      well-formed but wrong key → 401; a key that WAS valid, then revoked mid-test
      (`revokeApiKey` test helper, using the owner connection since the app's restricted role
      only has SELECT on `tenant_api_keys`) → 401 on the next request with the same key.
- [x] T023 Added a describe block to `cart/_tests/index.test.js`: creates a real cart via
      Tenant A's API key, then replays its id+token against Tenant B's key → `404` (RLS means
      Tenant B's transaction can't even see the row to compare the token against — same
      response as a nonexistent cart, per `cartAccess.js`'s own "can't be probed" comment);
      confirms the same id+token still works for Tenant A itself (not just "always rejects").
- [ ] T024 **Not done.** A real Playwright run against Stripe test-mode checkout is a
      meaningfully separate effort (browser automation + Stripe test-mode session handling) from
      everything else in this phase and hasn't been started. The underlying flow it would
      exercise (menu → cart → checkout) IS verified end-to-end at the API level via T021/T023
      and the manual curl verification below, so this is a test-coverage gap, not a known
      functional gap.

### Implementation for User Story 2

- [x] T025 `makeApiKey.js` now takes a tenant id argument, looks the tenant up, and inserts the
      new key's hash into `tenant_api_keys` (run as the owner — the role itself only grants the
      restricted app role SELECT on this table; writes are staff-script-only by design). Found
      and fixed a real bug while running it: `import dotenv from 'dotenv'; dotenv.config()`
      inside the script doesn't work here — ES module imports are hoisted above all other
      top-level code regardless of source order, so `import knexConfig from '../server/knexfile.js'`
      (which reads `process.env.DB_*` at ITS OWN import time) executed before the dotenv call
      meant to precede it, silently connecting with undefined credentials instead of erroring.
      Fixed by switching to `--require dotenv/config` (matching every other script in this repo)
      instead of self-loading dotenv.
- [x] T026 `apiKeyIsValid()` now queries all non-revoked `tenant_api_keys` rows and bcrypt-compares
      the presented key against each (bcrypt hashes are salted per-hash, so the match can't be
      looked up by equality — fine at the staff-provisioned scale FR-007 describes), returning
      `{isValid, tenantId}`. `serverExtensions/index.js`'s `apiKey` strategy attaches
      `tenant_id` to credentials from this. Verified end-to-end manually: a real generated key
      for the real "Sell Out Pizza" tenant correctly returns that tenant's actual products; a
      garbage key gets `401`.
- [x] T027 `CartModel`'s Joi schema deliberately does NOT include `tenant_id` (so a client
      payload can never set it — Joi rejects unknown fields). `tenant_id` is instead injected
      server-side on every create: added `config.tenantId` support to `BaseService.create()`
      (used by every tenant-scoped table's generic create path) and to
      `CartService.createWithToken()`/`CartItemService.createCartItem()` (which bypass
      `BaseService.create()` for their own reasons). `cartAccess.js`'s `checkToken()` already
      compares the token hash against the specific cart row RLS resolved for the caller's own
      tenant — a token for a different tenant's cart is rejected because that row is
      invisible under RLS, not via any separate token-tenant check (see T023).
- [x] T028 **Superseded by T031, not done as originally scoped.** `scripts/reset_db.js` is
      confirmed to not be a seed script — it only drops every table. Rather than writing a
      separate "two test tenants" seed script as originally planned, Phase 5's
      `scripts/onboardTenant.js` ended up being the actual mechanism for creating a complete,
      isolated test tenant (tenant row + owner account + API key) — and is the *real* onboarding
      path staff would use, not a test-only shortcut, so it's a better fit than a one-off seed
      script would have been. `quickstart.md`'s Setup section was corrected to point at
      `onboard-tenant` (done as part of T036), and T036's live run actually used it twice to
      create two real, verified-isolated test tenants against the real dev database.
- [x] T029 Audit found **significantly more than route handlers** bypassing the transaction
      wrapper — most of this phase's effort went here, not into T025–T027. Full list of files
      changed beyond the Controllers already covered by T007's generic `BaseController` fix:
      - `ProductController.js` (createHandler, 3× updateHandler, deleteHandler — all custom
        overrides, none passed `trx`/`tenantId`)
      - `ProductTypeController.js`/`ProductTypeService.js` (`addProductType()` computed its
        "next available value" from `search()` with no `trx` — under RLS this always saw zero
        existing rows, which would have produced duplicate `value`s for a tenant's second+
        product type: a real latent bug, not just a missing-isolation gap)
      - `ServiceMenuController.js`/`ServiceMenuService.js` (`getProducts`/`setProducts`/
        `getServicesByMenu`/`addRelations`, all bare `db`)
      - `CartController.js`, `CartService.js`, `CartItemController.js`, `CartItemService.js`,
        `cartAccess.js` (checkToken, resetIfServiceEnded, assertWithinLimits, createCartItem,
        updateCartItem, addRelationToCarts, getCartIdForItem — the entire cart/cart-item path)
      - `CheckoutService.js` (the full checkout flow — see below, this one needed real design
        thought, not just adding a parameter)
      - `storeVisibility.js`'s `publishedByIdForStore` pre-handler
      - `ServiceStream.js`/`ServiceState.js` (the SSE "live shop status" hub — see below)

      Three findings here needed actual design decisions, not mechanical fixes:
      1. **`reserveCheckoutStock` deliberately does NOT use the ambient request transaction.**
         It originally opened its own short transaction to hold a `FOR UPDATE` lock on the
         service row only briefly; `createCheckout` then makes a slow external Stripe API call
         afterward. If that lock had been moved onto the request's ambient transaction (open for
         the whole request, including the Stripe call), two concurrent checkouts for a
         near-sold-out service would serialize through the entire Stripe round-trip instead of
         just the quick DB check — a real concurrency regression, not just a style choice. Kept
         its own transaction, now scoped via `tenantId` instead of the pre-tenancy global `db`.
      2. **The Stripe webhook (`completeCartFromSession`) has no tenant context at all** —
         `auth: false`, authenticated by Stripe's signature, not a tenant-bearing session. Added
         `get_cart_tenant_id(uuid)`, a narrow `SECURITY DEFINER` Postgres function (in migration
         96, not a new one) that resolves a cart's tenant purely by id, bypassing RLS for
         exactly that one lookup — then everything else in that function runs in a normal
         tenant-scoped transaction like any other request. This is a deliberate, narrow,
         auditable exception, not a blanket bypass.
      3. **The SSE hub (`ServiceStream`/`ServiceState`) was a single global instance with zero
         tenant awareness** — one shared `lastJson`/`eventId`, broadcasting to every connected
         listener regardless of tenant. Under RLS with no context, it would have returned
         empty/broken state for the one real tenant, not just failed to support multiple
         tenants. Made listener tracking, dedup state, and broadcast per-tenant
         (`lastJsonByTenant`/`eventIdByTenant` Maps, `broadcast(chunk, tenantId)` filtering by
         listener). This fixes "broken under RLS" — it does NOT fix the explicitly-deferred
         (research.md #6) harder problem of this hub scaling across multiple server processes;
         that still needs Postgres LISTEN/NOTIFY and remains out of scope.

      **Verified, not just asserted**: ran the full `npm test` suite after every batch of
      changes (13 tests passing, 0 leaks by the end); started the real server process multiple
      times and confirmed `/health` and bearer/key-protected routes behave correctly; generated
      a real per-tenant API key for the real "Sell Out Pizza" tenant and confirmed via curl that
      it returns that tenant's real products, and that a garbage key doesn't.

**Checkpoint**: Both P1 stories complete — two tenants can each take a full, isolated order
end-to-end for the data-layer/API surface. The `selloutPizza` storefront UI itself has not
been touched in this pass (no selloutPizza-specific tenant-awareness code was needed per
research.md #9 — it already just sends an API key — but it has not been run against this
server to confirm the whole visual flow). T024 and T028 remain open — see their notes above.

**🔍 QA checkpoint**: run `qa-verifier` against T021–T029 — this is the feature's core isolation
proof. Specifically have it try to construct a cross-tenant leak (e.g. a route from T029's list
that might still be missing the transaction wrapper) rather than only confirming the happy path.

**QA results**: independent adversarial testing against a live running server (not just
`server.inject()`) — cross-tenant product list/by-id fetch, cart-token replay, cart-item
creation referencing another tenant's product, and a payload-injected `tenant_id` on cart
create — **found no cross-tenant leak** in any attempt; all failed closed exactly as claimed.
One real finding, fixed:
- **Fixed (functional bug, not a leak)**: `ProductController.createHandler`'s second
  `update()` call (writing the Stripe product/price ids back onto the newly created product)
  was the one call site in that file T029's sweep missed — confirmed by `git diff` showing
  every *other* call site in the file got `trx` added but not this one. QA reproduced the
  actual failure mode directly against the dev DB: because `create()` now runs inside the
  request's ambient (uncommitted) transaction, this trx-less `update()` fell back to the bare
  `db` singleton — a different connection that can't see the still-uncommitted insert (normal
  READ COMMITTED visibility) — so the update silently matched zero rows. Net effect: every
  product created through the real admin route would have gotten its Stripe product/price
  created in Stripe successfully, but `stripe_product_id`/`stripe_price_id` would silently
  stay `null` on the row forever. This exact bug didn't exist before T029 gave `create()` an
  ambient trx — fixed by adding `trx: request.app.trx` to the missed call; re-verified
  directly (0 rows affected → 1 row affected within the same transaction) and via the full
  `npm test` suite (still 13/13 passing).
- Also cleaned up this QA round's own dev-DB test artifacts (a throwaway tenant, an extra
  API key) plus some leftover tenants from this session's own earlier test-debugging runs
  (before the cleanup-ordering fix noted under T023) — none of this was application code, just
  local dev-database hygiene.

---

## Phase 5: User Story 3 - A new tenant can be onboarded (Priority: P2)

**Goal**: Sell Out Pizza staff can bring a new tenant onto the platform — its own admin account,
products, and storefront — without code changes (FR-007, staff-only per spec Q1).

**Independent Test**: Onboard a brand-new third tenant end-to-end and confirm it reaches a
working storefront and admin login without any deploy or manual database edit.

### Tests for User Story 3

- [x] T030 [P] [US3] `strawberry-server/scripts/_tests/onboardTenant.test.js` — two tests: (1)
      running `onboardTenant()` twice with different inputs produces two tenants with distinct
      auth-user ids and API keys, each `admin_users` row's `tenant_id` matching only its own
      tenant, and each API key bcrypt-validating against only its own tenant's stored hash, not
      the other's; (2) a failed Supabase invite rolls back the `tenants` row rather than leaving
      an orphaned tenant with no admin account. Run with `npm run test:onboarding` — deliberately
      not part of the main `npm test` (which only scans `server/`), and uses a stubbed
      `supabaseAdmin.auth.admin.inviteUserByEmail` rather than a real one, so it needs neither a
      real `SUPABASE_SERVICE_ROLE_KEY` nor sends a real email — the real DB writes (tenants,
      admin_users, tenant_api_keys) are exercised for real against whichever database
      `knexfile.js` points at. 2/2 passing, no leaks, against the real dev Supabase project.

### Implementation for User Story 3

- [x] T031 [US3] Created `strawberry-server/scripts/onboardTenant.js`: given a tenant name,
      IANA timezone, and owner email — creates the `tenants` row, invites the owner via Supabase
      Auth (`auth.admin.inviteUserByEmail`, redirecting to `strawberry-admin`'s existing
      `ResetPasswordPage.vue` to set their own password — no password is ever staff-chosen), the
      matching `admin_users` row (`role: 'owner'`), and one `tenant_api_keys` row (same
      bcrypt-hashed generation as T025's `makeApiKey.js`). Core logic is exported as
      `onboardTenant({ name, timezone, email, supabaseAdmin, adminUrl })` with a thin CLI wrapper
      below it (`npm run onboard-tenant --`), same `import.meta.url` direct-execution guard
      pattern as `server/index.js` — done specifically so T030's test could call the real DB
      logic with a stubbed Supabase client instead of needing a real service-role key. A failed
      invite rolls back the just-created `tenants` row. `SUPABASE_SERVICE_ROLE_KEY` is read from
      the environment only, never `.env` (same reasoning as the prod DB password): it bypasses
      RLS and every Auth check, so it's passed as a one-off env var for a single run.
      Added `@supabase/supabase-js` to `strawberry-server` (already a dependency of
      `strawberry-admin`, same version). Its `tslib` sub-dependency registers global TS helpers
      (`__extends` etc.) that `@hapi/lab`'s leak detector otherwise flags as false-positive leaks
      — added to `test:onboarding`'s `-I` ignore list, same mechanism as the existing `-I logger`.
- [x] T032 [US3] Documented the staff onboarding procedure in `strawberry-server/README.md`
      ("Multi-tenancy" section): the one-line command, what it does (4 steps), and explicitly
      that the printed API key must be handed to the new tenant's own developer to configure
      their own separate storefront deployment's `VITE_API_KEY` — `selloutPizza` in this
      organization's repos is only the platform owner's own storefront, not a template every
      tenant shares at runtime.

**Checkpoint**: All user stories independently functional — a new tenant can be onboarded without
touching code

**🔍 QA checkpoint**: run `qa-verifier` against T030–T032 — confirm the onboarding script's two
runs truly share nothing (not just "no error thrown").

**QA results**: Two real bugs found and fixed.
1. **High severity**: `redirectTo` used `/reset_password` (underscore) — that's the route's
   vue-router *name*, not its actual path (`/reset-password`, hyphen,
   `strawberry-admin/src/router/index.ts`). With no catch-all route, every real invite link
   would 404 and the new owner could never set a password. The existing forgot-password flow
   (`ForgotPasswordPage.vue`) already used the correct hyphenated path — only this new script
   had it wrong. Fixed.
2. **Moderate severity**: only the invite-call failure rolled back the `tenants` row; a later
   failure (`admin_users` or `tenant_api_keys` insert) left an orphaned tenant with no admin
   account and no error pointing at it. QA reproduced this concretely: Supabase's real
   `inviteUserByEmail` returns the *same* auth user id when re-invited while a prior invite is
   still pending, so a staff member re-running the script for an email already mid-invite hits
   a duplicate-key error on `admin_users` — not on the invite call — leaving the second run's
   tenant behind. Fixed by wrapping the whole post-tenant-creation sequence in try/catch with
   full rollback (tenant_api_keys → admin_users → tenants) on any failure, not just the invite
   call. Added a regression test modeling the exact same-user-id scenario QA used.
Also confirmed and didn't need fixing: an invited Auth user with no `admin_users` row is not an
authorization bypass (T010's `AdminUserNotFoundError` → 403 already covers it); API key entropy
matches the already-reviewed `makeApiKey.js`; the test's bcrypt cross-tenant check is genuinely
meaningful, not trivially-passing. Full suite: 3/3 passing, no leaks, against the real dev
Supabase project.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that span multiple user stories

- [x] T033 [P] Per-tenant timezone display (FR-009; amended Constitution Principle V).
      **Backend**: `/admin/me` now returns `timezone` (`AuthService.getTenant()` replaces
      `getTenantName()`, one query for both fields); `GET /services/next` (and its SSE stream,
      which shares the same `buildState()`) now returns a top-level `timezone` field —
      `ServiceState.buildState()` takes an optional `tenantId` and looks up `tenants.timezone`
      explicitly (that table has no tenant_isolation RLS policy to filter it implicitly — same
      reasoning as research.md #3's third addendum).
      **strawberry-admin**: `app.ts` store gained a `timezone` ref, populated by `loadMe()`.
      Rather than editing each of the 9 existing `Format8601`/`DateTimePicker` call sites,
      both components now default their `timezone` prop to the store's value (`UTC` as a last
      resort before the store loads) — every existing usage is correct with no per-page changes.
      **selloutPizza**: `shopTime.ts`'s formatters now take a `timeZone` parameter (default
      `DEFAULT_SHOP_TIME_ZONE`, renamed from the old fixed `SHOP_TIME_ZONE`); the service store's
      `ServiceState`/`apply()` carry the new `timezone` field; `ServiceClosedCard.vue` reads it
      from the store instead of a hardcoded constant.
      Verified: backend's 13/13 tests still pass plus a direct `buildState()` check against the
      real dev database confirming `timezone: 'America/Los_Angeles'` comes back; storefront's
      65/66 tests pass (the one failure, `DefaultLayout.spec.ts`, is a pre-existing `$t`/i18n
      wiring issue in `StoreOpenBadge.vue` unrelated to this task — already uncommitted/modified
      before this session started); `vue-tsc --build` type-checks clean for the two call sites
      this change touched (remaining type errors are pre-existing and unrelated).
- [x] T034 Platform-staff cross-tenant support access (spec Edge Cases;
      contracts/tenant-resolution.md). `AuthService.verifyAdminToken(token, impersonateTenantId)`
      now takes the `X-Tenant-Id` header (wired through from `serverExtensions`' `bearer-jwt`
      scheme/`adminBearer` strategy); for a platform-staff account with no `tenant_id` of its own
      and a header naming a real tenant, it resolves `{ tenant_id: <header>, impersonating: true
      }` and logs it (`global.logger.info('Platform staff impersonation', ...)`), distinct from
      a normal request. An owner account's header is simply ignored, never honored, regardless of
      its value. Enforcement that a route explicitly opts in
      (`options.app.allowPlatformStaffImpersonation`) lives in `onPreHandler`, since
      `AuthService` has no notion of "which route is this" — an impersonating request on a route
      that hasn't opted in gets `403` before any trx opens. **No real route opts in yet** — there
      is no support-UI feature in `strawberry-admin` yet that would send this header, so this is
      the mechanism only, ready for whenever such a feature exists. Tested via injected
      credentials against a throwaway opted-in test route (same technique as T010's tests): the
      opt-in gate, the impersonated tenant context landing in `request.app.tenantId`, and a
      non-impersonating platform-staff request still running with no tenant context. 3 new tests,
      16/16 total passing.
- [x] T035 Suspended tenant handling (spec Edge Cases). Added one check in `serverExtensions`'
      `onPreHandler` — the single point both the admin and storefront resolution paths already
      converge on a resolved `tenantId` — querying `tenants.status` and throwing `403` before any
      transaction opens or impersonation is even considered, if `'suspended'`. Deliberately not
      duplicated into `AuthService.verifyAdminToken`/`apiKeyIsValid` separately. Added
      `suspendTenant()` to `testHelpers.js`; tested both an admin request and a storefront
      request (with an otherwise-valid, non-revoked API key) against a suspended tenant, both
      `403`. 2 new tests, 18/18 total passing.
- [x] T036 Ran every scenario against the real dev Supabase project (not just local Postgres) —
      full results recorded directly in [quickstart.md](quickstart.md) under "T036 run results".
      Highlights: live cross-tenant isolation confirmed over real HTTPS requests with real
      tenants/keys (not just the test suite); found and fixed a real setup gap
      (`selloutPizza/.env`'s API key was stale against the new database); the real Supabase
      invite path was exercised twice for real (one success, one hitting Supabase's own rate
      limit), both confirming T031's rollback fix holds outside the test's stub. Admin-login and
      Stripe-checkout scenarios remain browser-dependent and were not run (same gap as the
      already-disclosed T024). All full suites re-run: strawberry-server 18/18, selloutPizza
      65/66 (one pre-existing, unrelated failure), strawberry-admin 2/2 real tests passing (one
      pre-existing, unrelated stale scaffold file fails to load).
- [x] T037 [P] Updated `strawberry-server/README.md`: added a multi-tenant architecture overview
      right under the title (one shared backend, tenant isolation via RLS, each tenant runs its
      own separate storefront — pointing at the existing "Multi-tenancy" section added by T032),
      and fixed the "Services" section's stale claim that the UI always displays in
      America/Los_Angeles — now says each tenant's own configured timezone.

**🔍 QA checkpoint**: run `qa-verifier` once more against the full diff (all three repos) plus
T036's quickstart results before calling the feature done.

**QA results**: Re-ran all three test suites independently and confirmed the reported counts
exactly (18/18 strawberry-server at the time, 65/66 selloutPizza, 2/2 real strawberry-admin
tests — the two unrelated pre-existing failures each independently re-confirmed as predating
this feature via `git status`). Adversarially reviewed T034's security boundary (owner-account
header bypass, opt-in gate ordering, audit-log skippability) and T033's `buildState` call sites —
all found genuinely fine, detailed in the review. One real, previously-undisclosed gap found:

**T035's suspended-tenant check didn't cover the Stripe webhook completion path.** The check in
`onPreHandler` never runs for `completeCartFromSession()` — that function deliberately has no
ambient auth/trx (it's reached from the webhook route, `auth: false`, authenticated by Stripe's
signature, resolving its own tenant context via `get_cart_tenant_id()`). So a tenant suspended
*after* a customer already reached Stripe's hosted Checkout page would still get the resulting
`checkout.session.completed` webhook processed as a normal completed order. Severity: moderate,
not a security hole or cross-tenant leak — Stripe has already authorized/captured the payment by
this point regardless, so suspension can't un-charge the customer either way; the real effect was
only whether *our own record* of it completes. Fixed by adding the same `tenants.status` check
directly inside `completeCartFromSession()`, using the `tenantId` it already resolves — a
suspended tenant's paid session now logs and returns `{ handled: false }` without closing the
cart, leaving it for manual resolution rather than recording it as a normal completed order.
Added a regression test calling `completeCartFromSession()` directly with a fabricated
(but correctly-shaped) session object against a real cart suspended after creation — confirms
`handled: false` and the cart's `closed_at` stays null. 19/19 tests passing, no leaks.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001–T005) — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational completion; independent of US2/US3
- **User Story 2 (Phase 4)**: Depends on Foundational completion; independent of US1 (shares no
  implementation tasks with it, though both are needed for the full MVP)
- **User Story 3 (Phase 5)**: Depends on Foundational completion, and reuses T025 (per-tenant API
  key generation) from US2 — implement US2 before US3
- **Polish (Phase 6)**: Depends on all three user stories being complete

### Parallel Opportunities

- T002–T005 (Setup) can run in parallel
- T006 (the single consolidated migration) is one file and not parallelizable with anything else
  in Phase 2; T007 and T008 can run in parallel once T006 is applied (different files), T009
  depends on T008
- T010–T012 (US1 tests) can run in parallel; T021–T023 (US2 tests) can run in parallel
- Once Foundational (Phase 2) completes, US1 (Phase 3) and US2 (Phase 4) can be implemented in
  parallel by different people — they touch disjoint files
- T033 and T037 (Polish) can run in parallel with each other

---

## Parallel Example: User Story 1 Tests

```bash
# After Foundational (Phase 2) completes:
Task: "Live request test: GET /api/v1/admin/me returns correct tenant_id/role"
Task: "Live request test: a bearer token for Tenant A cannot read a Tenant B product"
Task: "vitest: LoginPage.vue submits credentials to Supabase and redirects on success"
```

---

## Implementation Strategy

### MVP = User Story 1 + User Story 2 (both P1)

Per spec.md, US1 ("the foundation everything else depends on") and US2 ("the core value of
multi-tenancy") are both Priority P1 — neither alone proves the feature. The MVP is:

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (blocks everything) — QA checkpoint
3. Complete Phase 3 (US1) and Phase 4 (US2) — in parallel if staffed, otherwise US1 then US2 — QA
   checkpoint after each
4. **STOP and VALIDATE**: run quickstart.md scenarios 1–4 and 6
5. Deploy/demo — this is a working two-tenant platform with real per-owner auth

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → store owners have real accounts (testable, but isolation unproven without US2)
3. US2 → isolation proven end-to-end (MVP complete)
4. US3 → onboarding a third tenant needs no code changes
5. Polish → timezones, staff support access, suspension handling, documentation

---

## Notes

- [P] tasks touch different files with no dependency on an incomplete task
- [Story] label maps each task to its user story for traceability
- Commit per repo, per logical group (Constitution: "Commits are small and per repo")
- T006 (schema + RLS, all in one migration) must be applied before T007/T008 can be meaningfully
  tested
- Re-run quickstart.md after any change to the tenant-context wrapper (T007) or auth strategy (T008)
- QA checkpoints (🔍 above) use the `qa-verifier` agent — give it the task IDs just completed, the
  repos touched, and pointers to spec.md/plan.md/data-model.md/contracts/constitution.md; let it
  read the diff and run tests itself rather than summarizing changes to it secondhand

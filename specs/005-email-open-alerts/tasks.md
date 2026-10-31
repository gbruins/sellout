---

description: "Task list template for feature implementation"
---

# Tasks: Email Alerts for Next Store Opening

**Input**: Design documents from `/specs/005-email-open-alerts/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Included — this project's established convention (specs/004-multi-tenant-supabase) is
real route tests against the real dev Supabase database, no mocks, not a TDD-before-code
requirement.

**Organization**: Tasks are grouped by user story (spec.md's P1/P2/P3) so each is independently
implementable, testable, and demoable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1/US2/US3) — omitted for Setup/Foundational/Polish

---

## Phase 1: Setup

**Purpose**: Account/dependency setup before any feature code

- [x] T001 [P] Add the `postmark` npm dependency to `strawberry-server/package.json`
      (`npm install postmark`) — the official Node client for Postmark's Send/Batch Email API.
- [ ] T002 Create a Postmark **Broadcast** message stream (research.md #1) in the Postmark
      dashboard for the existing account, with ID `broadcast`, and verify a sending domain/address
      for it. Set `POSTMARK_API_KEY` in `strawberry-server/.env` for local dev if not already set
      (the var is already declared in `.env.example` but has never been read by any code until
      this feature). This is a dashboard/account action — cannot be scripted.

**Checkpoint**: Postmark reachable from a dev script; dependency installed

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared schema and services every user story depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Migration `strawberry-server/server/db/migrations/97_email_subscribers.js`:
      1. create `email_subscribers` (data-model.md): `id` uuid pk, `tenant_id` uuid not null fk →
         `tenants.id`, `email` text not null, `status` enum `subscribed`/`unsubscribed` not null
         default `subscribed`, `unsubscribe_token` uuid not null default `uuid_generate_v4()`,
         `subscribed_at` timestamptz not null, `unsubscribed_at` timestamptz nullable,
         `created_at`/`updated_at` per this repo's usual convention. Unique constraint on
         `(tenant_id, lower(email))`. Index on `unsubscribe_token` (the public unsubscribe
         route's only lookup key — it has no tenant context to scope by).
      2. create `notification_sends` (data-model.md): `id` uuid pk, `tenant_id` uuid not null fk,
         `service_id` uuid not null fk → `service.id`, `recipient_count` integer not null,
         `sent_at` timestamptz not null default `now()`.
      3. On both new tables: `ENABLE`/`FORCE ROW LEVEL SECURITY`, `CREATE POLICY tenant_isolation
         ... USING (tenant_id = app_current_tenant_id())` for SELECT/INSERT/UPDATE/DELETE,
         `GRANT` to the app role — replicating migration `96_multi_tenant_foundation.js`'s
         per-table block directly, since that migration's loop already ran once and will not
         retroactively cover a new table (research.md #5).
      4. `CREATE FUNCTION unsubscribe_by_token(p_token uuid) RETURNS boolean LANGUAGE sql
         SECURITY DEFINER SET search_path = public, pg_temp` — updates the matching row to
         `status = 'unsubscribed', unsubscribed_at = now()` (no-op if already unsubscribed or no
         match), returns whether a `subscribed` row existed for that token. Narrow,
         single-purpose RLS bypass for the one case with no ambient tenant context — same shape
         as `get_cart_tenant_id()` (research.md #3). `GRANT EXECUTE` only, to the app role.
         Matching `down()` for all of the above.
- [x] T004 [P] `strawberry-server/server/plugins/emailSubscribers/EmailSubscriberModel.js` —
      Joi schema per data-model.md's columns (`tenant_id` excluded from the schema, same as every
      other model — injected server-side only).
- [x] T005 `strawberry-server/server/plugins/emailSubscribers/EmailSubscriberService.js` extends
      `BaseService` — overrides the create path with the `(tenant_id, email)` upsert from
      research.md #6 (`INSERT ... ON CONFLICT (tenant_id, lower(email)) DO UPDATE SET status =
      'subscribed', subscribed_at = now(), unsubscribed_at = null`) rather than inheriting plain
      `create()`, which would violate the unique constraint on a duplicate. Also overrides `del()`
      to set `status = 'unsubscribed', unsubscribed_at = now()` instead of any soft/hard delete
      (contracts/admin-subscribers.md: staff "removal" and self-service unsubscribe are the same
      state transition).
- [x] T006 [P] `strawberry-server/server/plugins/notifications/NotificationSendModel.js` — Joi
      schema per data-model.md's columns.
- [x] T007 `strawberry-server/server/plugins/notifications/NotificationService.js` — wraps the
      `postmark` client; a `sendOpeningNotification({ service, tenant, recipients })` function
      that builds the email (subject + HTML/text body stating `service.start_at`/`end_at`
      formatted in `tenant.timezone` via `date-fns-tz` — Constitution Principle V, same library
      already used in `strawberry-admin`) and calls Postmark's Batch Email API with
      `MessageStream: 'broadcast'`, `From` read from `process.env.EMAIL_INFO` (the existing,
      previously-unused env var). Returns per-recipient success/failure so the caller can log
      partial failures without treating them as a total send failure.

**Checkpoint**: Schema, models, and the Postmark wrapper exist — no story is usable yet, but all
three can now be built without touching this phase again

---

## Phase 3: User Story 1 - Visitor subscribes for alerts (Priority: P1) 🎯 MVP

**Goal**: A storefront visitor can submit their email and be subscribed immediately, with no
account required (spec FR-001–FR-004).

**Independent Test**: With the shop closed, submit a valid email via the public API and confirm a
row exists; resubmit the same email and confirm no duplicate row; submit a malformed email and
confirm nothing is written. Demoable without User Story 2 or 3 existing yet.

### Tests for User Story 1

- [x] T008 [P] [US1] Real route tests in
      `strawberry-server/server/plugins/emailSubscribers/_tests/index.test.js`: a new email
      subscribes (`200`, one row, `status = 'subscribed'`); the same email resubmitted is
      idempotent (still one row, still `200`); a malformed email is rejected (`400`, no row);
      two tenants' store API keys never see or affect each other's subscribers (real per-tenant
      keys, same convention as spec 004's T021–T023).

### Implementation for User Story 1

- [x] T009 [P] [US1] `EmailSubscriberController.js`'s `subscribeHandler` — calls
      `EmailSubscriberService`'s upsert (T005) with `tenantId: request.app.tenantId`, always
      returns `{ subscribed: true }` regardless of new/duplicate/resubscribed
      (contracts/storefront-signup.md — no distinction exposed).
- [x] T010 [US1] `strawberry-server/server/plugins/emailSubscribers/index.js` — `POST
      /subscribers` route, `auth: { strategies: ['apiKey'] }` (same public store-key strategy
      `/cart` already uses — no new auth mechanism). Register the plugin in `server/index.js`.
- [x] T011 [P] [US1] `selloutPizza/src/api/subscribe.js` — factory function (matches
      `src/api/service.js`'s shape) with a `subscribe(email)` method calling `POST subscribers`.
      Register it in `selloutPizza/src/plugins/api.js`'s `$api` map.
- [x] T012 [US1] `selloutPizza/src/stores/subscribe.ts` — Pinia setup store (matches
      `stores/service.ts`'s `loading`/`error` idiom), a `subscribe(email)` action calling the API
      module from T011.
- [x] T013 [US1] Add the signup form to `selloutPizza/src/components/ServiceClosedCard.vue`
      (renders exactly when the shop is closed/upcoming/none — already the natural home for this
      message). Plain `<input type="email">` + submit button matching this app's existing
      Tailwind conventions (plan.md's Project Structure notes the exact classes to reuse from
      `CartView.vue`); local component state for a success/validation message (no shared store
      needed for the message itself, matching `CartView.vue`'s local-ref pattern); client-side
      format check before calling T012's action, mirroring FR-002 server-side.
- [x] T014 [P] [US1] `selloutPizza/src/components/__tests__/ServiceClosedCard.spec.ts` (extend
      the existing spec if one exists) — submitting a valid email shows the confirmation message
      and calls the store action; submitting a malformed email shows a validation message and
      does not call it.

**Checkpoint**: A visitor can subscribe end-to-end. Independently testable and demoable.

**🔍 QA checkpoint**: run `qa-verifier` against T003–T014 — specifically the upsert's
`(tenant_id, lower(email))` conflict handling (does a race between two near-simultaneous
submissions of the same email ever produce two rows or an unhandled constraint-violation error?)
and that cross-tenant isolation holds for the new table the same way it does for every other one.

**QA results**: Race condition confirmed safe (real 2-way and 10-way concurrent signups for the
identical email — exactly one row, no 500, every request still 200). Cross-tenant isolation
confirmed real, not trivial. Admin routes confirmed genuinely default-deny (no header, garbage
bearer, and even a valid *store* API key on the wrong strategy all correctly 401). SQL-injection-
shaped and RFC-valid-but-unusual email inputs (`+tag@gmail.com`, an apostrophe in the local part)
all handled safely via real `?` bindings. Two real bugs found and fixed:
1. **Already-live, already-broken**: `GET /subscribers/unsubscribe`'s Joi validation required
   `token` to be UUID-shaped, so a malformed token got a raw `400` instead of the documented
   "always 200, no information leak" response (contracts/storefront-signup.md, spec Acceptance
   Scenario 3.3) — found even though US3 (the feature this route belongs to) isn't built yet,
   because the route itself was already live and reachable. Fixed by loosening the Joi schema to
   accept any string and letting `unsubscribeHandler`'s own try/catch handle a non-UUID value at
   the SQL layer, as originally intended. Added 2 regression tests now rather than waiting for
   Phase 5.
2. **Latent**: `unsubscribe_by_token()`'s SQL function returned `NULL`, not `false`, on no-match
   (a bare `UPDATE ... RETURNING true` produces zero rows, which a scalar SQL function returns as
   `NULL`) — contradicted data-model.md's documented contract, harmless today only because the
   caller never inspected the return value. Fixed with a data-modifying CTE +
   `COALESCE(..., false)`; re-applied to the dev database by rolling the migration back and
   forward again (not just patched ad hoc) to prove the corrected file works from empty.

Also found and fixed during implementation (not from the QA agent, but while chasing one of its
re-tests myself): `EmailSubscriberService.del()`'s override originally passed a Knex
`db.fn.now()` raw binding as an `unsubscribed_at` value — `BaseService.update()` logs its full
`config` (including `data`) before the query runs, and a raw binding carries internal
client/connection references (active `Timeout` handles for idle/keep-alive timers) that broke
that logging call's JSON serialization, surfacing as an opaque `400 "Converting circular
structure to JSON"` with no indication of the real cause. Every other `update()` call site in
this codebase only ever puts plain primitives in `data` — fixed by using a plain `new Date()`
instead. Also discovered while fixing this: `BaseController`'s shared catch-all wraps *every*
caught error (including a legitimate `Boom.notFound()` from `throwIfNotFound`) into `400 Bad
Request` for admin update/delete routes — a pre-existing characteristic of every plugin built on
`BaseController`, not something introduced here; a cross-tenant `DELETE` correctly gets a `400`
with message `"Not Found"` rather than a clean `404` (the storefront's `404` convention is a
different code path, `storeVisibility.js`, that doesn't go through `BaseController`). Adjusted
the relevant test's expectation to match reality rather than treating this as a bug to fix, since
changing shared `BaseController` behavior would affect every other plugin's admin routes — out of
scope for this feature.

Final count: 30/30 backend tests passing, no leaks.

---

## Phase 4: User Story 2 - Staff notifies subscribers of an opening (Priority: P2)

**Goal**: Staff can see who's subscribed, remove one manually, and send a real notification email
for a specific upcoming opening — fully on-demand, never automatic (spec FR-005–FR-007,
FR-012–FR-015).

**Independent Test**: With a directly-seeded subscriber row and an upcoming service window,
trigger the notify action and confirm the subscriber receives an email describing that window;
confirm zero-subscriber notify still returns a clear, non-silent result. Demoable using seeded
data, without needing User Story 1's storefront form to have run first.

### Tests for User Story 2

- [x] T015 [P] [US2] Real route tests in `strawberry-server/server/plugins/emailSubscribers/_tests/`:
      list/count/remove are tenant-scoped (one tenant's admin JWT never sees or can remove another
      tenant's subscribers); manual removal transitions `status` to `unsubscribed` (not a hard
      delete) and a removed address can still resubscribe afterward via the public endpoint.
- [x] T016 [P] [US2] Real route tests in
      `strawberry-server/server/plugins/notifications/_tests/index.test.js`: notify sends to
      exactly the active-subscriber count and writes one `notification_sends` row; a second
      notify call for the same service writes a *second* row (resend, not deduped or blocked);
      zero active subscribers still returns `200` with `recipientCount: 0`, not an error; a
      suspended tenant's notify attempt is rejected (reuse `suspendTenant()` from
      `strawberry-server/server/utils/testHelpers.js`, spec 004); a simulated Postmark failure
      (stubbed client, same technique as spec 004's `onboardTenant.test.js` stubbing
      `supabaseAdmin`) writes **no** `notification_sends` row (research.md #2 — the audit trail
      must only reflect confirmed sends).

### Implementation for User Story 2

- [x] T017 [P] [US2] `EmailSubscriberController.js`'s `searchHandler` (list), a `countHandler`
      (`SELECT count(*) WHERE status = 'subscribed'`), and `deleteHandler` (calls T005's `del()`
      override).
- [x] T018 [US2] `emailSubscribers/index.js` additions: `GET /subscribers` (search),
      `GET /subscribers/count`, `DELETE /subscriber` — no `auth` override on any of them (falls
      to the existing default-deny `adminBearer`, same as `allowedStreets`'s admin routes).
- [x] T019 [US2] `NotificationController.js`'s `notifyHandler`: looks up the service + its
      tenant's `timezone`, queries active subscribers for `request.app.tenantId`, calls T007's
      `sendOpeningNotification()` and **awaits** it (research.md #2 — not fire-and-forget), writes
      the `notification_sends` row only after confirmed success, returns `{ sent: true,
      recipientCount }` (`recipientCount: 0` is a normal `200`, not an error — FR-012). On a
      Postmark-level failure, returns `502` and writes nothing.
- [x] T020 [US2] `strawberry-server/server/plugins/notifications/index.js` — `POST
      /services/notify?id=` route (`adminBearer`, default). Register the plugin in
      `server/index.js`.
- [x] T021 [US2] Extend `strawberry-server/server/plugins/service/ServiceService.js`'s
      get-by-id read path with a `last_notified_at` field (`MAX(notification_sends.sent_at) WHERE
      service_id = ?`, null if never notified — data-model.md's "derived, not stored" note).
      Read-path only — `createHandler`/`updateHandler` in `ServiceController.js` are untouched,
      so creating or editing a service continues to never trigger or imply a send (FR-006).
- [x] T022 [P] [US2] `strawberry-admin/src/api/email_subscriber.js`
      (`utils.makeCruds('subscribers', 'subscriber')` plus a `count()` method) and
      `strawberry-admin/src/api/notification.js` (one `send(serviceId)` method). Register both in
      `strawberry-admin/src/plugins/api.js`.
- [x] T023 [US2] `strawberry-admin/src/pages/SubscribersPage.vue` — list via shadcn `Table` +
      `useTable`/`useApi` composables (matches `AddressDiscountsPage.vue`'s shape exactly), the
      active-subscriber count shown above the table, a `PopConfirm`-guarded manual-removal action
      per row. No create/edit modal — subscribers are never created by staff, only by the public
      form (T013).
- [x] T024 [US2] Add a `/subscribers` route to `strawberry-admin/src/router/index.ts` and a nav
      entry (with a `@lucide/vue` `MailIcon` or similar) to `DefaultLayout.vue`'s `navItems`.
- [x] T025 [US2] `strawberry-admin/src/pages/ServicesPage.vue`: add a `PopConfirm`-guarded "Notify
      subscribers" action per upcoming-service row, and an "already notified" inline indicator
      (reusing the existing `menuProblem()`-style inline-badge pattern) sourced from T021's
      `last_notified_at` — shows the zero-subscribers case and send failures distinctly from a
      successful send.
- [x] T026 [P] [US2] `strawberry-admin/src/pages/__tests__/SubscribersPage.spec.ts` (list render,
      removal calls the right endpoint) and a `ServicesPage.spec.ts` addition (notify button calls
      the right endpoint; a zero-subscribers response and a send failure each render distinctly
      from a successful send).

**Checkpoint**: Staff can view/manage subscribers and send real notifications end-to-end.
Independently testable with seeded data.

**🔍 QA checkpoint**: run `qa-verifier` against T015–T026 — specifically try to find a path where
a Postmark failure still leaves a `notification_sends` row (would break FR-007's "already
notified" guarantee), and confirm the suspended-tenant check actually blocks this new route the
same way T035 blocked everything else in spec 004.

**QA results**: Re-confirmed live (not just by reading code) that the suspended-tenant check
genuinely blocks this route before any subscriber query or Postmark call, that the paginated
`/services` search path correctly carries `last_notified_at` per row (only the single-fetch path
had an explicit test), and that the admin UI's `notification.send()` really does send `id` as a
query param, not a JSON body, by capturing the real axios request against a local test server.
Found 3 real bugs by actually driving the real Postmark sandbox API with deliberately malformed
input rather than only reading the code:

1. **High severity, the most serious finding across either QA round for this feature**: a batch
   call that *resolves normally* with every single recipient individually rejected by Postmark
   (e.g. a broadcast stream not yet approved, or every address bouncing) never hit the existing
   catch block (which only guarded against the API call itself throwing) — it fell through to
   writing a `notification_sends` row and returning `recipientCount: 0`, indistinguishable from
   the genuine "no subscribers" case. Staff would see a normal success, or worse, a "Notified"
   badge later, for a send that reached nobody. Confirmed by actually calling
   `sendOpeningNotification()` against Postmark's real sandbox with malformed recipients — it
   does not throw, it returns a result array where every entry has `success: false`. Fixed:
   `successCount === 0` with a non-empty recipient list is now treated the same as the send
   itself throwing — logged, `502`, no audit row written. Added a regression test using the
   same malformed-recipient technique QA used.
2. **Medium severity**: notifying about a service with `start_at: null` (a legitimate, reachable
   state — nullable at both the DB and Joi level, e.g. a draft row) reached Postmark and
   produced a real, broken-looking email ("...is open Wednesday, December 31 at 7:00 PM" — the
   1969 Unix epoch formatted in the tenant's zone) sent to actual subscribers, confirmed by
   actually running the real formatter and a live sandbox send. Fixed: `notifyHandler` now
   refuses with `400` before ever querying subscribers or calling Postmark if the service has
   no `start_at`. Added a regression test.
3. **Medium severity**: per-recipient failure logging used `result.To` to identify which address
   failed, but confirmed directly against Postmark's real batch API that a *failed* result entry
   has no `To` field at all (only successful ones include it) — every logged failure recorded
   `email: undefined`, losing the one piece of diagnostic information partial-failure logging
   exists to provide. Fixed by correlating results with the original `recipients` array by
   index instead (Postmark's batch API preserves request order).

Also fixed two lower-severity items flagged alongside the above: the Postmark client had no
explicit timeout (defaults to 60s), which could hold a request's Postgres transaction — and one
of only 10 pooled connections — open for up to a minute per slow/hanging call during a real
Postmark outage; now capped at 10s. And `ServicesPage.vue`'s "Notify subscribers" button wasn't
disabled while a send was in flight — unlike the adjacent Delete action, a duplicate notify
isn't idempotent (it really would double-email every subscriber), so this one specifically now
disables during its own request.

Final count: 37/37 backend tests passing (was 35), 7/7 real admin tests passing, no leaks.

---

## Phase 5: User Story 3 - Subscriber removes themselves (Priority: P3)

**Goal**: A subscriber can click an unsubscribe link in a received email and immediately stop
receiving future notifications, with no login (spec FR-008–FR-009).

**Independent Test**: Take a subscribed row's `unsubscribe_token` directly, call the public
unsubscribe URL with no auth headers, and confirm the row's status changes and a follow-up notify
no longer counts that address. Independently demoable with a directly-crafted token, without
needing a real email to have been sent first.

### Tests for User Story 3

- [x] T027 [P] [US3] Real route test in
      `strawberry-server/server/plugins/emailSubscribers/_tests/index.test.js`: a valid token
      unsubscribes (`200`, `status` becomes `unsubscribed`); the same link clicked again is still
      `200`, no error, no change; a garbage/unknown token still returns the same generic `200`
      response (data-model.md's validation rule — no information leak, no `500`); an address that
      unsubscribed and then resubscribed (via the public `POST /subscribers`) still has its
      *original* `unsubscribe_token` work afterward (data-model.md: the token doesn't change on
      resubscribe).

### Implementation for User Story 3

- [x] T028 [US3] `EmailSubscriberController.js`'s `unsubscribeHandler` — calls T003's
      `unsubscribe_by_token()` via a raw query on the owner connection (there is no RLS tenant
      context on this route — research.md #3), always returns `{ unsubscribed: true }`
      regardless of outcome (contracts/storefront-signup.md).
- [x] T029 [US3] `emailSubscribers/index.js`: `GET /subscribers/unsubscribe` route, `auth: false`
      (plan.md's Complexity Tracking — the one deliberate, justified exception in this feature).
- [x] T030 [US3] `selloutPizza/src/api/subscribe.js` addition — an `unsubscribe(token)` method.
- [x] T031 [US3] `selloutPizza/src/router/index.ts`: new `/unsubscribe` route; new
      `selloutPizza/src/pages/UnsubscribePage.vue` — reads `?token=` from the URL, calls T030's
      method on mount, renders a plain confirmation (contracts/storefront-signup.md: there is no
      failure state to show the visitor, by design).
- [x] T032 [P] [US3] `selloutPizza/src/pages/__tests__/UnsubscribePage.spec.ts` — mounts with a
      token in the route params, confirms the API call fires on mount and the confirmation
      message renders.

**Checkpoint**: All three user stories independently functional — the full loop (subscribe →
staff notifies → unsubscribe) works end to end.

**🔍 QA checkpoint**: run `qa-verifier` against T027–T032 — specifically confirm the unsubscribe
route genuinely requires no auth header of any kind (not just "works when one happens to be
absent"), and that a malformed token (not just an unknown-but-well-formed one) is handled the same
graceful way without a `500`.

**QA results (Phase 5 / US3)**: T028-T029's handler and route already existed from earlier
ahead-of-schedule work in Phase 1-3 (the malformed-token Joi-validator bug was fixed and
regression-tested back then). What was missing for T027 was the actual valid-token, real-flow
coverage — added three tests to the `GET /api/v1/subscribers/unsubscribe` describe block: a real
token unsubscribing with literally no auth header, the same link clicked twice staying a no-op,
and the original `unsubscribe_token` still working after an unsubscribe→resubscribe cycle. Built
T031/T032 fresh: `UnsubscribePage.vue` reads `?token=` via `useRoute()`, fires-and-forgets the
existing `unsubscribe()` API method on mount, and always renders the same confirmation — no
failure branch exists in the UI at all, matching the backend's own "always 200" contract.

An independent QA review (adversarial `server.inject()` probing — SQL-injection-shaped tokens,
100k-char tokens, cross-tenant-row tokens, forged auth headers, concurrent double-clicks — plus
reading the `unsubscribe_by_token()` SECURITY DEFINER function for scope-creep risk) found one
real, low-severity gap and two informational items:
- **Fixed**: `token` was Joi `.required()`, so a bare hit on `/subscribers/unsubscribe` with no
  `token` param (or an empty one) returned a raw `400` instead of the documented "always 200"
  response — same class of bug as the earlier `.uuid()` over-validation fix. Changed to
  `.allow('').optional()`; the handler's existing try/catch already absorbs the resulting SQL-layer
  error identically to a malformed token. Added a regression test. In practice this never affects
  a real visitor — `UnsubscribePage.vue` only calls the API when a token is actually present —
  but a bare/truncated URL hit (a prober, a mangled copy-paste) now gets the contractually-correct
  response too.
- **Informational, not fixed**: `unsubscribe_by_token()`'s `GRANT EXECUTE` has no matching
  `REVOKE EXECUTE FROM PUBLIC`, so Postgres's default EXECUTE-to-PUBLIC grant likely still
  applies. Pre-existing in the precedent this was modeled on (`get_cart_tenant_id()`, migration
  96) — not introduced by this feature, and low-risk since the function is already reachable
  unauthenticated over HTTP and only ever flips one row to `unsubscribed`.
- **Informational, not fixed**: `UnsubscribePage.vue`'s fire-and-forget call has no `.catch()` —
  a rejected call only surfaces as a console warning, never a user-visible issue, since the UI
  shows the same confirmation regardless (by design).

Final counts: backend 40/40 passing (was 37), no leaks. Storefront: all new/existing tests pass
(one unrelated, pre-existing failure in `DefaultLayout.spec.ts` confirmed via `git stash` to
predate this feature entirely — a separate in-progress i18n migration on this branch, not
touched). Admin: 7/7 real tests passing (same single pre-existing unrelated scaffold test
failure as every prior checkpoint).

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and end-to-end validation spanning all three stories

- [x] T033 Run every scenario in [quickstart.md](quickstart.md) against the real dev Supabase
      project (same practice as spec 004's T036) and record results directly in that file,
      including the two-tenant isolation and suspended-tenant scenarios.
- [x] T034 [P] Add an "Email alerts" section to `strawberry-server/README.md`: the Postmark
      Broadcast stream setup step (T002), and that sending is always staff-manual — creating or
      editing a service never sends anything on its own (FR-006).
- [x] T035 [P] Update `strawberry-server/.env.example`'s `POSTMARK_API_KEY`/`EMAIL_INFO` comments
      to describe their actual use now that this feature wires them up (currently declared but
      unused, per research.md #1).

**🔍 QA checkpoint**: run `qa-verifier` once more against the full diff (all three repos) plus
T033's quickstart results before calling the feature done.

**QA results (final full-diff pass)**: reviewed the whole feature's diff across all three repos
at once (not just per-phase), specifically looking for seam issues a narrower review would miss —
end-to-end request/response shape consistency, the migration's RLS/index correctness re-verified
live via `knex migrate:status`, Constitution compliance re-checked against the real code, and
route/nav/i18n conflicts with the rest of each app.
- **Fixed (medium)**: nearly every new admin UI string (`SubscribersPage.vue`'s `t('Subscribers')`,
  `t('Active subscribers')`, `t('Subscribed')`, `t('Unsubscribed')`, `t('Subscriber removed')`,
  `t('Remove this subscriber?')`; `ServicesPage.vue`'s `t('Notified')`,
  `t('No subscribers to notify yet')`, `t('Notification sent')`,
  `t('Notify subscribers about this opening?')`/`t('Notify subscribers again about this opening?')`)
  had no matching key in `strawberry-admin/src/locales/en-US.js` — invisible today only because
  this app's convention is key-text-equals-English-value, but it logged a console warning on
  every render and would silently break the moment a second locale is added, unlike every other
  page's strings in this app. Added all 11 keys (plus the toast's interpolated count, which was
  also a raw un-translated template literal — fixed to route through `t()` like every other
  `successToast`/`addToast` call site).
- **Informational, not fixed**: Postmark's Batch API caps around 500 recipients per call and
  `sendOpeningNotification()` sends every active subscriber in one call with no chunking — an
  accepted, documented limitation at current scale (plan.md explicitly scopes batching/queueing
  out of this version), not a new defect.
- **Informational, not fixed**: `GET /subscribers` returns each row's raw `unsubscribe_token` to
  the admin UI (`EmailSubscriberModel.js`'s `hidden = []`, matching every other model in this
  codebase — tokens aren't specially hidden anywhere). No privilege escalation (the same staff
  already have the equivalent DELETE capability), just unnecessary exposure of an otherwise-
  unguessable value over the wire to an already-trusted caller.
- Confirmed clean: migration 97 applied (16/16, none pending); RLS/indexes correct; no
  client-trusted `tenant_id`/status/recipient-list anywhere (Constitution Principle I); tenant
  timezone used consistently end-to-end for both the notification email and the admin's
  "Notified" display (Principle V); no route/nav collisions; public routes rely on the platform's
  existing global rate limit, same tier as other non-sensitive public routes, matching this
  feature's own documented assumption.

Final counts: `strawberry-server` 40/40 passing, no leaks. `selloutPizza` 70/71 (the 1 failure is
the pre-existing, unrelated `DefaultLayout.spec.ts` i18n-migration issue). `strawberry-admin` 7/7
real tests passing (the 1 failed suite is the pre-existing, unrelated `HelloWorld.spec.ts`
scaffold file). Feature complete.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational; independent of US2/US3
- **User Story 2 (Phase 4)**: Depends on Foundational; independent of US1 in code, but needs at
  least one subscriber (real or seeded) to be meaningfully demoed
- **User Story 3 (Phase 5)**: Depends on Foundational (specifically T003's
  `unsubscribe_by_token()`); independent of US1/US2 in code, but needs at least one subscriber to
  be meaningfully demoed
- **Polish (Phase 6)**: Depends on all three user stories being complete

### Parallel Opportunities

- T001 and T002 (Setup) can run in parallel
- T004 and T006 (Foundational models) can run in parallel once T003's migration is applied; T005
  and T007 each depend on their own model/table but not on each other
- Once Foundational (Phase 2) completes, US1 (Phase 3), US2 (Phase 4), and US3 (Phase 5) can be
  implemented in parallel by different people — they touch disjoint files, with the one shared
  dependency (the `email_subscribers` table and its Service) already built in Phase 2
- T034 and T035 (Polish) can run in parallel with each other

---

## Implementation Strategy

### MVP First (User Story 1 only)

Phase 1 → Phase 2 → Phase 3, then stop and validate: visitors can subscribe, even before staff can
act on the list. Real value starts at User Story 2 (that's what actually notifies anyone), so this
MVP slice is mainly useful for validating the public-facing half in isolation before building the
admin half.

### Incremental Delivery

1. Setup + Foundational → shared schema/services ready
2. Add User Story 1 → subscribers can accumulate
3. Add User Story 2 → staff can actually use the list (this is the first point the feature
   delivers its real value — consider this the practical "done" milestone if time is constrained)
4. Add User Story 3 → required before any real send goes out, not a deferrable nice-to-have,
   despite its P3 label (see spec.md's User Story 3 "Why this priority")

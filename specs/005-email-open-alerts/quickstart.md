# Quickstart: Validating Email Alerts for Next Store Opening

Prerequisites, setup, and runnable scenarios proving the feature works end to end. References
[data-model.md](data-model.md) and [contracts/](contracts/) rather than repeating them.

## Prerequisites

- The dev Supabase project from `specs/004-multi-tenant-supabase` (migrations run, a real tenant
  with a store API key — `npm run onboard-tenant` / `npm run make-api-key`).
- A Postmark account with a **Broadcast** message stream created (research.md #1) and its server
  token in `strawberry-server/.env` as `POSTMARK_API_KEY`.
- At least one upcoming `service` row for the test tenant (admin-created, future `start_at`).

## Setup

```bash
# strawberry-server
npm run knex:migrate   # applies 97_email_subscribers.js
```

## Validation scenarios

1. **Visitor subscribes** (spec User Story 1) — with the test tenant's shop closed, call
   `POST /api/v1/subscribers` with the store API key and a valid email. Confirm `200` and a new
   `email_subscribers` row with `status = 'subscribed'`. Repeat with the exact same email; confirm
   still exactly one row (not two), same `200` response (FR-003).
2. **Invalid email rejected** — call the same endpoint with a malformed address; confirm `400` and
   no row written (FR-002).
3. **Staff notifies subscribers** (spec User Story 2) — with at least one subscribed address and
   the upcoming service window from Prerequisites, call
   `POST /api/v1/services/notify?id=<service-id>` as admin. Confirm `200` with
   `recipientCount >= 1`, a new `notification_sends` row, and that the subscribed address actually
   receives an email (check Postmark's own activity log) stating that service window's date/time
   in the tenant's configured zone (FR-005, Constitution Principle V).
4. **Zero subscribers is not silent** — against a tenant/service with no active subscribers, call
   the same notify endpoint; confirm `200` with `recipientCount: 0` and no misleading "it worked"
   framing beyond that accurate count (FR-012).
5. **Resend is visible and allowed** — call notify again for the same service window; confirm a
   *second* `notification_sends` row is created (not blocked, not deduped) and
   `GET /api/v1/service?id=<service-id>` now shows `last_notified_at` reflecting the latest send
   (FR-007).
6. **Unsubscribe is one-click and idempotent** (spec User Story 3) — take a subscribed row's
   `unsubscribe_token`, call `GET /api/v1/subscribers/unsubscribe?token=<token>` with no auth
   headers at all; confirm `200`, the row's `status` becomes `unsubscribed`, and a follow-up
   notify call to the same service no longer counts that address in `recipientCount`. Call the
   same unsubscribe URL again; confirm still `200`, no error (FR-009, Acceptance Scenario 3.2).
7. **Resubscribe after unsubscribing** — call `POST /api/v1/subscribers` again with the
   now-unsubscribed address; confirm `status` returns to `subscribed` and the *same*
   `unsubscribe_token` still works afterward (FR-004, data-model.md's state machine).
8. **Cross-tenant isolation** — with two test tenants (same technique as spec 004's quickstart:
   `onboard-tenant` plus a directly-created second tenant), confirm Tenant A's notify call never
   emails Tenant B's subscribers, and Tenant A's admin JWT can't list or remove Tenant B's
   subscribers via `GET`/`DELETE /api/v1/subscriber*` (SC-004).
9. **Suspended tenant blocks notify** — suspend the test tenant (`tenants.status = 'suspended'`,
   same mechanism as spec 004's T035) and confirm the notify endpoint is rejected the same way
   every other action already is for a suspended tenant (spec Edge Cases).
10. **No regressions** — run the existing suites and confirm all still pass:
    ```bash
    # strawberry-server
    npm test
    # strawberry-admin / selloutPizza
    npx vitest run
    ```
    (Constitution Principle VI)

## T033 run results (2026-10-30, against the real dev Supabase project)

Ran scenarios 1-9 live via a throwaway script hitting the real server (`server.inject()`) and the
real dev database directly (not just the automated suite) — two real tenants created with
`createTestTenant`/real API keys, cleaned up afterward. The real account's Postmark **Broadcast**
stream (T002) still isn't created, so the sandbox `POSTMARK_API_TEST` token was forced for sends
(same substitution the automated notification tests already use) — the first run attempt,
without forcing it, correctly surfaced a real `502` from the real (but broadcast-stream-less)
account, confirming the notify path genuinely talks to Postmark rather than faking success.

1. **Visitor subscribes** — ✅ `200` + one row; exact-same-email repeat still `200`, still one row.
2. **Invalid email rejected** — ✅ `400`, no row written.
3. **Staff notifies subscribers** — ✅ `200`, `recipientCount: 1`, one `notification_sends` row.
   (Actual email content/delivery can't be checked in Postmark's activity log yet since T002 — the
   real Broadcast stream — is still pending; the sandbox token exercises the real send code path
   but Postmark never actually delivers it. Re-verify scenario 3's content/delivery once T002 is
   done.)
4. **Zero subscribers is not silent** — ✅ `200`, `recipientCount: 0`.
5. **Resend is visible and allowed** — ✅ second `notification_sends` row created, `last_notified_at`
   on `GET /service` reflects the later send.
6. **Unsubscribe is one-click and idempotent** — ✅ real token, no auth headers at all → `200`,
   status flips to `unsubscribed`, excluded from the next notify's `recipientCount`; same link
   clicked again → still `200`, no error, no state change.
7. **Resubscribe after unsubscribing** — ✅ status returns to `subscribed`, same original
   `unsubscribe_token` still works afterward.
8. **Cross-tenant isolation** — ✅ Tenant A's admin list never shows Tenant B's subscriber;
   Tenant A's admin `DELETE` against Tenant B's subscriber id fails (`400` — RLS makes the row
   invisible, same documented `BaseController` rewrap behavior as every other admin
   update/delete route in this codebase, not a new finding); the row is untouched.
9. **Suspended tenant blocks notify** — ✅ `403`, same as every other action for a suspended
   tenant.
10. **No regressions** — `strawberry-server`: 40/40 passing, no leaks. `selloutPizza`: all
    relevant tests pass (one pre-existing, unrelated failure in `DefaultLayout.spec.ts` — an
    in-progress i18n migration on this branch, confirmed via `git stash` to predate this
    feature). `strawberry-admin`: 7/7 real tests passing (one pre-existing, unrelated scaffold
    test file, `HelloWorld.spec.ts`, fails to load — same as every prior checkpoint this project
    has run).

One own-script cleanup mistake worth recording so it isn't repeated: the verification script's
teardown deleted `service` rows before `notification_sends` rows, violating
`notification_sends_service_id_foreign` and crashing before the rest of cleanup ran (leaving two
test tenants behind on the first pass). Not a product bug — the FK is correct and existing test
suites already clean up in the right order (`notification_sends` before `service`). Fixed the
script's order and manually swept the two leftover tenants; confirmed the dev database contains
no `T033 quickstart%` tenants afterward.

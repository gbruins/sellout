# Implementation Plan: Email Alerts for Next Store Opening

**Branch**: `005-email-open-alerts` | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-email-open-alerts/spec.md`

## Summary

Visitors can subscribe their email on the `selloutPizza` home page (single opt-in, no confirmation
email) to be told when the shop is next open. Staff, from `strawberry-admin`, manually trigger a
notification for a specific upcoming service window — nothing sends automatically on service
create/edit. Sending goes through Postmark's **Broadcast** message stream (not the transactional
stream `strawberry-server` doesn't currently use for anything), since this is a one-to-many send to
an opt-in list. Every email carries a one-click, unauthenticated unsubscribe link. Subscribers and
sends are tenant-scoped with Postgres RLS, the same model `specs/004-multi-tenant-supabase`
established for everything else.

## Technical Context

**Language/Version**: Node.js (ESM) for `strawberry-server`; Vue 3 (JS in `selloutPizza`, TS in
`strawberry-admin`) for both frontends — no new language, matches the existing stack.

**Primary Dependencies**: `postmark` (official Node client — new dependency for
`strawberry-server`; `EMAIL_ADMIN`/`EMAIL_INFO`/`POSTMARK_API_KEY` env vars already exist but are
unwired). Everything else reuses the existing stack: Hapi/Knex/`@supabase/supabase-js` (server),
Pinia/axios (both frontends), shadcn table primitives (`strawberry-admin`).

**Storage**: PostgreSQL via Supabase (existing). Two new tables: `email_subscribers`,
`notification_sends` — see [data-model.md](data-model.md).

**Testing**: `@hapi/lab` + `@hapi/code` (server, real dev Supabase DB, no mocks — matches
`specs/004-multi-tenant-supabase`'s established practice); Vitest + `@vue/test-utils` (both
frontends).

**Target Platform**: Existing Render-hosted Hapi web service; existing separately-hosted
`strawberry-admin`/`selloutPizza` Vue SPAs. No new infrastructure.

**Project Type**: Web application, three repos (backend + two independent frontends) — the same
multi-repo shape as `specs/004-multi-tenant-supabase`, not the plan template's generic two-repo
"Option 2."

**Performance Goals**: Not a high-throughput feature. A "Notify" click sends to, realistically,
dozens-to-low-hundreds of recipients at this platform's current scale (same "staff-provisioned
scale" framing as spec 004's FR-007) — no batching/queueing infrastructure is being built for
this version; Postmark's own Batch Email API (≤500 recipients/call) is sufficient headroom.

**Constraints**: Must not let a Postmark failure corrupt the audit trail (FR-007's "already
notified" record is only written on confirmed success — see research.md's Decision 2 for why this
means AWAITING the send, not fire-and-forget). Must respect per-tenant RLS. Must not introduce any
automatic/scheduled sending (FR-006).

**Scale/Scope**: One real tenant today, a handful of future tenants at most — no need to design
for a large-list sending problem; see research.md Decision 2.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Server Owns the Truth** — PASS. Subscription state, unsubscribe tokens, "already notified"
  status, and the decision of who gets emailed are all resolved and written server-side. The
  client never supplies a `tenant_id`, a subscriber's status, or which addresses to send to.
- **II. Store Access Is Least-Privilege** — PASS. The public signup endpoint reuses the existing
  non-secret store API key (`apiKey` strategy) exactly as `/cart` does — no new public auth
  mechanism. Admin subscriber-management and notify routes fall to the existing default-deny
  `adminBearer` strategy. The public unsubscribe link is the one deliberate exception to
  "authenticated by something" — covered explicitly below (Complexity Tracking).
- **III. Cards Only, Stripe-Hosted** — N/A, no payment involved.
- **IV. Pickup Only** — N/A, no delivery/address concept involved.
- **V. Time Is Stored in UTC, Displayed in Each Tenant's Configured Time Zone** — PASS. A
  notification email states the selected service window's `start_at`, formatted in that tenant's
  configured zone at send time (reusing the per-tenant `tenants.timezone` work from spec 004) —
  never UTC, never the recipient's own zone.
- **VI. Verify Before Done** — PASS (gate, not yet satisfied until implementation): plan requires
  real `@hapi/lab` route tests against the dev Supabase DB and Vitest coverage on both frontends,
  matching spec 004's bar, not just a manual check.
- **VII. Specs Span Repos** — PASS. This plan is written once here and lists per-repo changes
  below (Project Structure) across `strawberry-server`, `strawberry-admin`, `selloutPizza`.

No unjustified violations. One deliberate, narrow exception is documented in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/005-email-open-alerts/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/            # Phase 1 output
└── tasks.md              # Phase 2 output (/speckit-tasks — not this command)
```

### Source Code (repository root)

```text
strawberry-server/                       # backend — new plugin + Postmark client
├── server/
│   ├── db/migrations/
│   │   └── 97_email_subscribers.js      # new table, RLS, unsubscribe-token function
│   ├── plugins/
│   │   ├── emailSubscribers/            # new plugin (Model/Service/Controller/index.js)
│   │   │   ├── EmailSubscriberModel.js
│   │   │   ├── EmailSubscriberService.js
│   │   │   ├── EmailSubscriberController.js
│   │   │   └── index.js
│   │   ├── notifications/               # new plugin: send + notification_sends record
│   │   │   ├── NotificationSendModel.js
│   │   │   ├── NotificationService.js   # Postmark client wrapper lives here
│   │   │   ├── NotificationController.js
│   │   │   └── index.js
│   │   └── service/
│   │       └── ServiceController.js     # unchanged except for no new coupling — notify is its own plugin/route, not bolted onto service CRUD (FR-006: creating/editing a service must never trigger a send)
│   └── _tests/ (per-plugin, same convention as existing plugins)

strawberry-admin/                        # admin UI
├── src/
│   ├── pages/
│   │   └── SubscribersPage.vue          # new — list, count, manual-remove (AddressDiscountsPage.vue shape)
│   ├── pages/ServicesPage.vue           # add a "Notify subscribers" action + already-notified indicator per row
│   ├── api/
│   │   ├── email_subscriber.js          # new, utils.makeCruds(...) shape
│   │   └── notification.js              # new, one POST action
│   └── router/index.ts                  # new /subscribers route + nav entry (DefaultLayout.vue)

selloutPizza/                            # storefront
├── src/
│   ├── components/
│   │   ├── ServiceClosedCard.vue        # add the signup form here (renders exactly when closed/upcoming/none)
│   │   └── UnsubscribePage.vue          # new — the page the public unsubscribe link lands on
│   ├── api/subscribe.js                 # new
│   ├── stores/subscribe.ts              # new (loading/error idiom, matches stores/service.ts)
│   └── router/index.ts                  # new /unsubscribe route
```

**Structure Decision**: Matches spec 004's established per-repo plugin/page conventions exactly —
no new architectural pattern introduced. The one new structural element is a second backend
plugin (`notifications/`) kept separate from `emailSubscribers/` since one owns subscriber state
and the other owns the Postmark integration + send history; they compose rather than merge so a
future second notification type (if any) doesn't have to live inside the subscriber-storage
plugin.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|---------------------------------------|
| Public unsubscribe route (`auth: false`) is the one route in this feature not behind the store API key or admin bearer auth | A one-click unsubscribe link in an email cannot carry the store's Basic-auth credentials or an admin JWT — it must work from a bare click with no app context at all (Principle II's "default-deny" is the admin-route default, not an absolute rule for every route; `/stripe/webhook` is an existing precedent for a deliberate, narrow `auth: false` exception) | A double-step "confirm unsubscribe" page behind some lightweight auth was considered and rejected: it adds friction for zero security benefit, since the token itself (not a password) is the actual protection, and industry-standard one-click unsubscribe is explicitly what CAN-SPAM-style compliance expects |

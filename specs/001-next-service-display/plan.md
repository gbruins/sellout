# Implementation Plan: Next Service Display

**Branch**: `001-next-service-display` | **Date**: 2026-10-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-next-service-display/spec.md`

## Summary

Visitors see whether the shop is open and what is on offer. The server exposes one
read model, the "service state" (status, service window, remaining pizzas, menu), and
pushes changes to open pages over a Server-Sent Events (SSE) stream. The storefront
renders the closed, open, sold-out and empty views from that state. Remaining pizzas are
computed on the server as `inventory - paid - held by open checkouts`, which requires
linking carts to services and recording when a checkout hold expires. The admin gains a
menu picker, a per-order cap field and Los Angeles time display.

Work spans three repos and ships in four slices (see Delivery Slices).

## Technical Context

**Language/Version**: JavaScript (ESM) on Node.js for Strawberry Server; TypeScript and
JavaScript in Vue 3.5 for the storefront and admin.

**Primary Dependencies**: Server: Hapi 21, Knex, Joi, Stripe SDK (all existing; no new
packages). Storefront: Vue 3, Pinia 4, Vue Router 5, Tailwind 4, axios (existing) and
`@microsoft/fetch-event-source` (new, for an authenticated SSE client). Admin: existing
Vue, Vuelidate and figleaf components.

**Storage**: PostgreSQL. New columns only: `service.max_per_order`, `carts.service_id`,
`carts.checkout_expires_at`. No new tables.

**Testing**: Server: live curl scripts against a throwaway server (the existing lab tests
are broken and out of scope). Storefront: vitest with a fake clock and a fake stream.
Admin: vitest for the new field logic where practical.

**Target Platform**: Browser storefront and admin; a single Node.js server process.

**Project Type**: Web application across three repositories (server, admin, storefront).

**Performance Goals**: Count change reaches 95% of 100 open pages within 3 seconds
(SC-008). Open and ended states flip within 1 minute (SC-003).

**Constraints**: Browser `EventSource` cannot send the Basic-auth header, so the stream
is read with `fetch`. Streams must survive gzip and idle timeouts. One server process is
assumed; running several would need Postgres LISTEN/NOTIFY (see research R3).

**Scale/Scope**: A small shop: tens to low hundreds of concurrent viewers, a few
services per week, tens of pizzas per service.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Server owns the truth | Pass | Open, sold-out, remaining count, caps and the checkout cutoff are all computed and enforced on the server. The client only renders them and uses the server clock offset. |
| II. Least-privilege store access | Pass | `GET /services/next` and its stream opt in to the store key and return only published data. The stream sends the Basic header (fetch-based client), so there is no public unauthenticated route. Cart rules stay behind cart tokens. |
| III. Cards only, Stripe-hosted | Pass | No change to payment. Hold release relies on the existing 31-minute session expiry; the webhook remains the only completion path and stays idempotent. |
| IV. Pickup only | Pass | Nothing delivery-related is added. |
| V. UTC and Los Angeles display | Pass | Columns stay `timestamptz`. The payload carries ISO UTC strings. Both UIs format with `America/Los_Angeles`. Admin audit is a task. |
| VI. Verify before done | Pass | Each slice has a curl or vitest verification in the quickstart. |
| VII. Specs span repos | Pass | Per-repo changes are listed below. |

Re-check after design: no violations. No complexity justification needed.

## Project Structure

### Documentation (this feature)

```text
specs/001-next-service-display/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── service-state.md
├── checklists/requirements.md
└── tasks.md              # created by /speckit-tasks
```

### Source Code (three repositories)

```text
strawberry-server/
├── server/db/migrations/
│   └── 80_service_holds.js              # NEW: service.max_per_order, carts.service_id, carts.checkout_expires_at
├── server/plugins/service/
│   ├── ServiceState.js                  # NEW: builds the state snapshot; remaining-count SQL
│   ├── ServiceStream.js                 # NEW: SSE hub (listeners, heartbeat, change tick)
│   ├── ServiceModel.js                  # + max_per_order
│   ├── ServiceController.js             # + nextHandler, streamHandler
│   └── index.js                         # + GET /services/next, GET /services/next/stream
├── server/plugins/cart/
│   ├── CartItemService.js               # attach cart to open service; enforce cap and stock
│   ├── CartService.js                   # reconcile ended-service carts (FR-016)
│   ├── CheckoutService.js               # transactional hold, open-service check, release
│   └── cartAccess.js                    # surface the cart reset notice
└── server/plugins/stripe/               # webhook notifies ServiceStream after completion

strawberry-admin/src/
├── components/services/ServiceUpsertModal.vue   # + menu select, max_per_order
├── pages/ServicesPage.vue                       # show LA time, menu title
├── composables/useDate.js                       # LA time formatting (audit)
└── api/ (service_menus read-only list)          # existing makeCruds, no change expected

selloutPizza/src/
├── api/service.js                       # NEW: fetch state
├── stores/service.ts                    # NEW: state, clock offset, stream lifecycle
├── utils/shopTime.ts                    # NEW: America/Los_Angeles formatting
├── utils/serviceStream.ts               # NEW: fetch-event-source wrapper
├── pages/HomeView.vue                   # renders by status; layout content moves here
├── components/ServiceClosedCard.vue     # NEW: next service info and empty state
├── components/ServiceStatusNotice.vue   # NEW: connection and error notices
├── components/StoreOpenBadge.vue        # driven by status
├── components/PizzaList.vue             # reads menu products
├── components/PizzaRemainingCountdown.vue / PizzaInventoryMatrix.vue  # take real values
├── layouts/DefaultLayout.vue            # home content removed
└── **/__tests__/                        # store, util and component specs
```

**Structure Decision**: Keep the three existing repositories and add to existing plugin
folders. The only new server files are the state builder and the stream hub, both inside
the `service` plugin so the feature stays in one place.

## Design Decisions

1. **One read model, two delivery paths.** `ServiceState.build()` returns the snapshot
   used by both `GET /services/next` (initial load, fallback) and the SSE stream.
2. **Push by SSE.** The hub keeps the connected responses, sends a `state` event on
   connect, on any change, and a heartbeat comment every 25 seconds. Mutations (hold
   created, cancelled, webhook paid) call `ServiceStream.publish()`. A 15-second tick
   rebuilds the snapshot only when listeners exist and publishes if it changed, which
   also covers service start and end, and hold expiry, with no per-event bookkeeping.
3. **Holds are rows, not Stripe lookups.** `carts.checkout_expires_at` is set when a
   checkout starts (now plus 31 minutes) and cleared on cancel. A cart holds its quantity
   while `checkout_expires_at > now` and it is not closed. Counting holds never calls
   Stripe.
4. **Race safety.** Starting a checkout runs in a transaction that locks the service row
   (`FOR UPDATE`), recomputes remaining excluding this cart, checks the cap, and writes
   the hold before the Stripe session is created. If Stripe fails, the hold is cleared.
5. **Cart belongs to a service.** The server attaches `carts.service_id` when the first
   item is added, using the currently open service (the client never sends it). Adding
   when no service is open returns 409. On any cart read or write, a cart whose service
   has ended, with no live hold, is emptied and reported with a `cart_reset` notice.
6. **Time.** The payload includes `server_now`. The store keeps
   `offset = server_now - Date.now()` and schedules local timers with it, as a fallback
   if the stream is down.
7. **Items counted.** Every cart item quantity counts against inventory (all menu items
   are treated as pizzas). Revisit if non-pizza items are added.

## Delivery Slices

| Slice | Scope | Spec coverage |
|-------|-------|---------------|
| 1 | Migration, `GET /services/next` (remaining = inventory minus paid orders, no holds yet), storefront store and views, badge, shop time utility | US1, US2, FR-001 to FR-005, FR-009, FR-010, FR-012, FR-013, FR-015 |
| 2 | SSE stream, store reconnect and notices | US3, FR-011, FR-017, FR-018, SC-008 |
| 3 | Cart to service link, holds, stock and cap enforcement, ended-service cart reset, sold-out view with next service | FR-006 to FR-008, FR-016, US2 scenario 4 |
| 4 | Admin menu picker, cap field, LA time display | US4, FR-014, FR-010 (admin) |

## Risks and Open Items

- **No admin screen to create menus or add products to a menu.** The spec puts this out of
  scope, so the manager cannot set up a menu without a developer or SQL. Recommend a
  follow-up spec (`002-menu-management`).
- Gzip or a proxy can buffer SSE. Slice 2 must test with the real hosting setup and set
  no-buffering headers.
- Per-viewer connection cost. Cap connections per caller and per process.
- Hosting is unknown. If more than one server instance runs, replace the in-process hub
  with Postgres LISTEN/NOTIFY.
- Price drift and double-payment refunds remain on the TODO list and are not in this
  feature.

## Complexity Tracking

No constitution violations to justify.

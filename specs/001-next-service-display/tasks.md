# Tasks: Next Service Display

**Input**: Design documents from `/specs/001-next-service-display/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/service-state.md](./contracts/service-state.md), [quickstart.md](./quickstart.md)

**Tests**: Constitution principle VI requires verification. Server behavior is verified with the curl scenarios in the quickstart (the existing lab tests are broken and out of scope). Storefront logic gets vitest specs.

**Organization**: Grouped by user story. Paths are prefixed with the repository: `server/` is `/Users/bruins/Sites/strawberry-server`, `admin/` is `/Users/bruins/Sites/strawberry-admin`, `store/` is `/Users/bruins/Sites/selloutPizza`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 closed view, US2 open view and stock, US3 live updates, US4 admin menu picker

## Phase 1: Setup

- [X] T001 Add the dependency `@microsoft/fetch-event-source` to `store/package.json` (npm install, commit lock file)
- [X] T002 [P] Add the exact throwaway-server commands (spare port, hashed test key, temporary rows, cleanup) to `store/specs/001-next-service-display/quickstart.md` so every curl check is repeatable

## Phase 2: Foundational (blocks all stories)

- [X] T003 Create migration `server/server/db/migrations/80_service_holds.js` adding `service.max_per_order` (integer, not null, default 4, minimum 1), `carts.service_id` (uuid, nullable, FK to `service.id`), `carts.checkout_expires_at` (timestamptz, nullable) and an index on `carts (service_id)`; include a working `down`
- [X] T004 Run the migration on the dev database and confirm the columns exist
- [X] T005 [P] Add `max_per_order: Joi.number().integer().min(1)` to the schema in `server/server/plugins/service/ServiceModel.js`
- [X] T006 [P] Add `service_id` (uuid, allow null) and `checkout_expires_at` (date, allow null) to `server/server/plugins/cart/CartModel.js`, and verify store callers still cannot write them (the billing-only restriction in `server/server/plugins/cart/cartAccess.js` already blocks other fields; add a curl check)
- [X] T007 Create `server/server/plugins/service/ServiceState.js` exporting `buildState(now = new Date())` that returns the contract object: pick the service with `end_at > now` and the earliest `start_at`; status `open`, `sold_out`, `upcoming` or `none`; `server_now`; published menu with published products only; `next_service` when sold out. In this slice `remaining` is `max(0, inventory_count - paid_qty)` where `paid_qty` is the quantity of pizza items (product type slug `pizza`) on closed carts with that `service_id`
- [X] T008 Create `store/src/utils/shopTime.ts` exporting formatters (date, time, range) that use `Intl.DateTimeFormat` with `timeZone: 'America/Los_Angeles'` and label the zone
- [X] T009 [P] Add `store/src/utils/__tests__/shopTime.spec.ts` covering a UTC instant on both sides of the daylight saving change and a visitor zone different from Los Angeles
- [X] T010 Create `store/src/api/service.js` with `getNext()` calling `GET /services/next`, and register it in `store/src/plugins/api.js` next to `auth` and `cart`
- [X] T011 Create the Pinia store `store/src/stores/service.ts` with state (`status`, `service`, `remaining`, `menu`, `nextService`, `loading`, `error`, `serverOffsetMs`), `load()` (stores `server_now - Date.now()` as the offset), `retry()`, and a `now()` helper that applies the offset

**Checkpoint**: Schema, state builder, time helper and store skeleton exist.

## Phase 3: User Story 1 - See when the shop is next open (P1) 🎯 MVP

**Goal**: A closed-state visitor sees the next service in Los Angeles time, or an empty message.

**Independent Test**: Quickstart slice 1 rows "No services", "Upcoming", "Earliest wins", "Time zone", "Error".

- [X] T012 [US1] Add `GET /services/next` to `server/server/plugins/service/index.js` with `auth: { strategies: ['apiKey', 'adminCookie'] }`, a `nextHandler` in `server/server/plugins/service/ServiceController.js` calling `buildState`, and no rate-limit change. Declare it before `/service` routes so it is not shadowed
- [X] T013 [US1] Verify with curl against a throwaway server: statuses `none`, `upcoming` and earliest-wins, a 401 without the key, and that `server_now` is present. Delete the temporary rows afterwards. Also check exact start and end boundaries and a service ending as the next begins (see T053)
- [X] T014 [P] [US1] Create `store/src/components/ServiceClosedCard.vue` showing start and end (using `shopTime`), notes when present, and the empty message "No service scheduled" when status is `none`; style to match the dark zinc and orange theme
- [X] T015 [P] [US1] Create `store/src/components/ServiceStatusNotice.vue` for the loading, error and "may be out of date" notices, with a retry button wired to `retry()`
- [X] T016 [US1] Update `store/src/pages/HomeView.vue` to call `load()` on mount and render by status: closed card for `upcoming` and `none`, notice for loading and error
- [X] T017 [US1] Move the home content out of `store/src/layouts/DefaultLayout.vue` into `HomeView.vue` so other routes (for example `/order/complete`) do not show it, and replace the stale `store/src/layouts/__tests__/DefaultLayout.spec.ts`
- [X] T018 [US1] Make `store/src/components/StoreOpenBadge.vue` follow the store status ("Open Now" only when `open`, otherwise a closed label) and update `AppHeader.vue` if it needs a prop
- [X] T019 [P] [US1] Add `store/src/stores/__tests__/service.spec.ts`: status mapping, clock offset with a wrong device clock, error and retry
- [X] T020 [P] [US1] Add `store/src/pages/__tests__/HomeView.spec.ts` for the closed, empty and error views

**Checkpoint**: US1 works alone. This is the MVP.

## Phase 4: User Story 2 - See the live service and its menu (P1)

**Goal**: During a service the page shows the counter, matrix and published menu.

**Independent Test**: Quickstart slice 1 rows "Open", "Unpublished hidden", "No menu".

- [X] T021 [US2] Verify with curl the `open` status: menu with only published products, `menu: null` when none is assigned, and `remaining` equal to `inventory_count` minus paid quantity (no holds yet)
- [X] T022 [P] [US2] Update `store/src/components/PizzaRemainingCountdown.vue` and `PizzaInventoryMatrix.vue` to take real `remaining` and total from the store (remove the hardcoded 30 and 60 in `HomeView.vue`)
- [X] T023 [US2] Update `store/src/components/PizzaList.vue` to render `menu.products` with price formatting (new `store/src/utils/format.js`, cents to dollars), keeping the `order` emit as the hand-off point for the future cart UI (spec `003-cart-checkout-ui`); show "menu not available yet" when `menu` is null; update `store/src/components/__tests__/PizzaList.spec.ts`
- [X] T024 [US2] Update `HomeView.vue` to render the open view for `open` status and add specs for it in `store/src/pages/__tests__/HomeView.spec.ts`
- [ ] T025 [US2] Verify end to end in the browser against the dev server using quickstart slice 1

**Checkpoint**: US1 and US2 both work. First slice complete.

## Phase 5: User Story 3 - The page changes state without a reload (P2)

**Goal**: Count and state update live over SSE, and recover after a drop.

**Independent Test**: Quickstart slice 2.

- [X] T026 [US3] Create `server/server/plugins/service/ServiceStream.js`: a hub holding connected responses, `subscribe(request)` returning a `PassThrough`, `publish()` that rebuilds the state and sends a `state` event with an increasing `id` only if it changed, a 25-second `: ping` heartbeat, a 3-second change-detecting tick that runs only while listeners exist, and a cap of `SERVICE_STREAMS_PER_IP` (default 50) concurrent streams per caller IP returning 429
- [X] T027 [US3] Add `GET /services/next/stream` to `server/server/plugins/service/index.js` and `streamHandler` to `ServiceController.js`: same auth, headers `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`, gzip and the socket timeout disabled for the route, first event is a full `state`, cleanup on disconnect
- [X] T028 [US3] Call `ServiceStream.publish()` after a checkout is started, cancelled, or completed in `server/server/plugins/cart/CheckoutService.js` and the webhook handler in `server/server/plugins/stripe/StripeController.js`
- [X] T029 [US3] Verify the stream with `curl -N`: initial `state`, change on a database edit within the tick, heartbeat, sixth connection gets 429, and no leaked listeners after disconnect
- [X] T030 [P] [US3] Create `store/src/utils/serviceStream.ts` wrapping `@microsoft/fetch-event-source` with the Basic-auth header, a `state` handler, automatic retry with backoff, pause while the tab is hidden, and callbacks for connected and disconnected
- [X] T031 [US3] Wire the stream into `store/src/stores/service.ts`: `connect()` and `disconnect()`, apply pushed state, set a `stale` flag while disconnected and clear it on the first state after reconnect, a local timer using the clock offset as a fallback for start and end boundaries (display only: it never enables ordering, which the server decides); start and stop it from `HomeView.vue` mount and unmount
- [X] T032 [P] [US3] Extend `store/src/stores/__tests__/service.spec.ts` with a fake stream and fake timers: pushed update, disconnect marks stale, reconnect shows the current count, boundary flip from `upcoming` to `open` and `open` to the next service
- [ ] T033 [US3] Verify quickstart slice 2 steps 1 to 5, including the load check with 100 simulated streams against SC-008 (raise `SERVICE_STREAMS_PER_IP` for the test), and test behind the real hosting or proxy once known, with `trustProxy` set

**Checkpoint**: Live updates work.

## Phase 6: User Story 2 (completion) - Stock holds, caps and cart reset (P1)

**Goal**: The count is real: holds, caps, cutoff, sold-out view, and ended-service carts. Slice 3.

**Independent Test**: Quickstart slice 3.

- [X] T034 [US2] Extend `buildState` in `server/server/plugins/service/ServiceState.js` so `remaining = max(0, inventory_count - paid_qty - held_qty)` where `paid_qty` and `held_qty` count only pizza items (product type slug `pizza`), and `held_qty` counts carts with `closed_at IS NULL` and `checkout_expires_at > now()`; add the sold-out status and `next_service`
- [X] T035 [US2] In `server/server/plugins/cart/CartItemService.js`, on the first add attach `carts.service_id` from the currently open service; return `409 { code: "no_open_service" }` when none is open and `409 { code: "over_limit", max_per_order, remaining }` when the cart's pizza total would exceed `min(max_per_order, remaining)`. Non-pizza items are never limited or counted. The client never sends `service_id`
- [X] T036 [US2] In `server/server/plugins/cart/CheckoutService.js`, run checkout start in one transaction: lock the service row `FOR UPDATE`, recompute remaining excluding this cart, check `start_at <= now < end_at` (`409 service_closed`), the cap and stock (`409 sold_out` or `over_limit`), write a provisional `checkout_expires_at = now + 31 minutes`, commit, create the Stripe session, then set `checkout_expires_at` to the session's `expires_at` plus 60 seconds so the hold always outlasts the session; clear the hold if Stripe fails
- [X] T037 [US2] Clear `checkout_expires_at` in `cancelCheckout` and when the existing lazy Stripe check sees an expired session (`checkout_expires_at` stays authoritative for counting), and make `completeCartFromSession` accept payment after `end_at` when the checkout started in the window (FR-008)
- [X] T038 [US2] Reconcile ended-service carts in `server/server/plugins/cart/CartService.js`: on any cart read or write, if `service.end_at <= now`, the cart has no live hold and is not closed, delete its items, clear `service_id`, and return `cart_reset: "service_ended"` once; surface it through `server/server/plugins/cart/cartAccess.js` and `CartController.js`
- [X] T039 [US2] Verify quickstart slice 3 steps 1 to 8 by curl, including the concurrent last-pizza race (exactly one checkout succeeds) and hold expiry recovering without a request
- [X] T040 [P] [US2] Add a sold-out view to `store/src/pages/HomeView.vue` and `ServiceClosedCard.vue`: sold-out message plus the next service's date and time when `next_service` exists; ordering disabled
- [X] T041 [P] [US2] Handle the new 409 codes in `store/src/api/cart.js` and show clear messages (no open service, over limit, sold out, service closed) wherever the cart UI will call them; add tests in `store/src/api/__tests__/api.spec.js`
- [X] T042 [US2] Show the one-time "your previous service has ended, your cart was emptied" notice when a response carries `cart_reset`, and clear the stored cart credentials if the cart is gone
- [ ] T043 [US2] Verify quickstart slice 3 step 9 and the sold-out view in the browser

**Checkpoint**: Stock, caps and cart reset enforced on the server.

## Phase 7: User Story 4 - Manager chooses a menu for a service (P2)

**Goal**: The manager sets the menu and the per-order cap in the admin, with Los Angeles time. Slice 4.

**Independent Test**: Quickstart slice 4.

- [X] T044 [US4] Allow `service_menu_id` and `max_per_order` on `POST /service` and `PUT /service` in `server/server/plugins/service/ServiceController.js` (admin only), validating `max_per_order` is an integer of at least 1
- [X] T045 [P] [US4] Add a menu select (loading `service_menu.search`, published menus) and a "Max per order" number field (minimum 1, default 4) to `admin/src/components/services/ServiceUpsertModal.vue`, with validation and locale strings in `admin/src/locales/en-US.js`
- [X] T046 [P] [US4] Show the menu title and per-order cap in `admin/src/pages/ServicesPage.vue`
- [X] T047 [US4] Audit `admin/src/composables/useDate.js` and `admin/src/components/figleaf/format8601/Format8601.vue`; make service start and end display and edit in America/Los_Angeles, converting to and from UTC on save, and fix any use of the browser zone
- [ ] T048 [US4] Verify quickstart slice 4 in the browser; note the admin has uncommitted changes of the owner's, so stage only these files when committing

## Phase 8: Polish and cross-cutting

- [X] T049 [P] Run `npx vitest run`, `npx vue-tsc --noEmit -p tsconfig.app.json` and eslint on the new storefront files; fix problems in new code only
- [X] T050 [P] Update `server/README.md` with the new routes, the stream behavior, `SERVICE_STREAMS_PER_IP`, `trustProxy` and any proxy buffering notes
- [X] T051 [P] Create `store/TODO.md` with the deferred items: order confirmation emails, cart price snapshot drift, double-payment refund path, Stripe Tax, `trustProxy`, and the follow-up specs `002-menu-management` (menu and product screens) and `003-cart-checkout-ui` (cart and checkout screens)
- [X] T053 [P] Add a server check script (curl plus SQL, throwaway server) for `buildState` boundaries: exactly at `start_at`, exactly at `end_at`, a service ending as the next begins, a daylight saving change date, and the count at load being current after a hold, cancel and expiry (SC-002, SC-005)
- [ ] T052 Run the full quickstart once, clean up temporary rows, and run `/speckit-analyze` then `/speckit-converge` to confirm nothing is missing

## Dependencies and Order

- Phase 1 then Phase 2 block everything.
- US1 (Phase 3) depends only on Phase 2. It is the MVP.
- US2 open view (Phase 4) depends on Phase 3 (same page and store).
- US3 (Phase 5) depends on Phase 4; T028 also touches checkout code that Phase 6 changes, so do T028 before T036 and re-check it afterwards.
- US2 completion (Phase 6) depends on Phase 2 migration and T034 extends T007. T040 to T042 need T041.
- US4 (Phase 7) depends only on Phase 2, so it can run in parallel with Phases 5 and 6 by a second person. T044 is server work that does not conflict with the others.
- Phase 8 last.

## Parallel Examples

- After T004: T005, T006, T008, T009 touch different files.
- In US1: T014, T015, T019, T020 after T011.
- In Phase 6: T040 and T041 while the server tasks T034 to T038 are in progress.
- US4 (T045, T046) while Phase 5 runs.

## Implementation Strategy

1. **MVP**: Phases 1 to 3. Commit and show it. Visitors can already see when the shop opens.
2. **Open view**: Phase 4 completes the first slice from the plan.
3. **Live and real stock**: Phases 5 and 6, then re-run `/speckit-converge`.
4. **Admin**: Phase 7.
5. Commit per repo after each phase, staging only this feature's files, and push nothing without the owner's go-ahead.

## Notes

- Constitution I: remaining, caps and the checkout cutoff are enforced on the server; the storefront only renders them.
- Constitution V: no server-side formatting, display in America/Los_Angeles in both UIs.
- The stream hub is in-process. Revisit with Postgres LISTEN/NOTIFY if more than one server instance runs.

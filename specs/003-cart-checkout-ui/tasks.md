---
description: "Task list for Cart and Checkout Screens"
---

# Tasks: Cart and Checkout Screens

**Input**: `/specs/003-cart-checkout-ui/` (plan.md, spec.md, research.md, data-model.md, contracts/cart-api.md, quickstart.md)

**Tests**: Per Constitution VI, server rules are verified by a live script (`scripts/checkCart.js`), the storefront by Vitest unit tests plus a real-browser run with a Stripe test card, and the admin by build plus a browser check.

**Format**: `- [ ] T### [P?] [Story] Description with path`. Paths: `SRV` = `/Users/bruins/Sites/strawberry-server`, `ADM` = `/Users/bruins/Sites/strawberry-admin`, `STORE` = `/Users/bruins/Sites/selloutPizza`.

## Phase 1: Setup

- [X] T001 Read `SRV/server/plugins/cart/` (`CartService.js`, `CartItemService.js`, `CheckoutService.js`, `cartAccess.js`, `index.js`), `STORE/src/api/cart.js`, `STORE/src/utils/cartErrors.ts`, `STORE/src/components/PizzaList.vue` and `STORE/src/pages/HomeView.vue`; confirm the existing shapes match `contracts/cart-api.md` and note any difference

## Phase 2: Foundational (blocks all stories)

- [X] T002 Add migration (run only after the user approves touching the dev DB) `SRV/server/db/migrations/100_cart_customer_note.js` adding nullable text `customer_note` to `carts` (down drops it); run it with `npm run knex:migrate`
- [X] T003 Add `customer_note` to `SRV/server/plugins/cart/CartModel.js` as `Joi.string().trim().max(500)` allowing null and empty; keep `admin_order_notes` unchanged and still hidden from store callers
- [X] T004 Add `checkout_in_progress` (not stored) to the `GET /cart` response in `SRV/server/plugins/cart/CartController.js` (or an `onPreResponse` helper in `cartAccess.js`): true only when the cart is open and `isCheckoutInProgress(cartId, stripe_order_id)` from `CheckoutService.js` is true, i.e. the Stripe session is still live. Do not derive it from `checkout_expires_at`, because the hold outlasts the session (A1)
- [X] T005 In `SRV/server/plugins/cart/CartItemService.js` `addRelationToCarts`, make each cart line's `product.title` and `product.base_price` the current product row values so `price_subtotal` matches what checkout charges (research R4). If the product row is deleted or unpublished, keep the stored snapshot values for that line; checkout then refuses it with `item_unavailable`
- [X] T006 [P] Create `STORE/src/stores/cart.ts` (Pinia): state `cart`, `busy` (`add|update|remove|note|pay|cancel|null`), `error`, `unavailableProductId`; getters `count`, `locked` (= `cart.checkout_in_progress`); actions `load`, `addPizza`, `setQty`, `remove`, `saveNote`, `pay`, `cancelPayment`, `reset`. Every action returns early while `busy` is set (FR-017), replaces `cart` with the server response, and sets `error` through `cartErrorMessage`. The store never computes totals (FR-013)
- [X] T007 [P] Extend `STORE/src/api/cart.js` with `setCustomerNote(note)` (`PUT cart/customer_note`) and `cancelCheckout()` (`POST cart/checkout/cancel`), both using the stored cart id; `checkout()` is unchanged
- [X] T008 [P] Add the `item_unavailable` and `checkout_in_progress` codes to `STORE/src/utils/cartErrors.ts`: for the first, message `"<title>" is no longer available` taken from `data.title`, and expose `data.product_id` so the store can highlight the line (FR-011, FR-012); for the second, "Payment is in progress for this cart". The store reloads the cart on `checkout_in_progress` so the locked state shows (A3)
- [X] T009 Add `/cart` route (name `cart`, lazy `@/pages/CartView.vue`) to `STORE/src/router/index.ts`

**Checkpoint**: migration applied; `GET /cart` returns `customer_note`, `checkout_in_progress` and current prices; store, API client and route compile.

## Phase 3: User Story 1 - Add pizzas and pay (P1) 🎯 MVP

**Goal**: A visitor adds pizzas, sees the cart and total, pays through Stripe, and returns to an empty cart.
**Independent test**: Quickstart steps 3, 4 and 9.

### Server

- [X] T010 In `SRV/server/plugins/cart/CheckoutService.js` `createCheckoutForCart`, if `cart.stripe_order_id` is a session id whose Stripe status is `open`, return `{ url }` of that session without expiring it, reserving stock again or creating a new session; keep the `complete` refusal (research R5, FR-017). Make creation atomic per cart so two simultaneous requests cannot both create a session: take a per-cart lock (for example a transaction with `SELECT ... FOR UPDATE` on the cart row, or a conditional update of a pending marker) around the check, reserve and create steps, and have the second request return the first's URL (A2)
- [X] T011 In the same function, replace the "is no longer available" throws (unpublished, deleted, not on the menu) with a Boom 409 carrying `data: { code: 'item_unavailable', product_id, title }` and message `"<title>" is no longer available`; leave other failures as they are (research R6)
- [X] T012 Create `SRV/scripts/checkCart.js` (pattern of `scripts/checkMenus.js`: `TMPTEST` data, admin cookie via `@hapi/iron`, store key, `global.logger` stub, cleanup, leftover count) covering: cart read shows the current price after a price change; `checkout_in_progress` true after checkout and false after the session expires (A1); second checkout returns the same URL; two checkouts fired in parallel create exactly one session (A2); a line taken off the menu gives `409 item_unavailable` with title and product id; an item edit during checkout gives `409` with `code: 'checkout_in_progress'` (A3); remaining dropping below the cart quantity makes checkout refuse with `over_limit` (A5) Needs Stripe test keys; if absent, the script skips the Stripe checks and says so

### Storefront

- [X] T013 [US1] Wire `STORE/src/pages/HomeView.vue`: handle the `order` event from `PizzaList` by calling `cart.addPizza(pizza)` (creates the cart on first use, then adds one; a repeat raises the quantity); show the store's `error` near the menu
- [X] T014 [P] [US1] Create `STORE/src/components/CartIndicator.vue`: a header link to `/cart` with the server's `num_items` and an accessible label ("Cart, 3 pizzas"); loads the cart once on app start when credentials exist; add it to `STORE/src/components/AppHeader.vue` (FR-003)
- [X] T015 [P] [US1] Create `STORE/src/components/CartLine.vue`: title, unit price, quantity, line total from the server fields, formatted with `STORE/src/utils/format.ts` (FR-004, FR-018)
- [X] T016 [US1] Create `STORE/src/pages/CartView.vue`: loads the cart; empty state with a link to the menu; lines; order total; a pickup-only line and no address fields (FR-018); a Pay button that calls `cart.pay()` and sends the browser to the returned Stripe URL; Pay and Order now disabled while busy, with a visible in-progress label (FR-007, FR-017); layout that works at 360 px (FR-016, SC-007)
- [X] T017 [US1] Make `STORE/src/pages/OrderCompleteView.vue` also call `cart.reset()` after `$api.cart.forget()` so the indicator shows 0 (FR-009)
- [X] T018 [US1] Vitest: `STORE/src/stores/__tests__/cart.spec.ts` (add creates then adds; repeat taps while busy make one call; state follows the server response) and `STORE/src/pages/__tests__/CartView.spec.ts` (lines, total, empty state, Pay redirects, no address fields)
- [X] T019 [US1] Browser check (quickstart steps 3, 4, 9) with a Stripe test card; run any Stripe-dependent checks from T012 here if the script skipped them

**Checkpoint**: MVP. A visitor can buy pizza.

## Phase 4: User Story 3 - Clear messages when something changes (P2)

**Goal**: Closed, sold out, limit, unavailable pizza, cancelled payment, reset and errors all give plain messages and never leave the visitor stuck.
**Independent test**: Quickstart steps 6, 7 and 8.

- [X] T020 [US3] Locked state in `STORE/src/pages/CartView.vue`: when `cart.locked`, show "Payment in progress", disable edits, and show Continue to payment (calls `cart.pay()`, which returns the same URL) and Cancel payment (calls `cart.cancelPayment()`, then reloads the cart) (FR-008)
- [X] T021 [US3] Cancel return: when the route has `?checkout=cancelled`, show "Payment cancelled" once, call `cart.load()`, and remove the query parameter (FR-010)
- [X] T022 [US3] Unavailable pizza: on `item_unavailable` highlight that line in `STORE/src/components/CartLine.vue`, show the named message, keep Pay available for retry after the line is removed (FR-011)
- [X] T023 [US3] Closed, upcoming and sold-out: use `STORE/src/stores/service.ts` status to disable Order now and Pay and show the reason (reuse `cartErrors` wording) (FR-014); show a retryable message with a Retry button for network and server errors and keep the cart as it was (FR-012)
- [X] T024 [US3] Reset notice: when a cart response has `cart_reset`, call the existing `STORE/src/stores/cartNotice.ts` `showReset()`, and render `STORE/src/components/CartResetNotice.vue` on the cart page as well as the menu (FR-015)
- [X] T025 [US3] Vitest additions in `cart.spec.ts` and `CartView.spec.ts` for locked state, cancel return, `item_unavailable` highlight, closed and sold-out disabling, and reset notice
- [X] T026 [US3] Browser check (quickstart steps 6, 7, 8); confirm `cart.checkout` never sends the browser to Stripe when refused

**Checkpoint**: Every refusal reads clearly; no stuck states.

## Phase 5: User Story 2 - Change the order before paying (P2)

**Goal**: Quantity buttons, remove, a customer note, and a cart that survives restarts.
**Independent test**: Quickstart steps 5, plus the note shown in the admin.

### Server

- [X] T027 Add `PUT /cart/customer_note` to `SRV/server/plugins/cart/index.js` with a handler in `CartController.js`: payload `{ id, customer_note }` (`customer_note` max 500, null or empty clears); auth `adminCookie` and `apiKey`; `pre` `requireCartAccess` with `{ mutates: true }` (so it is refused during checkout); `onPreResponse` `redactCartForStore`; the handler updates only `customer_note`
- [X] T028 Extend `SRV/scripts/checkCart.js`: note saves and reads back; 501 characters rejected; note refused while checkout is open; a store caller with another cart's token gets 403 and the other cart's note is unchanged; `admin_order_notes` is absent from store responses

### Storefront

- [X] T029 [US2] Add plus, minus and remove buttons to `STORE/src/components/CartLine.vue`, calling `cart.setQty` and `cart.remove`; minus at 1 removes after no extra prompt; buttons disabled while busy or locked (FR-005)
- [X] T030 [US2] Add the note textarea to `STORE/src/pages/CartView.vue` (shown as plain text everywhere, never as HTML; 500-character counter, saves on blur or a Save button through `cart.saveNote`, clears when empty, read-only when locked) (FR-005, FR-019)
- [X] T031 [US2] Limits: on `over_limit` show "You can order up to N pizzas" from the server values and leave the cart unchanged; confirm persistence across reload and browser restart (`cartCredentials.js`) and a 404 gives a fresh empty cart with no error screen (FR-006, edge cases)
- [X] T032 [US2] Vitest additions: plus/minus/remove update from the server response; note saves and clears; over-limit message; 404 resets to an empty cart
- [X] T033 [P] [US2] Admin: show `customer_note` read-only, as plain text never HTML, above the admin note in `ADM/src/components/cart/CartDetailNotesCard.vue` (add the label string to `ADM/src/locales/en-US.js`); `vite build` passes (FR-019)
- [X] T034 [US2] Browser check (quickstart steps 4 note in admin and 5), including two tabs editing one cart (last change wins, each tab then shows the server's cart) and pressing Back after paying (no second payment; empty cart or thank-you) (A5)

**Checkpoint**: Full cart editing and the note reach the manager.

## Phase 6: Polish and cross-cutting

- [X] T035 Run `npm run test:unit -- --run`, `npm run type-check` and `npm run lint` in `STORE`; run `node --require dotenv/config scripts/checkCart.js`, `checkMenus.js` and `checkServiceState.js` in `SRV`; confirm no `TMPTEST` leftovers (quickstart steps 1 and 2)
- [X] T036 Phone-width check at 360 px for `/cart` and the thank-you page; keyboard-only run through add, edit and pay (FR-016, SC-007)
- [X] T037 Time the SC-001 flow (menu to Stripe page with two pizzas, under 60 seconds) and SC-006 (each add, change quantity or remove shows on screen within 1 second)
- [X] T038 Add a "Cart" section to `SRV/README.md` (customer note route, `checkout_in_progress`, session reuse, `item_unavailable`) and update `STORE/TODO.md` (mark 003 built; the cart snapshot-drift item is closed for display only)
- [X] T039 Re-run the spec 001 items now unblocked: T058 (cart reset notice in the browser) and T048 and T052 (full quickstart walkthrough, `/speckit-analyze` and `/speckit-converge`); update `specs/001-next-service-display/tasks.md`

## Dependencies and order

- Phase 1 → Phase 2 → all stories. Phase 2 tasks T006 to T008 are parallel; T002 to T005 are in order.
- **US1** (Phase 3) needs Phase 2 and T010 to T011; it is the MVP.
- **US3** (Phase 4) needs US1. **US2** (Phase 5) needs US1; T027 and T033 can run alongside US3. Phases 4 and 5 are otherwise independent.
- Phase 6 needs all stories.

## Parallel examples

- Phase 2: T006, T007 and T008 at once (separate storefront files).
- Phase 3: T014 and T015 at once while T010 to T012 are built in the server.
- Phase 5: T027 (server) and T033 (admin) at once.

## Implementation strategy

1. Phases 1 and 2, then Phase 3 as the MVP and stop for a real purchase test with a Stripe test card.
2. Phase 4 (messages), then Phase 5 (editing and note), each verified in the browser before the next.
3. Phase 6 polish and the held-over spec 001 checks. Commit per repo after each phase; do not push without asking.

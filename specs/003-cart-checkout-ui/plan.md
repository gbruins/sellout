# Implementation Plan: Cart and Checkout Screens

**Branch**: `003-cart-checkout-ui` | **Date**: 2026-10-17 | **Spec**: [spec.md](./spec.md)

## Summary

The storefront gets a cart: the menu's Order now button adds a pizza, a header indicator
links to a `/cart` page where quantities, removal and a customer note are edited, and Pay
sends the customer to Stripe Checkout. The page handles the locked (payment in progress)
state, the cancel return, refusals (closed, sold out, limit, unavailable pizza) and the
cart reset notice. The server already has the cart, item and checkout routes; it needs
four small additions: a customer note, a `checkout_in_progress` flag on the cart (true
only while the Stripe session is live), a re-usable open payment session, created
atomically per cart, so double taps and "Continue to payment" never create a second
session, and a machine-readable "item unavailable" refusal. The admin cart view
shows the customer note.

## Technical Context

**Language/Version**: Vue 3 + TypeScript, Pinia, vue-router, Tailwind (storefront); Node ESM, Hapi, Knex, Joi (server); Vue + figleaf (admin).

**Primary Dependencies**: Existing only. No new packages.

**Storage**: PostgreSQL. One migration: `carts.customer_note` (nullable text, max 500 enforced by Joi).

**Testing**: Storefront: Vitest unit tests for the cart store, error mapping and the cart page, plus browser verification with a Stripe test card. Server: `scripts/checkCart.js` against a throwaway server using `TMPTEST` data (lab tests are broken). Admin: `vite build` plus a browser check.

**Project Type**: Web application across three repositories.

**Constraints**: The store key is a public client; cart access uses the per-cart token (`x-cart-token`). The storefront never computes money or stock. Cart responses to the store hide admin-only fields.

**Scale/Scope**: One cart per browser; a handful of lines per cart.

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Server owns the truth | Pass | Totals, prices and availability come from the server. Cart responses use current product prices; checkout charges database prices as before. |
| II. Least-privilege store access | Pass | Store callers only reach their own cart via the token. The new note route uses the same cart access check. `admin_order_notes` stays hidden from the store; the customer note is separate. |
| III. Cards only, Stripe-hosted | Pass | The storefront only redirects to the Stripe URL. A cart with an open session still rejects edits; the note route follows the same rule. Reusing an open session never creates a second payable session. |
| IV. Pickup only | Pass | No address fields; the cart page states pickup. |
| V. UTC / Los Angeles | Pass | No new dates are displayed. |
| VI. Verify before done | Pass | See quickstart. |
| VII. Specs span repos | Pass | Per-repo list below. |

Re-check after design: no violations.

## Project Structure

```text
specs/003-cart-checkout-ui/
├── plan.md  research.md  data-model.md  quickstart.md
├── contracts/cart-api.md
├── checklists/requirements.md
└── tasks.md              # created by /speckit-tasks
```

### Source Code (three repositories)

```text
strawberry-server/
├── server/db/migrations/100_cart_customer_note.js   # NEW: carts.customer_note
├── server/plugins/cart/
│   ├── CartModel.js           # customer_note (max 500)
│   ├── CartController.js      # customer note handler
│   ├── CartItemService.js     # cart lines use the current product price and title
│   ├── CartController.js      # checkout_in_progress on GET (live session check)
│   ├── CheckoutService.js     # reuse open session; 409 item_unavailable refusal
│   └── index.js               # PUT /cart/customer_note
└── scripts/checkCart.js       # NEW: live verification

strawberry-admin/src/components/cart/CartDetailNotesCard.vue   # show the customer note

selloutPizza/src/
├── api/cart.js                 # + setCustomerNote, cancelCheckout
├── stores/cart.ts              # NEW: cart state, busy flags, actions, error message
├── utils/cartErrors.ts         # + item_unavailable
├── components/CartIndicator.vue    # NEW: header count linking to /cart
├── components/CartLine.vue         # NEW: one line with plus, minus, remove
├── pages/CartView.vue              # NEW: lines, total, note, Pay, locked state, messages
├── pages/HomeView.vue              # wire PizzaList order event to the cart store
├── components/AppHeader.vue        # add the indicator
├── router/index.ts                 # + /cart
└── pages/OrderCompleteView.vue     # reset the cart store as well as the credentials
```

## Delivery Slices

1. **Server additions**: migration, note route, `checkout_in_progress`, current-price lines, session reuse, `item_unavailable`, `checkCart.js`.
2. **Storefront add and view**: cart store, Order now wiring, indicator, cart page with totals (User Story 1 up to Pay).
3. **Storefront pay and states**: Pay redirect, locked state, cancel return, refusals, reset notice, thank-you (User Stories 1 and 3).
4. **Editing and note**: plus/minus/remove, note, limits (User Story 2), admin note display.
5. **Polish**: unit tests, README, Stripe test-card browser run, phone-width check.

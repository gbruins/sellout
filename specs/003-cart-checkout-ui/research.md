# Research: Cart and Checkout Screens

## R1. Cart as a page
- **Decision**: Route `/cart`, linked from a header indicator.
- **Rationale**: The server already sends Stripe's cancel return to `/cart?checkout=cancelled`, so a page needs no server change. Back and reload behave.
- **Alternatives**: Slide-out panel (cancel return would need a different landing); both (extra work).

## R2. Where cart state lives
- **Decision**: A Pinia `cart` store fetches the cart from the server (`GET /cart`) and replaces its state with each response. Credentials stay in `cartCredentials.js` (localStorage).
- **Rationale**: Constitution I: totals and counts come from the server. A 404 already clears credentials in the API client.
- **Alternatives**: Local cart merged on checkout (violates "server owns the truth").

## R3. Creating the cart
- **Decision**: On first Order now, create a cart (`POST /cart`), then add the item. If a cart exists, add to it. The server assigns the service when the first item is added and enforces open service, limit and stock.
- **Rationale**: Reuses the existing API; no sign-in.

## R4. Price shown in the cart
- **Decision**: The server builds cart lines with the current product price and title, not the stored snapshot.
- **Rationale**: The spec says the cart shows current prices, and checkout already charges database prices; without this the cart total could differ from the amount charged. The deferred "snapshot drift" item is closed for display only.
- **Alternatives**: Leave the snapshot (visible mismatch); re-snapshot on read (writes on GET).

## R5. Payment in progress and "Continue to payment"
- **Decision**: Add `checkout_in_progress` to the cart response (true while an unexpired hold exists). Make `POST /cart/checkout` idempotent: if the cart has an open Stripe session, return its URL instead of expiring it and creating another. Cancel payment uses the existing `POST /cart/checkout/cancel`.
- **Rationale**: Today a second Pay expires the first session and creates a new one, which also re-reserves stock. Reuse makes double taps and Continue safe (SC-004) and never leaves two payable sessions (Constitution III). The cart is locked during checkout, so its contents cannot differ from the session's. Creation is serialized per cart (row lock or conditional update) so two simultaneous requests cannot both create a session.
- **Flag source**: `checkout_in_progress` is computed from the live session status (`isCheckoutInProgress`), not `checkout_expires_at`, because the stock hold deliberately outlasts the session.
- **Alternatives**: Store the session URL on the cart (extra column, URL is a bearer link); always create a new session (more Stripe calls, churn on stock hold).

## R6. Unavailable pizza refusal
- **Decision**: Checkout answers 409 with `data: { code: 'item_unavailable', product_id, title }` when a line is no longer sold, replacing the plain 400 message. Other failures keep their current shape.
- **Rationale**: The cart page can highlight the exact line and offer Remove, using the same `code` mapping as the other 409 refusals in `cartErrors.ts`.
- **Alternatives**: Parse the message text (fragile).

## R7. Customer note
- **Decision**: New nullable `carts.customer_note`, max 500 characters, via `PUT /cart/customer_note` (same cart-access check, refused during checkout). It is returned to the store. The admin cart view shows it read-only next to the admin note.
- **Rationale**: The existing `admin_order_notes` is admin-only by design (hidden from the store), so it cannot be reused.
- **Alternatives**: Put the note in Stripe metadata only (lost from the admin view).

## R8. Repeat taps and busy state
- **Decision**: The cart store keeps a `busy` flag per action; actions return early while busy, and buttons are disabled with a visible in-progress label.
- **Rationale**: FR-017. Combined with R5 this gives exactly one session or one added pizza.

## R9. After payment
- **Decision**: The existing thank-you page forgets the stored cart on mount. The cart store resets with it.
- **Rationale**: Already built; extend with a test that the indicator shows zero afterwards.

## R10. Testing
- **Decision**: Vitest for the store, error mapping and cart page with a stubbed `$api`; a server curl script for the new rules; browser run with Stripe test card `4242 4242 4242 4242`.
- **Rationale**: Constitution VI; matches how 001 and 002 were verified.

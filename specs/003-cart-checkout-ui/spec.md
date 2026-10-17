# Feature Specification: Cart and Checkout Screens

**Feature Branch**: `003-cart-checkout-ui`

**Created**: 2026-10-17

**Status**: Draft

**Input**: User description: "As a customer, I want to add pizzas from the menu to a cart, review and change my order, and pay by card, so I can buy pizza during a service. Today the menu shows an Order now button that does nothing, and the cart and payment work only exists on the server."

## Clarifications

### Session 2026-10-17

- Q: Should the cart be its own page or a slide-out panel? → A: Its own page at `/cart`; the menu shows a cart indicator that links to it.
- Q: Can quantities be changed and pizzas removed on the cart page? → A: Yes, plus and minus buttons and a remove button on the cart page.
- Q: Is the kitchen note in this version? → A: Yes. It is a customer note, separate from the admin's note on a cart, so it needs a new server field and must be shown to the manager in the admin cart view.
- Q: What does the customer see when they return to a cart whose payment is still open? → A: A locked cart with a "Payment in progress" message and two buttons: Continue to payment and Cancel payment (which unlocks the cart for editing).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add pizzas and pay (Priority: P1)

A visitor sees the open menu, taps Order now on a pizza, and it goes into their cart. They open the cart, see their pizzas and the total, and press Pay. They are taken to the card payment page, pay, come back to a thank-you page, and the cart is empty.

**Why this priority**: This is the whole point of the shop. Spec 001 shows the menu and spec 002 lets the manager build it, but nobody can buy anything yet.

**Independent Test**: With a service open, add two different pizzas, open the cart, pay with a Stripe test card, and confirm the thank-you page shows and the admin lists a paid cart with those pizzas.

**Acceptance Scenarios**:

1. **Given** an open service and an empty cart, **When** the visitor taps Order now on a pizza, **Then** the cart holds one of that pizza and a cart indicator shows the count.
2. **Given** a cart with pizzas, **When** the visitor opens the cart, **Then** each pizza is listed with its title, price, quantity and line total, and the order total is shown.
3. **Given** a cart with pizzas, **When** the visitor presses Pay on the cart page, **Then** they are sent to the card payment page for exactly that order.
4. **Given** a successful payment, **When** the visitor returns to the shop, **Then** they see the thank-you page, and the cart is empty.
5. **Given** a visitor who has never ordered before, **When** they add their first pizza, **Then** no sign-in or account is needed.

---

### User Story 2 - Change the order before paying (Priority: P2)

In the cart page the visitor can raise or lower the quantity of a pizza with plus and minus buttons, remove it, and add a note for the kitchen that the manager sees in the admin. They can keep browsing the menu and come back to the cart without losing anything, even after closing the browser.

**Why this priority**: Customers make mistakes and change their minds. Without this they would have to abandon the cart.

**Independent Test**: Add a pizza, raise its quantity to 3, remove another pizza, close and reopen the page, and confirm the cart still shows 3 of the first pizza.

**Acceptance Scenarios**:

1. **Given** a pizza in the cart, **When** the visitor changes its quantity, **Then** the line total and order total update.
2. **Given** a pizza in the cart, **When** the visitor removes it, **Then** it disappears and the totals update. If it was the last pizza the cart shows as empty with a link back to the menu.
3. **Given** a cart, **When** the visitor closes the browser and returns later the same day, **Then** the cart is still there.
4. **Given** a payment is in progress, **When** the visitor opens the cart, **Then** it is locked and offers Continue to payment and Cancel payment.
5. **Given** the visitor is at the per-order limit or the remaining count, **When** they try to add or raise a quantity beyond it, **Then** they are told the most they can order and the cart is unchanged.

---

### User Story 3 - Clear, honest messages when something changes (Priority: P2)

The shop can change while the visitor shops: it can sell out, close, or the manager can take a pizza off the menu. The visitor is told what happened in plain words and what they can do next, and is never charged for something unavailable.

**Why this priority**: Pizza supply is limited and the manager edits menus live. These situations will happen on every busy night.

**Independent Test**: With a pizza in the cart, remove that pizza from the service's menu in the admin, press Pay, and confirm the visitor sees that the pizza is no longer available and can remove it and continue.

**Acceptance Scenarios**:

1. **Given** a pizza in the cart that is no longer on the menu, **When** the visitor presses Pay, **Then** they see `"<pizza>" is no longer available`, are not sent to payment, and can remove that pizza.
2. **Given** the service has ended or sold out, **When** the visitor tries to add a pizza or pay, **Then** they see that the shop is closed or sold out, and nothing is charged.
3. **Given** the visitor's cart was emptied because its service ended, **When** they next open the shop, **Then** they are told the cart was reset and why, once, with a way to dismiss the message.
4. **Given** the visitor backs out of the card payment page, **When** they return to the shop, **Then** their cart is intact and they are told the payment was cancelled.
5. **Given** a network or server error, **When** the visitor adds, changes or pays, **Then** they see a friendly message with a way to try again and nothing is lost.

---

### Edge Cases

- A visitor opens the cart in two tabs and changes it in both. The most recent change wins and each tab shows what the server holds.
- The visitor presses Pay twice quickly. Only one payment session is created, and they are sent to the same page.
- The visitor returns from the payment page by pressing the browser's Back button after paying. They must not be able to pay for the same cart again and see the thank-you page or an empty cart.
- The visitor has a cart from a previous service. It is handled as in spec 001's cart reset rule and the visitor is told.
- The cart token is lost or the server no longer has the cart. The visitor gets a fresh empty cart without an error screen.
- A pizza's price changes while it is in the cart. The cart shows the current price, and the total on the payment page is the one the server computed.
- The remaining count drops below the quantity in the cart. The visitor is told how many they can still order when they try to pay.
- The visitor is on a small phone screen. The cart and its buttons remain usable with one hand.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Order now button on each menu pizza MUST add one of that pizza to the visitor's cart. A cart MUST be created automatically on the first add, with no sign-in.
- **FR-002**: Adding a pizza that is already in the cart MUST raise its quantity instead of creating a second line.
- **FR-003**: The storefront MUST show a cart indicator with the total number of pizzas on every page, and it MUST open the cart page at `/cart`.
- **FR-004**: The cart screen MUST list each pizza with its title, unit price, quantity and line total, and show the order total as computed by the server.
- **FR-005**: The visitor MUST be able to change a pizza's quantity, remove a pizza, using plus, minus and remove buttons on the cart page, and add or edit a customer note for the kitchen (up to 500 characters), until payment begins.
- **FR-006**: The cart MUST persist across page reloads and browser restarts on the same device, until the order is paid, the cart is reset, or it no longer exists on the server.
- **FR-007**: The visitor MUST be able to start card payment from the cart. The storefront MUST send them to the payment page the server provides and MUST NOT collect or handle card details itself.
- **FR-008**: The cart MUST NOT be editable while a payment is in progress. Opening the cart then MUST show it locked with a "Payment in progress" message and two buttons: Continue to payment (back to the same payment page) and Cancel payment (which unlocks the cart for editing).
- **FR-019**: The customer note MUST be stored with the cart by the server, kept separate from the admin's own cart note, and shown to the manager in the admin cart view. The storefront MUST only read and write the customer note, never the admin note.
- **FR-009**: After successful payment the visitor MUST see the thank-you page and the stored cart MUST be forgotten so the next order starts empty.
- **FR-010**: If the visitor cancels on the payment page, they MUST return to the cart with their items intact and a message that payment was cancelled.
- **FR-011**: If checkout is refused because a pizza is no longer available, the message MUST name the pizza (`"<pizza>" is no longer available`), the visitor MUST NOT be sent to payment, and they MUST be able to remove that pizza and try again.
- **FR-012**: The storefront MUST show a plain-language message for each refusal the server reports: shop closed, sold out, the per-order limit, the remaining count, and an unavailable pizza. It MUST show a retryable message for network and server errors.
- **FR-013**: The storefront MUST NOT compute prices, totals, tax or stock itself. Everything the visitor is charged or told about availability comes from the server.
- **FR-014**: Adding, changing and paying MUST be disabled while the shop is closed, upcoming or sold out, with a clear reason shown, consistent with the open and sold-out states from spec 001.
- **FR-015**: The cart reset notice from spec 001 (FR-016) MUST appear on the cart and the menu when a cart was emptied because its service ended.
- **FR-016**: The cart and thank-you screens MUST be usable on a phone-sized screen and with a keyboard, and every button MUST have a visible label.
- **FR-017**: Each add, change, remove and pay action MUST show that it is in progress and MUST ignore repeated taps until it finishes, so one tap never creates duplicate lines or payment sessions.
- **FR-018**: Prices MUST be shown in US dollars, and the pickup-only nature of the shop MUST be clear on the cart screen (no delivery address is asked for).

### Key Entities *(include if feature involves data)*

- **Cart**: The visitor's pending order for one service. It holds pizzas with quantities, an optional kitchen note, and a state (editing, payment in progress, paid). It is held by the server; the visitor's device only keeps a way to reach it.
- **Cart line**: One pizza in the cart with a quantity, its current price, and a line total.
- **Order total**: The amount the visitor will be charged, computed by the server.
- **Checkout message**: A plain-language statement about why something cannot proceed and what the visitor can do next.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time visitor can go from the menu to the card payment page with two pizzas in under 60 seconds, with no sign-in.
- **SC-002**: After a paid order, 100% of visitors who return to the shop see an empty cart.
- **SC-003**: 100% of refused checkouts (closed, sold out, limit, unavailable pizza) show a message that names the cause, and none sends the visitor to the payment page.
- **SC-004**: Tapping Pay or Order now repeatedly within a second creates exactly one payment session or one added pizza.
- **SC-005**: A visitor who closes and reopens the browser finds the same cart in 100% of cases while its service is still current.
- **SC-006**: Every change in the cart (add, change quantity, remove) is reflected on screen within 1 second on a normal connection.
- **SC-007**: The cart and thank-you screens have no horizontal scrolling and all buttons are reachable on a 360 px wide screen.

## Assumptions

- The server's cart, checkout and payment features from specs 001 and 002 are complete and are used unchanged. Where a gap is found (for example a missing response detail), a small server change is in scope.
- Payment, receipts and customer contact details are handled by Stripe Checkout. The storefront does not ask for a name, email, phone or address in this version.
- Order confirmation emails, order history, accounts, discount codes and tips are out of scope (see the deferred list).
- The server and admin changes for the customer note (FR-019) are in scope for this spec.
- Pickup is the only fulfilment option, per the constitution. Pickup time and place are shown as already provided by the service information.
- Only one cart exists per device at a time. A visitor who clears their browser data loses access to their cart.
- The kitchen note is edited only before payment starts. Its 500-character limit is an assumed default.
- The existing `Order now` hand-off in the menu, the cart reset notice and the thank-you page are reused and extended.
- Verification follows the constitution: each story is tested in a real browser against the running server and a Stripe test card.

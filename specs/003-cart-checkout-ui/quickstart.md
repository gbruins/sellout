# Quickstart: Cart and Checkout validation

Prerequisites: dev DB migrated (`npm run knex:migrate` in the server repo); throwaway server recipe from the 001 quickstart; Stripe test keys in the server `.env`; `STOREFRONT_URL` set to the storefront origin; storefront dev server running. Test data uses a `TMPTEST` prefix and is removed afterward.

1. **Server rules**: `node --require dotenv/config scripts/checkCart.js` (see [contract](./contracts/cart-api.md)):
   - cart read shows the current product price after the price is changed;
   - `PUT /cart/customer_note` saves, rejects over 500 characters, and is refused during checkout;
   - `checkout_in_progress` is true after checkout and false after cancel;
   - a second `POST /cart/checkout` returns the same URL;
   - an item taken off the menu gives `409 item_unavailable` with the title and product id;
   - a store caller cannot read or write another cart's note.
2. **Unit tests**: `npm run test:unit -- --run` in the storefront passes, including the cart store, error mapping and cart page.
3. **Add and view (US1)**: with a service open, tap Order now twice on one pizza and once on another. The header shows 3; `/cart` lists 2 lines with the server's totals.
4. **Pay (US1)**: press Pay, pay with `4242 4242 4242 4242`, and land on the thank-you page. The header shows 0 and the admin lists the paid cart with its customer note.
5. **Edit (US2)**: plus, minus and remove update lines and totals; reload and restart the browser keep the cart; adding beyond the limit shows the limit message and changes nothing.
6. **Locked (US3)**: press Pay, press Back, open `/cart`: it is locked with Continue to payment and Cancel payment. Cancel unlocks it; Continue returns to the same Stripe page.
7. **Cancel return (US3)**: cancel on the Stripe page; `/cart?checkout=cancelled` shows "Payment cancelled" and the cart is intact.
8. **Refusals (US3)**: take a pizza off the menu in the admin, press Pay; the message names the pizza, nothing is sent to Stripe, and Remove lets you continue. Close or sell out the service and confirm Order now and Pay are disabled with the reason.
9. **Double tap**: tap Order now and Pay quickly several times; exactly one pizza is added and one session exists.
10. **Phone width**: at 360 px the cart and thank-you pages have no horizontal scroll.
11. **Admin**: `vite build` passes and the customer note shows on the cart detail page.
12. Clean up all `TMPTEST` rows and carts created for the run.

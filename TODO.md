# Deferred items

From spec `001-next-service-display`:

- **Order confirmation emails** (Postmark key is already in the server `.env`).
- **Cart price snapshot drift**: closed for display (`GET /cart` returns current prices); the stored `cart_items.product` snapshot itself is still not updated.
- **Double-payment refund path**: a second payment for an already-paid cart is only logged as "refund required".
- **Stripe Tax**: enable and configure (`STRIPE_AUTOMATIC_TAX`).
- **`trustProxy`**: configure for the real hosting setup so the per-IP stream cap sees client IPs.
- **Environment**: set `STOREFRONT_URL` and `STRIPE_WEBHOOK_SECRET`, register the `checkout.session.completed` webhook, and point the storefront and admin `VITE_API_BASE_URL` at `https://strawberry.local:10000/api/v1`.
- **Scaling**: the SSE hub is in-process; multi-instance needs `LISTEN/NOTIFY`.

Follow-up specs:

- `002-menu-management`: built (server, admin). Left: live stream check (T017).
- `003-cart-checkout-ui`: built (server, storefront, admin note display). Left: Back-after-paying check (T034) and the spec 001 hold-overs (T039).

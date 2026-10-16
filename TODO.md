# Deferred items

From spec `001-next-service-display`:

- **Order confirmation emails** (Postmark key is already in the server `.env`).
- **Cart price snapshot drift**: `cart_items.product` is a snapshot, so a later price change is not reflected.
- **Double-payment refund path**: a second payment for an already-paid cart is only logged as "refund required".
- **Stripe Tax**: enable and configure (`STRIPE_AUTOMATIC_TAX`).
- **`trustProxy`**: configure for the real hosting setup so the per-IP stream cap sees client IPs.
- **Environment**: set `STOREFRONT_URL` and `STRIPE_WEBHOOK_SECRET`, register the `checkout.session.completed` webhook, and point the storefront and admin `VITE_API_BASE_URL` at `https://strawberry.local:10000/api/v1`.
- **Scaling**: the SSE hub is in-process; multi-instance needs `LISTEN/NOTIFY`.

Follow-up specs:

- `002-menu-management`: admin menu and product screens.
- `003-cart-checkout-ui`: storefront cart and checkout screens.

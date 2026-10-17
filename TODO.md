# Deferred items

From spec `001-next-service-display`:

- **Order confirmation emails** (Postmark key is already in the server `.env`).
- **Cart price snapshot drift**: closed for display (`GET /cart` returns current prices); the stored `cart_items.product` snapshot itself is still not updated.
- **Double-payment refund path**: a second payment for an already-paid cart is only logged as "refund required".
- **Stripe Tax**: enable and configure (`STRIPE_AUTOMATIC_TAX`).
- **Render deploy**: `render.yaml` is ready (see the server README). Still to do: create the Blueprint, set secrets and domains, then confirm `TRUSTED_PROXY_HOPS` (default `1` is a guess) and stream buffering (T056).
- **Environment**: set `STOREFRONT_URL` and `STRIPE_WEBHOOK_SECRET`, register the `checkout.session.completed` webhook, and point the storefront and admin `VITE_API_BASE_URL` at `https://strawberry.local:10000/api/v1`.
- **Scaling**: the SSE hub is in-process; multi-instance needs `LISTEN/NOTIFY`.

Follow-up specs:

- `002-menu-management`: built (server, admin). Fully verified.
- `003-cart-checkout-ui`: built (server, storefront, admin note display). Verified in the browser.

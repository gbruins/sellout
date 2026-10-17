# Contract: Cart API (changes for spec 003)

All routes are under `/api/v1`. The storefront sends the store key and `x-cart-token`. Only changes and the parts the storefront relies on are listed; other cart routes are unchanged.

## GET /cart?id=

Store and admin. Response `data` (store view omits `admin_order_notes`):

```json
{
  "id": "uuid", "service_id": "uuid|null", "closed_at": null,
  "num_items": 3, "price_subtotal": 4200, "sales_tax": null, "grand_total": 4200,
  "customer_note": "no olives",
  "checkout_in_progress": false,
  "cart_reset": "service_ended",
  "cart_items": [
    { "id": "uuid", "qty": 2, "price_subtotal": 2800,
      "product": { "id": "uuid", "title": "Margherita", "base_price": 1400 } }
  ]
}
```

- Amounts are integer cents. `product.title` and `base_price` are current values.
- `cart_reset` appears once, when the cart was emptied because its service ended.
- `checkout_in_progress` (NEW) is true while an unexpired checkout hold exists.

## POST /cart/item, PUT /cart/item, DELETE /cart/item

Unchanged shapes. Refusals are 409 with `data.code` of `no_open_service`, `sold_out` or `over_limit` (with `max_per_order`, `remaining`). A locked cart refuses with the existing checkout-in-progress error.

## PUT /cart/customer_note (NEW)

Store and admin. Same cart access as item edits; refused while a checkout is in progress.

Request: `{ "id": "uuid", "customer_note": "string up to 500 chars, or null" }`
Response: the cart as for GET. `400` if over 500 characters.

## POST /cart/checkout (CHANGED)

Request: `{ "id": "uuid" }`. Response: `{ "data": { "url": "https://checkout.stripe.com/..." } }`.

Changes:
- If the cart already has an open Stripe session, its URL is returned and no new session is created.
- A line that is no longer sold now yields `409` with `data: { "code": "item_unavailable", "product_id": "uuid", "title": "Margherita" }` and `message: "\"Margherita\" is no longer available"`.
- Other refusals are unchanged: `no_open_service`, `sold_out`, `over_limit`; `400` for an empty or closed cart.

## POST /cart/checkout/cancel

Unchanged: `{ "id": "uuid" }` → `{ "data": { "status": "cancelled" | "none" | "complete" } }`. `complete` means payment already succeeded.

## Admin

The admin `GET /cart` returns `customer_note` and `admin_order_notes`. The admin cart detail page shows the customer note read-only above the admin note field.

## Storefront URLs

- `/cart` the cart page.
- `/cart?checkout=cancelled` return from Stripe after cancel; shows "Payment cancelled" and keeps the cart.
- `/order/complete?session_id=...` thank-you page (existing).

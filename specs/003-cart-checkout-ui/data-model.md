# Data Model: Cart and Checkout Screens

## Cart (existing table `carts`, one new column)

| Field | Type | Notes |
|-------|------|-------|
| `customer_note` | text, nullable, max 500 | NEW. Written by the customer before payment; shown in the admin cart view. Separate from `admin_order_notes`. |
| `checkout_in_progress` | boolean (virtual) | NEW in responses. True while `checkout_expires_at` is in the future and the cart is not closed. Not stored. |

Unchanged and used as-is: `id`, `service_id`, `closed_at`, `stripe_order_id`, `checkout_expires_at`, `num_items`, `price_subtotal`, `sales_tax`, `grand_total`, `cart_items`, `cart_reset` (one-time, store only).

## Cart line (existing `cart_items`)

`id`, `cart_id`, `qty`, `product` (snapshot), plus virtual `price_subtotal`. Change: when a cart is read, `product.base_price` and `product.title` come from the current product row so the displayed total equals what checkout charges.

## Storefront cart state (not persisted beyond the credentials)

| State | Meaning |
|-------|---------|
| `cart` | Last cart from the server, or null |
| `busy` | Which action is running (`add`, `update`, `remove`, `note`, `pay`, `cancel`), or none |
| `error` | Customer-facing message for the last failed action |
| `unavailableProductId` | Product to highlight after an `item_unavailable` refusal |
| `locked` | Derived: `cart.checkout_in_progress` |

## Cart states

`empty` (no lines) → `editing` (has lines) → `payment in progress` (locked) → `paid` (closed; credentials forgotten).
`payment in progress` → `editing` via Cancel payment, via the Stripe cancel return, or when the hold expires.
`editing` or `payment in progress` → `reset` (service ended): emptied, notice shown once.

## Validation

- Quantity: integer ≥ 1 from the cart page (0 is a remove). The server enforces per-order limit and remaining stock.
- Customer note: trimmed, 0–500 characters; empty clears it.

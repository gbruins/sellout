# Data Model: Next Service Display

## Changes to existing tables

### `service`

| Column | Type | Notes |
|--------|------|-------|
| `max_per_order` | integer, not null, default 4 | New. Per-order pizza cap (FR-006c). Minimum 1. |

Existing: `id`, `start_at`, `end_at`, `notes`, `inventory_count`, `service_menu_id`,
`created_at`, `updated_at`. All timestamps are `timestamptz` (UTC).

### `carts`

| Column | Type | Notes |
|--------|------|-------|
| `service_id` | uuid, nullable, FK to `service.id` | New. Set when the first item is added during an open service. Cleared when the cart is reset. |
| `checkout_expires_at` | timestamptz, nullable | New. Set when a checkout starts, then moved to the Stripe session's `expires_at` plus a 60-second margin once the session exists. Cleared on cancel. While in the future and the cart is not closed, the cart's pizzas are held. Authoritative for counting holds. |

Existing relevant columns: `closed_at`, `stripe_order_id`, `token_hash`.

Index: `carts (service_id)` for the remaining-count query.

## Derived values (not stored)

```text
paid_qty      = SUM(cart_items.qty) of PIZZA items (product type slug 'pizza') for carts with service_id = S and closed_at IS NOT NULL
held_qty      = SUM(cart_items.qty) of PIZZA items for carts with service_id = S and closed_at IS NULL
                and checkout_expires_at > now()       (excluding the cart being checked out)
remaining     = GREATEST(0, service.inventory_count - paid_qty - held_qty)
status        = none | upcoming | open | sold_out
```

## Relationships

- Service 1 to 1 Service Menu (`service.service_menu_id`).
- Service Menu many to many Product through `service_menu_products`.
- Service 1 to many Cart (`carts.service_id`).
- Cart 1 to many Cart Item.

## State transitions

**Cart hold**: `none` to `held` (checkout started) to `paid` (webhook closes the cart) or
`released` (cancel, or `checkout_expires_at` passes).

**Cart and service**: a cart with `service_id = S` is reset (items removed,
`service_id` cleared, `cart_reset` notice returned) when `S.end_at <= now` and the cart has
no live hold and is not closed (FR-016).

**Service state**: derived from time and remaining count only; nothing is stored.

## Validation rules

- `max_per_order` is an integer of at least 1 (admin form and server Joi). The effective cap is `min(max_per_order, remaining)`.
- Pizza quantity in the cart after adding must not exceed the effective cap. Non-pizza items are not limited by it.
- Checkout must start while `start_at <= now < end_at`.

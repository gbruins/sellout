# Data Model: Menu Management

## service_menus (existing)
`id`, `title`, `description`, `published`, `deleted_at`, timestamps. No change. Title required; rule: a menu may be published with zero products (it shows the empty state).

## service_menu_products (existing junction)
| Column | Type | Notes |
|--------|------|-------|
| service_menu_id | uuid | FK, cascade |
| product_id | uuid | FK, cascade |
| **ordinal** | integer, nullable | NEW. 1-based position. NULL sorts last, then by product title |

Primary key `(service_menu_id, product_id)` stays: a product appears at most once per menu.

## Derived
- **product_count** per menu (list view).
- **Menu usage**: services where `service_menu_id = menu.id` and `end_at > now()`.
- **Visible menu (store key)**: `published = true AND deleted_at IS NULL`; products `published = true AND deleted_at IS NULL`.

## State transitions
- Menu: draft ⇄ published; any state → deleted (soft).
- Product on menu: absent → present (appended last) → reordered → absent.

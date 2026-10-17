# Contract: Menu API

Base: `/api/v1`. "Admin" = admin cookie. "Store" = store Basic key.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/service_menus` | Admin, Store | Search. Store sees published only. Adds `product_count`. |
| GET | `/service_menu` | Admin, Store | One menu. Store: published only, else 404. |
| POST / PUT / DELETE | `/service_menu` | Admin | Existing CRUD. |
| GET | `/service_menu/{id}/products` | Admin, Store | Ordered products. Store: published menu and published products only. |
| PUT | `/service_menu/{id}/products` | Admin | Body `{ "product_ids": [uuid, ...] }`. Replaces membership and order. 200 with the ordered list. Unknown product → 400. |
| GET | `/service_menu/{id}/usage` | Admin | `{ "services": [{ "id", "start_at", "end_at" }] }` for open or upcoming services using the menu. |

## Behaviour changes
- `GET /services/next` menu products are ordered by `ordinal` then title.
- Checkout fails with `"<title>" is no longer available` when a cart product is not on the service's published menu.
- Store-key requests never receive unpublished menus or products.

# Research: Menu Management

## R1. Ordering storage
- **Decision**: Add nullable `ordinal` integer to `service_menu_products`. Reads sort `ordinal NULLS LAST, title`. Move up/down swaps ordinals of neighbours inside a transaction after renumbering the menu 1..n.
- **Rationale**: Matches FR-003 (unordered products sort last, alphabetically) and keeps existing rows valid with no backfill needed. Renumbering on every move avoids gaps and ties.
- **Alternatives**: Float/fractional ordinals (drift); array column on the menu (breaks cascade deletes).

## R2. Move API shape
- **Decision**: `PUT /service_menu/{id}/products` replaces the whole ordered list of product IDs; plus `POST` and `DELETE` for single add/remove.
- **Rationale**: The admin sends the final order after a button press, so no server-side swap logic or races; one idempotent call.
- **Alternatives**: `/move` up/down endpoint (more round trips, ambiguous on concurrent edits).

## R3. Store-key filtering (FR-007)
- **Decision**: In the controller, when the caller authenticated by `apiKey`, force `published = true` and exclude deleted menus; products are filtered to published ones. Admin cookie sees everything.
- **Rationale**: Constitution II. Unpublished data never reaches store callers.
- **Alternatives**: Remove store access to menu routes entirely (the storefront only needs `/services/next`; this is acceptable but the user chose to keep read access).

## R4. Checkout membership check (FR-008a)
- **Decision**: In `CheckoutService`, after the published check, require a row in `service_menu_products` for the cart's service menu and the product, with the menu published and not deleted. Else throw `"<title>" is no longer available`.
- **Rationale**: Same message and path as the existing availability check, so spec 003 shows one kind of error.

## R4a. Cart items added earlier
- **Decision**: No change to add-to-cart; only checkout is enforced (per the clarification). Adding a product that is not on the menu is already a spec 001 concern and is left alone.

## R5. Live refresh (FR-009)
- **Decision**: Fold a menu fingerprint (menu id, published flag, product ids in order, product publish flags) into the existing 3-second change-detecting tick for the active service, and also call the stream hub directly after admin menu writes for immediate delivery.
- **Rationale**: Reuses the stream built in 001; no new infrastructure. Tick catches changes made by other means (for example product unpublish).

## R6. Delete with warning (FR-006)
- **Decision**: `GET /service_menu/{id}/usage` lists open or upcoming services using the menu. The admin shows the names, asks to confirm, then calls the existing `DELETE`. Deleting stays soft (`deleted_at`). Services keep a dangling `service_menu_id`, which state building already treats as "no menu".
- **Alternatives**: Server-side block (rejected by the user); null out `service_menu_id` (loses history).

## R7. List counts
- **Decision**: Extend the search response with `product_count` computed by a grouped query, avoiding N+1.

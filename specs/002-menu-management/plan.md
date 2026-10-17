# Implementation Plan: Menu Management

**Branch**: `002-menu-management` | **Date**: 2026-10-17 | **Spec**: [spec.md](./spec.md)

## Summary

Admins build menus (a titled set of pizzas in a chosen order), publish them, assign them
to services (already built in 001) and retire them. The server gains product add, remove
and reorder endpoints, an order column on the menu/product link, store-key filtering to
published menus, a menu-membership check at checkout (FR-008a), and a change trigger so
open storefronts refresh when a menu changes (FR-009). The admin gains a Menus screen with
a product picker, up/down buttons, publish toggle and a warn-then-allow delete.

## Technical Context

**Language/Version**: JavaScript (ESM, Node.js) server; Vue 3 + TypeScript/JS admin.

**Primary Dependencies**: Existing only: Hapi 21, Knex, Joi (server); Vue, Vuelidate,
figleaf components (admin). No new packages.

**Storage**: PostgreSQL. One migration: `service_menu_products.ordinal` (nullable integer).

**Testing**: Server: curl script `scripts/checkMenus.js` against the dev DB with `TMPTEST`
data (lab tests are broken). Admin: vite build plus browser check. Storefront: none
(no code change; message display belongs to spec 003).

**Project Type**: Web application across three repositories.

**Constraints**: Menu edits must reach open storefront pages through the existing
3-second change-detecting stream tick (no new push mechanism). Store key sees published
menus and products only.

**Scale/Scope**: A handful of menus, tens of products each.

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Server owns the truth | Pass | Checkout re-checks that each cart product is on the service's published menu; ordering is stored and applied on the server. |
| II. Least-privilege store access | Pass | Menu reads keep store access but are filtered to published menus and published products. All writes and the product-link routes are admin-cookie only. |
| III. Cards only, Stripe-hosted | Pass | No payment change; the new check runs before the Stripe session is created. |
| IV. Pickup only | Pass | Not touched. |
| V. UTC / Los Angeles | Pass | Any dates shown in the admin use the existing Los Angeles components. |
| VI. Verify before done | Pass | See quickstart. |
| VII. Specs span repos | Pass | Per-repo list below. |

Re-check after design: no violations.

## Project Structure

```text
specs/002-menu-management/
├── plan.md  research.md  data-model.md  quickstart.md
├── contracts/menu-api.md
├── checklists/requirements.md
└── tasks.md              # created by /speckit-tasks
```

### Source Code (three repositories)

```text
strawberry-server/
├── server/db/migrations/90_service_menu_product_order.js   # NEW: ordinal column (no backfill)
├── server/plugins/serviceMenus/
│   ├── ServiceMenuModel.js        # unchanged (filtering lives in the controller)
│   ├── ServiceMenuService.js      # product list/add/remove/move; usage lookup; list counts
│   ├── ServiceMenuController.js   # handlers for the new routes; published-only filter for store callers
│   └── index.js                   # new routes; write routes stay admin-only
├── server/plugins/service/
│   ├── ServiceState.js            # order by ordinal, then title; include menu changes in tick fingerprint
│   └── ServiceStream.js           # notify on menu change
├── server/plugins/cart/CheckoutService.js   # FR-008a menu-membership check
└── scripts/checkMenus.js          # NEW: live verification

strawberry-admin/src/
├── api/service_menu.js                       # + product and usage calls
├── pages/MenusPage.vue                       # NEW: list, counts, publish toggle, delete
├── components/menus/MenuUpsertModal.vue      # NEW: title, description, published
├── components/menus/MenuProductsModal.vue    # NEW: picker, up/down, remove
├── router/index.ts                           # + /menus
├── components/layouts/DefaultLayout.vue      # + nav link
└── locales/en-US.js                          # strings

selloutPizza/
└── (no code) spec 003 renders the "no longer available" checkout message
```

## Delivery Slices

1. **Server data and API**: migration, endpoints, store filtering, ordering in state.
2. **Server rules**: checkout membership check, stream refresh, `checkMenus.js`.
3. **Admin screens**: Menus page, editor, delete warning.
4. **Polish**: README note, admin build, browser check.

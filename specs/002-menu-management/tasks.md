---
description: "Task list for Menu Management"
---

# Tasks: Menu Management

**Input**: `/specs/002-menu-management/` (plan.md, spec.md, research.md, data-model.md, contracts/menu-api.md, quickstart.md)

**Tests**: Per Constitution VI, server behavior is verified by a live script (`scripts/checkMenus.js`) and the admin by build plus browser check. No unit-test tasks.

**Format**: `- [ ] T### [P?] [Story] Description with path`. Paths: `SRV` = `/Users/bruins/Sites/strawberry-server`, `ADM` = `/Users/bruins/Sites/strawberry-admin`, `STORE` = `/Users/bruins/Sites/selloutPizza`.

## Phase 1: Setup

- [ ] T001 Confirm the dev DB is migrated and note the current menu code in `SRV/server/plugins/serviceMenus/` (model table names, how `ServiceMenuController` reads `request.auth.strategy`)

## Phase 2: Foundational (blocks all stories)

- [ ] T002 Add migration (run only after the user approves touching the dev DB) `SRV/server/db/migrations/90_service_menu_product_order.js` adding nullable integer `ordinal` to `service_menu_products` (down drops it); run it
- [ ] T003 Add `ordinal` to the junction definition in `SRV/server/plugins/serviceMenus/ServiceMenuModel.js`
- [ ] T004 In `SRV/server/plugins/service/ServiceState.js` `fetchPublishedMenu`, order products by `smp.ordinal ASC NULLS LAST, p.title` (FR-003)

**Checkpoint**: migration applied; `/services/next` still returns the menu.

## Phase 3: User Story 1 - Build a menu and assign it to a service (P1) 🎯 MVP

**Goal**: A manager creates a menu, adds products in order, publishes it and assigns it to a service.
**Independent test**: Quickstart steps 1 and 6 (create, fill, reorder, publish, assign; storefront shows the order).

### Server
- [ ] T005 [US1] Add to `SRV/server/plugins/serviceMenus/ServiceMenuService.js`: `getProducts(menuId, {publishedOnly})` ordered by ordinal then title, and `setProducts(menuId, productIds)` that validates every ID exists and is not deleted, rejects duplicates, and renumbers ordinals 1..n in a transaction (FR-002, FR-003)
- [ ] T006 [US1] Add `GET` and `PUT /service_menu/{id}/products` handlers in `SRV/server/plugins/serviceMenus/ServiceMenuController.js` and register them in `index.js` (GET: `apiKey` + `adminCookie`; PUT: admin only), per `contracts/menu-api.md`
- [ ] T007 [US1] Add `product_count` and `services` (id, start_at, end_at of open or upcoming services using the menu) to the `/service_menus` search response in `ServiceMenuService.js` using grouped queries, no N+1 (FR-004)

### Admin
- [ ] T008 [P] [US1] Extend `ADM/src/api/service_menu.js` with `getProducts(id)` and `setProducts(id, productIds)` and register in `ADM/src/plugins/api.js` if needed; confirm the admin `GET /products` response includes each product's `published` flag
- [ ] T009 [P] [US1] Create `ADM/src/components/menus/MenuUpsertModal.vue` (title required, description, published toggle) following `ServiceUpsertModal.vue`; limit title to 255 and description to 2000 characters with a clear message (mirror in Joi in T005); warn, but allow, when another menu has the same title; when publishing a menu with no products, warn that visitors will see an empty menu and allow it
- [ ] T010 [US1] Create `ADM/src/components/menus/MenuProductsModal.vue`: product picker from existing products (hides ones already on the menu), remove button, an "unavailable" marker on products that are unpublished or deleted, move up and move down buttons, Save calls `setProducts` with the full ordered list
- [ ] T011 [US1] Create `ADM/src/pages/MenusPage.vue` (title, published, product count, services using it; create and edit; open products modal), add route `/menus` in `ADM/src/router/index.ts`, nav link in `ADM/src/components/layouts/DefaultLayout.vue`, strings in `ADM/src/locales/en-US.js`
- [ ] T012 [US1] Create `SRV/scripts/checkMenus.js` (TMPTEST data, cleaned in `finally`) covering: add three products and read back the order; move one; unordered product sorts last; duplicate and unknown IDs rejected; `/services/next` order matches

**Checkpoint**: US1 works end to end.

## Phase 4: User Story 2 - Edit, reorder and retire menus (P2)

**Goal**: Changes are safe and reach open pages; retiring warns first.
**Independent test**: Quickstart steps 4 and 5.

- [ ] T013 [US2] Add `GET /service_menu/{id}/usage` (admin only) in `ServiceMenuController.js`/`index.js`/`ServiceMenuService.js` returning services with `service_menu_id = id` and `end_at > now()` (FR-006)
- [ ] T014 [US2] Make the stream tick fingerprint in `SRV/server/plugins/service/ServiceState.js`/`ServiceStream.js` include menu id, published flag, ordered product IDs and product published flags, and notify the hub after `setProducts` and menu updates (FR-009)
- [ ] T015 [P] [US2] Add `usage(id)` to `ADM/src/api/service_menu.js`
- [ ] T016 [US2] In `MenusPage.vue`, before delete or unpublish of a menu, call `usage`; if services are returned, show their names (times in Los Angeles via `Format8601`, FR-010) and require confirmation, then proceed (never blocked)
- [ ] T017 [US2] Extend `checkMenus.js`: usage lists the service; delete still succeeds; opening `/services/next/stream` and changing the menu yields a new event within 3 seconds
- [ ] T018 [US2] Verify FR-005: after unpublishing a menu, reopening the Service modal in `ADM/src/components/services/ServiceUpsertModal.vue` no longer lists it; fix if it does
- [ ] T018a [US2] Verify `GET /services/next` returns `menu: null` for a deleted or unpublished menu (storefront shows "menu not available yet"); in `ADM/src/pages/ServicesPage.vue` flag services whose menu is unpublished or deleted (US2 AC3, AC4)

## Phase 5: User Story 3 - Prevent mistakes and exposure (P3)

**Goal**: Drafts never leak; checkout rejects items no longer offered.
**Independent test**: Quickstart steps 2 and 3.

- [ ] T019 [US3] In `ServiceMenuController.js` (search, get, products), when the caller used the `apiKey` strategy, restrict to `published = true` and `deleted_at IS NULL` menus (404 for others) and to published, non-deleted products (FR-007, Constitution II)
- [ ] T020 [US3] In `SRV/server/plugins/cart/CheckoutService.js`, after the published check (~line 175), require the product to be on the cart service's published, non-deleted menu; otherwise throw `"<title>" is no longer available` (FR-008a). Carts without a service keep the current behavior
- [ ] T021 [US3] Extend `checkMenus.js`: store key gets 404 for a draft menu and no draft products; admin sees both; a cart item removed from the menu fails checkout with the expected message

## Phase 6: Polish

- [ ] T022 [P] Add a "Menus" section (endpoints, store filtering, ordering) to `SRV/README.md`
- [ ] T023 [P] `vite build` and eslint on new admin files; fix issues in them only
- [ ] T024 Run `checkMenus.js` and `checkServiceState.js`; confirm no `TMPTEST` leftovers
- [ ] T025 Browser check of the Menus screen using a throwaway server and a self-signed `sbsession` cookie (admin route guard is already disabled locally); also time the SC-001 flow: create, add, reorder, publish, assign to a service, delete with warning
- [ ] T026 Update `STORE/TODO.md`: spec 003 must show the "no longer available" checkout message; mark `specs/002` progress
- [ ] T027 Confirm admin dates on the Menus screen use Los Angeles time (FR-010)

## Dependencies

- Phase 2 blocks everything. US1 server (T005–T007) blocks US1 admin (T010–T011).
- US2 and US3 depend on T005 but not on each other; T016 needs T013 and T015; T017 needs T013–T014; T021 needs T019–T020.
- Within US1, T008 and T009 can run in parallel.

## Implementation Strategy

MVP is Phases 1–3: a manager can build, order and assign a menu. Then US2 (safe retirement and live refresh), then US3 (exposure and checkout guard). Commit per phase in each repo; do not push without asking.

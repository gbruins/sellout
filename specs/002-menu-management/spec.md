# Feature Specification: Menu Management

**Feature Branch**: `002-menu-management`

**Created**: 2026-10-16

**Status**: Draft

**Input**: User description: "As the admin/store manager, I want to create and manage the menus that I assign to a service, and choose which products appear on each menu, without developer help. Today menus can only be created with SQL."

## Clarifications

### Session 2026-10-16

- Q: What happens when the manager deletes a menu used by an open or upcoming service? → A: Warn, naming the affected services, then allow it. Affected services show "menu not available yet" until a menu is assigned.
- Q: Is a "duplicate menu" action part of v1? → A: No. Services reference a menu by ID, so reuse covers repeat services; duplication is a later convenience.
- Q: What happens at checkout if a product in the cart was removed from the service's menu or unpublished? → A: Checkout is refused with a clear message naming the item, and the customer removes it. This extends the existing "no longer available" refusal for unpublished or deleted products to products not on the service's current menu.
- Q: Should the storefront key keep read access to menus? → A: Yes, but it only ever sees published menus (and their published products). Draft menus are admin-only.
- Q: How does the manager order products on a menu? → A: Move up and move down buttons. Products without an explicit order sort after ordered ones, alphabetically.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Build a menu and assign it to a service (Priority: P1)

The manager opens a Menus screen in the admin, creates a menu with a title and optional description, adds products to it from the product list, and publishes it. They then open a service, pick that menu, and the storefront shows those products during the service.

**Why this priority**: Spec 001 lets a manager assign an existing menu to a service, but menus can only be created by a developer. This removes that dependency and completes the "set up a service" workflow.

**Independent Test**: In the admin, create a menu, add two published products, publish it, assign it to an open service, and confirm both products appear on the storefront home page.

**Acceptance Scenarios**:

1. **Given** no menus exist, **When** the manager creates a menu with a title, **Then** it appears in the menu list as unpublished.
2. **Given** a menu, **When** the manager adds products to it and publishes it, **Then** the menu appears in the service form's menu choices.
3. **Given** a published menu assigned to an open service, **When** a visitor loads the home page, **Then** only the menu's published products are shown.
4. **Given** a menu with no products, **When** the manager publishes it, **Then** the manager is warned that visitors will see an empty menu, and can still proceed.

---

### User Story 2 - Edit, reorder and retire menus (Priority: P2)

The manager renames a menu, removes or adds products, changes the order products are shown in, unpublishes a menu, or deletes one that is no longer needed.

**Why this priority**: Menus change between services. It is needed soon after the first menu is built, but a manager can work without it at first.

**Independent Test**: Edit a menu in use by an upcoming service: remove a product and reorder the rest, then confirm the storefront shows the new content and order.

**Acceptance Scenarios**:

1. **Given** a menu with several products, **When** the manager changes their order and saves, **Then** the storefront shows them in that order.
2. **Given** a menu assigned to a service, **When** the manager removes a product, **Then** the storefront no longer shows it.
3. **Given** a menu assigned to a service, **When** the manager tries to delete it, **Then** they are told which services use it and must confirm, and affected services then show "menu not available yet".
4. **Given** a published menu, **When** the manager unpublishes it, **Then** visitors no longer see it, and services that use it are flagged in the admin.

---

### User Story 3 - Prevent mistakes and exposure (Priority: P3)

The manager can see at a glance which menus are published, how many products each has, and which services use each one. Menu data that is not published is never readable by the storefront.

**Why this priority**: Protects against accidentally serving the wrong menu and against leaking unreleased menus, but does not block the core workflow.

**Independent Test**: Request the menu list using the storefront's credentials and confirm unpublished menus are not returned.

**Acceptance Scenarios**:

1. **Given** an unpublished menu, **When** the storefront asks for menus, **Then** the unpublished menu is not returned.
2. **Given** the menu list, **When** the manager views it, **Then** each row shows title, published state, product count and the services using it.

---

### Edge Cases

- A customer has a product in the cart that the manager then removes from the menu: checkout is refused for that item until it is removed (FR-008a).
- A product on a menu is unpublished or deleted: it is not shown to visitors, and the menu editor marks it as unavailable.
- Two menus have the same title: allowed, and the manager is warned.
- The same product is added to a menu twice: prevented.
- A menu is edited while its service is open: changes apply to visitors within the live update window defined by spec 001, and the pizza count rules are unchanged.
- Changing a menu never changes the pizza inventory of a service, which stays on the service.
- A very long title or description: limited with a clear message.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The manager MUST be able to create, edit, publish, unpublish and delete menus in the admin, each with a title and optional description.
- **FR-002**: The manager MUST be able to add products to a menu and remove them, choosing from existing products, without adding the same product twice.
- **FR-003**: The manager MUST be able to set the order products appear in on a menu using move up and move down controls, and the storefront MUST show that order. Products without an explicit order sort after ordered ones, alphabetically.
- **FR-004**: The menu list MUST show each menu's title, published state, product count and the services that use it.
- **FR-005**: Only published menus MUST be offered when assigning a menu to a service.
- **FR-006**: Deleting or unpublishing a menu that a service uses MUST warn the manager, name the affected services, and then allow the manager to proceed. It is never blocked.
- **FR-007**: The storefront's credentials MAY read menus, but MUST only receive published menus and published products. Unpublished menus are readable only in an admin session.
- **FR-008**: Visitors MUST only see published products on a menu, as in spec 001.
- **FR-008a**: Checkout MUST be refused, naming the item, when a cart holds a product that is not on the service's current published menu or is no longer published. The server decides this, not the page.
- **FR-009**: Menu changes MUST reach a visitor with the home page open without a reload, as for other live service changes.
- **FR-010**: Times shown on the Menus screen MUST be displayed in America/Los_Angeles.

### Key Entities

- **Menu**: a named, publishable list of products the manager assigns to services.
- **Menu entry**: a product's place on a menu, with its display order.
- **Product**: an item that can be sold. Managed on the existing Products screen, not changed by this feature.
- **Service**: a shop open window that uses at most one menu.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A manager can create a menu with 5 products, publish it and assign it to a service in under 3 minutes, without developer help.
- **SC-002**: Unpublished menus and unpublished products are never visible to visitors in any test.
- **SC-003**: After the manager saves a menu change, visitors with the page open see it within 1 minute.
- **SC-004**: 100% of attempts to delete or unpublish a menu in use by a service show the affected services first.

## Assumptions

- Product creation and editing stay on the existing Products screen; this feature only chooses which products go on a menu.
- A service has one menu, as in spec 001.
- Menus are reused across many services, so changing a menu changes all services that use it, including future ones.
- Duplicating a menu is out of scope for v1; services share a menu by reference and editing it changes every service that uses it.
- Menu-specific prices or per-service product availability are out of scope.
- The storefront ordering and cart screens are in the separate spec `003-cart-checkout-ui`.

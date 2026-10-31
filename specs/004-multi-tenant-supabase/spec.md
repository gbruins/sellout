# Feature Specification: Multi-Tenant Supabase Migration

**Feature Branch**: `004-multi-tenant-supabase`

**Created**: 2026-10-28

**Status**: Draft

**Input**: User description: "Migrate strawberry-server's self-hosted Postgres to Supabase and introduce multi-tenancy so the platform can host multiple independent pizza shops under one deployment, each with isolated data, plus replace the admin's single hardcoded credential with real Supabase-backed user accounts and administration."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Store owner signs in with a real account (Priority: P1)

A store owner logs into strawberry-admin with their own email and password instead of today's single shared hardcoded credential, and only ever sees their own store's data.

**Why this priority**: Without real per-owner accounts, there is no way for more than one store to operate safely in one deployment — this is the foundation every other capability depends on.

**Independent Test**: Can be fully tested by creating two store-owner accounts, logging in as each, and confirming each only sees and can edit their own store's products, menus, and orders.

**Acceptance Scenarios**:

1. **Given** a store owner account exists for Tenant A, **When** they log into strawberry-admin with their email and password, **Then** they land on their own store's dashboard and cannot view or modify Tenant B's data.
2. **Given** a store owner has forgotten their password, **When** they use the password-reset flow, **Then** they receive a reset link and can set a new password without staff intervention.

---

### User Story 2 - Two stores operate independently without data leakage (Priority: P1)

Two separate pizza shops each run their storefront, menu, and checkout through the same deployment, with complete data isolation between them.

**Why this priority**: This is the core value of multi-tenancy — one deployment safely serving many businesses. Without it, "multi-tenant" is cosmetic.

**Independent Test**: Can be fully tested by provisioning two tenants with distinct products/menus/service windows, placing a cart and checkout against each, and confirming neither tenant's storefront, cart, or admin view ever surfaces the other's data.

**Acceptance Scenarios**:

1. **Given** Tenant A and Tenant B price the same style of pizza differently, **When** a customer orders from Tenant A's storefront, **Then** the price charged and the order recorded belong to Tenant A only.
2. **Given** Tenant A's service window (shop open hours) is closed, **When** a customer visits Tenant B's storefront, **Then** Tenant B's own service window state is shown, unaffected by Tenant A's.

---

### User Story 3 - A new tenant can be onboarded (Priority: P2)

A new tenant — complete with its own admin account, products, and storefront — can be brought onto the platform without code changes.

**Why this priority**: Without a repeatable onboarding path, this feature is a one-time migration to a second hardcoded store, not a real platform capability.

**Independent Test**: Can be fully tested by onboarding a brand-new third tenant end-to-end and confirming it reaches a working storefront and admin login without any deploy or manual database edit.

**Acceptance Scenarios**:

1. **Given** Sell Out Pizza staff follow the onboarding path for a new tenant, **When** onboarding completes, **Then** that tenant's admin owner can log in and the tenant's storefront is reachable, distinct from every other tenant's.
2. **Given** no public signup flow exists, **When** a prospective store owner wants to join the platform, **Then** they are directed to contact Sell Out Pizza staff rather than self-register.

---

### Edge Cases

- What happens when a store owner's session/token expires mid-admin-session — are they prompted to re-authenticate without losing unsaved changes?
- How does the system handle a cart or checkout session that is "in flight" during the Postgres-to-Supabase cutover — no cart may be silently lost or double-charged?
- What happens when a tenant is deactivated or suspended — do its storefront and admin login stop working immediately, and what does a customer see?
- How are cross-tenant support actions (Sell Out Pizza staff accessing a tenant to help) distinguished from the tenant owner's own actions in any audit trail?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST isolate each tenant's products, menus, service windows, carts, and discount rules from every other tenant at the data layer.
- **FR-002**: System MUST authenticate admin users via real per-user accounts (email + password) instead of the single shared `AUTH_USERNAME`/`AUTH_PASSWORD` credential in use today.
- **FR-003**: Admin users MUST be able to reset a forgotten password through a self-service, email-based flow.
- **FR-004**: System MUST restrict each admin account to only the tenant(s) it is authorized for; an account for Tenant A MUST NOT be able to view or modify Tenant B's data through any admin route.
- **FR-005**: Checkout pricing, totals, and inventory-hold logic MUST continue to be computed server-side from the correct tenant's database values — tenancy MUST NOT be trusted from client input alone (Constitution Principle I: Server Owns the Truth).
- **FR-006**: System MUST continue to protect anonymous storefront carts with a per-cart token (Constitution Principle II), scoped so a cart token issued for Tenant A cannot be replayed against Tenant B's data.
- **FR-007**: System MUST provide a way to onboard a new tenant — creating its data partition, its first admin account, and a reachable storefront — as an internal, staff-only provisioning step; there is no public store-owner self-service signup flow in this feature's scope.
- **FR-008**: System MUST isolate tenant data using a single shared schema, with a tenant identifier column on every tenant-scoped table and Postgres Row-Level Security policies enforcing that each request can only read or write rows for its own tenant.
- **FR-009**: System MUST support a per-tenant configurable display timezone for service-window and order-time display, used by both strawberry-admin and the storefront instead of a single fixed zone.
- **FR-010**: Existing cart, checkout, Stripe payment, and menu/discount business logic MUST be preserved as-is in behavior — only made tenant-aware, not rewritten.
- **FR-011**: Migration of the current Postgres schema and data to Supabase MUST NOT lose or corrupt existing development/test data, even though no production tenant data exists yet.

### Key Entities *(include if feature involves data)*

- **Tenant (Store)**: A single pizza shop operating on the platform. Owns its own products, menus, service windows, carts, and discount rules; has one or more admin user accounts.
- **Admin User Account**: An authenticated identity (email, password, role) belonging to exactly one tenant, or — for Sell Out Pizza staff — carrying cross-tenant support access (see the related edge case above).
- **Existing entities** (Product, Product Type, Service, Service Menu, Cart, Cart Item, Allowed Street, Address Discount) all gain an association to a Tenant and must be scoped by it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Two independently configured tenants, each running their own separate storefront deployment, can complete a full order (menu browse → cart → Stripe checkout) against the shared backend with zero cross-tenant data visible to either tenant's customers or admin.
- **SC-002**: An admin user can only ever authenticate into and act on the tenant(s) their account belongs to, verified with no exceptions across all admin routes.
- **SC-003**: A store owner can recover account access via self-service password reset without contacting Sell Out Pizza staff.
- **SC-004**: Onboarding a new tenant requires no source-code changes and no manual database edits outside the defined onboarding step.
- **SC-005**: All existing storefront and admin functional behavior (cart holds, discounts, menu display, Stripe checkout) continues to pass its existing tests after the migration (Constitution Principle VI: Verify Before Done).

## Assumptions

- The project is still pre-launch: there is no existing production tenant, customer, or order data to migrate — only development/test data and schema.
- "Multi-tenant" means multiple independent pizza-shop businesses, each with its own menu, pricing, and hours — not multiple locations of a single business sharing one menu.
- Only `strawberry-server` (the backend) is a single shared deployment across tenants. Each tenant operates its own separate storefront website/deployment (its own codebase instance — `selloutPizza` is the storefront for exactly one tenant, the platform owner's own shop). A storefront identifies itself to the shared backend solely via its own tenant-specific store API key; there is no domain/hostname-based tenant resolution.
- Sell Out Pizza staff retain some form of cross-tenant administrative access for support purposes, distinct from tenant-owner accounts; the exact mechanism is an implementation-plan detail, not a spec-level decision.
- Constitution Principle IV (Pickup Only) continues to apply per tenant unless amended; this feature does not introduce delivery.
- Supabase Auth replaces only the *admin* credential model in this feature. Storefront customers remain anonymous (cart-token based) as today, per Constitution Principle II — customer-facing accounts are out of scope for this feature.
- Tenant onboarding (FR-007) is a Sell Out Pizza staff action for this feature; a public store-owner signup flow may be considered in a later feature.
- **Constitution dependency (resolved)**: FR-009 required amending Principle V, which was done via `/speckit-constitution` (v1.0.0 → v1.1.0): the fixed Los Angeles display zone is now a per-tenant configured zone, defaulting to America/Los_Angeles.

# Phase 1 Data Model: Multi-Tenant Supabase Migration

New entities and the tenant association added to existing ones. Validation rules reference the
functional requirements (FR-xxx) in [spec.md](spec.md); technical rationale is in
[research.md](research.md).

## New: `tenants`

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, pk | |
| `name` | text, not null | Display name of the pizza shop |
| `timezone` | text, not null, default `'America/Los_Angeles'` | IANA zone; drives display per amended Constitution Principle V (FR-009) |
| `status` | enum: `active`, `suspended` | Suspended tenants' storefront/admin access MUST stop immediately (spec Edge Cases) |
| `created_at` | timestamptz, not null, default `now()` | |

## New: `admin_users`

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, pk | Equals the corresponding `auth.users.id` (Supabase-managed identity) |
| `tenant_id` | uuid, nullable, fk → `tenants.id` | Null only for platform-staff rows (see `is_platform_staff`) |
| `role` | enum: `owner` | Single role for v1 (FR-002/FR-004); extend later if staff roles within a tenant are needed |
| `is_platform_staff` | boolean, not null, default `false` | Sell Out Pizza staff support access, distinct from tenant ownership (spec Edge Cases / Assumptions) |
| `created_at` | timestamptz, not null, default `now()` | |

**Validation rules**:
- Exactly one of `tenant_id IS NOT NULL` or `is_platform_staff = true` MUST hold per row — an
  owner account belongs to one tenant; a platform-staff account does not belong to any single
  tenant (FR-004, Edge Cases).
- `admin_users.id` MUST correspond to an existing `auth.users.id` — enforced by the Supabase Auth
  signup/invite flow that creates both rows together, not by a foreign key across schemas.

## New: `tenant_api_keys`

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, pk | |
| `tenant_id` | uuid, not null, fk → `tenants.id` | One tenant may have more than one active key (e.g. to rotate without downtime) |
| `key_hash` | text, not null | bcrypt hash, same scheme as today's single `API_KEY_HASH` (`scripts/makeApiKey.js`) |
| `revoked_at` | timestamptz, nullable | Non-null means this key no longer authenticates storefront requests |
| `created_at` | timestamptz, not null, default `now()` | |

**Validation rules**:
- Replaces the current single `API_KEY_HASH` env var, which cannot scale to one key per tenant
  without a redeploy per new tenant — that would violate SC-004 ("no source-code changes" to
  onboard a tenant). A storefront's API key is resolved to exactly one `tenant_id` by this table,
  not by any request-side tenant parameter the storefront itself would have to send (research #9).

## Modified: existing tenant-scoped tables

Each of the following gains `tenant_id uuid not null references tenants(id)`, backfilled during
migration, with an RLS policy `USING (tenant_id = app_current_tenant_id())` for
`SELECT`/`INSERT`/`UPDATE`/`DELETE` (research #3). `app_current_tenant_id()` is a small SQL
helper, not the raw `current_setting(...)::uuid` expression — it collapses both "never set" and
"reset to empty string" (a real Postgres GUC-reset behavior on reused pooled connections, found
during QA) to NULL before casting, so both cases fail closed to zero rows instead of one of them
throwing (research #3's second addendum).

- `products`, `product_types`
- `carts`, `cart_items`
- `service`, `service_menus`, `service_menu_products` (the `carts.service_id`/`checkout_expires_at`
  columns already added by migration `80_service_holds.js` are covered by `carts` gaining
  `tenant_id` — there is no separate holds table despite that migration's filename)
- `allowed_streets`, `address_discounts`

No other columns on these tables change — existing business logic (pricing, Stripe ids, cart-hold
expiry, menu ordinals, discount rules) is preserved per FR-010.

## State transitions

- **Tenant**: `active` → `suspended` (admin/platform-staff action) → storefront and admin login for
  that tenant MUST stop working immediately (Edge Cases); `suspended` → `active` reverses this.
- **Cart**: unchanged by this feature — still anonymous-token-based, now additionally scoped by
  `tenant_id` so a cart token issued for one tenant cannot be replayed against another (FR-006).

## Relationships

```text
tenants (1) ──── (N) admin_users          [admin_users.tenant_id, nullable for platform staff]
tenants (1) ──── (N) tenant_api_keys      [tenant_api_keys.tenant_id]
tenants (1) ──── (N) products             [products.tenant_id]
tenants (1) ──── (N) service              [service.tenant_id]
tenants (1) ──── (N) carts                [carts.tenant_id]
... (same 1:N pattern for every table listed above)
auth.users (1) ── (1) admin_users         [admin_users.id = auth.users.id]
```

# Contract: Per-Request Tenant Resolution

How every request — admin or storefront — ends up with exactly one `tenant_id` enforced by
Postgres RLS. See [research.md](../research.md) #3 and #9.

## Admin requests

1. Verify the `Authorization: Bearer` JWT (see [admin-auth.md](admin-auth.md)).
2. Look up `admin_users` by the token's `sub`.
3. If `tenant_id` is present → that is the request's tenant context.
4. If `is_platform_staff = true` and no `tenant_id` → the route MUST explicitly declare whether it
   allows platform-staff cross-tenant access; if so, the tenant context comes from an explicit
   `X-Tenant-Id` header the admin UI sends when staff are acting "as" a tenant for support, and the
   server MUST log that this is a staff-impersonation action (spec Edge Cases: audit distinction).

## Storefront (public, anonymous) requests

1. Validate the store API key (existing Basic-auth `apiKey` strategy) as before. The key is looked
   up in `tenant_api_keys`, and the `tenant_id` on the matching row becomes the request's tenant
   context. A missing, invalid, or revoked key returns `401`.
2. There is no domain/hostname resolution: each tenant runs its own separate storefront
   deployment, configured with only that tenant's own key, so the key alone is sufficient to
   identify the tenant — the same way today's single shared key identifies "the store."
3. Anonymous cart tokens (`X-Cart-Token`) are additionally scoped: a cart's `tenant_id` is fixed at
   creation (from the API key that created it) and MUST match the resolved request tenant on every
   subsequent use (FR-006).

## Enforcement

Once resolved by either path above, the server issues `SET LOCAL app.current_tenant_id = '<uuid>'`
at the start of the request's database transaction, before any tenant-scoped query runs. RLS
policies on every tenant-scoped table (see [data-model.md](../data-model.md)) read this setting —
so even a route that forgets to filter by `tenant_id` in its own Knex query still cannot read or
write another tenant's rows.

**Failure mode this exists to prevent**: a new or modified route that queries a tenant-scoped table
without an explicit `WHERE tenant_id = ...` clause. Without RLS, that would silently return or
modify every tenant's rows (a direct violation of SC-001/SC-002). With RLS, it returns only the
caller's own tenant's rows regardless of whether the application code remembered to filter.

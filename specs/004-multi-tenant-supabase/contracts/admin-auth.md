# Contract: Admin Authentication & Authorization

Replaces `strawberry-server`'s current `auth/login` / `auth/logout` routes and Hapi `cookieAuth`
strategy (`sbsession` cookie). See [research.md](../research.md) #2 and #4 for rationale.

## Removed

- `POST auth/login`, `POST auth/logout` — login/logout now happen client-side in
  `strawberry-admin` directly against Supabase Auth (`@supabase/supabase-js`); the server no longer
  issues or reads a session cookie.

## Client → Server contract

Every admin-protected Hapi route now requires:

```text
Authorization: Bearer <supabase-access-token>
```

- The server verifies the token's signature against Supabase's JWKS endpoint (`jose`) and its
  expiry. An invalid/expired/missing token on a protected route returns `401`.
- The server then looks up `admin_users` by the token's subject (`sub` claim = `auth.users.id`).
  No matching row → `403`. A `tenant_id` found on that row becomes the request's tenant context
  (research #3); `is_platform_staff = true` rows bypass the single-tenant restriction only on
  routes explicitly marked to allow it.

## New route: `GET /api/v1/admin/me`

Returns the caller's own authorization context, so `strawberry-admin` knows which tenant it is
acting as after login (today it only knows a username string — see `src/stores/app.ts`).

**Response `200`**:
```json
{
  "tenant_id": "uuid or null (platform staff)",
  "tenant_name": "string or null",
  "role": "owner",
  "is_platform_staff": false
}
```

## Unchanged

- The storefront's store Basic-auth API key strategy (`apiKey`) is untouched by this contract —
  see [tenant-resolution.md](tenant-resolution.md).
- Per-cart anonymous token header (`X-Cart-Token`) is untouched (FR-006).

# Data Model: Email Alerts for Next Store Opening

## `email_subscribers`

One row per subscribed-or-previously-subscribed email address, per tenant.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `default uuid_generate_v4()` |
| `tenant_id` | `uuid` NOT NULL, FK → `tenants.id` | RLS-scoped (research.md #5) |
| `email` | `text` NOT NULL | Lowercased before storage so `(tenant_id, email)` uniqueness is case-insensitive |
| `status` | enum `subscribed` / `unsubscribed` | NOT NULL, default `subscribed` |
| `unsubscribe_token` | `uuid` NOT NULL, default `uuid_generate_v4()` | Opaque, unguessable — never the row's own `id` (research.md #3). Stays the same across a resubscribe, so an old unsubscribe link in an old email always still works. |
| `subscribed_at` | `timestamptz` NOT NULL | Set on insert and on every resubscribe |
| `unsubscribed_at` | `timestamptz` NULL | Set when `status` moves to `unsubscribed`; cleared on resubscribe |
| `created_at` | `timestamptz` NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` NULL | Set by `BaseService.update()` convention |

**Constraints**: unique `(tenant_id, lower(email))`; index on `unsubscribe_token` (the lookup key
for the public unsubscribe route, which has no tenant context to scope the search with).

**RLS**: `ENABLE`/`FORCE ROW LEVEL SECURITY`; `tenant_isolation` policy
`USING (tenant_id = app_current_tenant_id())` for SELECT/INSERT/UPDATE/DELETE, `GRANT` to
`strawberry_app` — same shape as every tenant-scoped table from spec 004. The public signup route
resolves `tenant_id` from the store API key exactly like `/cart` does, so this policy applies
normally there. The public unsubscribe route is the one path that reads/writes this table *without*
an ambient tenant context — handled by the `unsubscribe_by_token()` SECURITY DEFINER function
(research.md #3), not by relaxing this policy.

## `notification_sends`

One row per completed "Notify subscribers" action for a specific service window. Multiple rows
per `service_id` are expected and allowed (resend).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `default uuid_generate_v4()` |
| `tenant_id` | `uuid` NOT NULL, FK → `tenants.id` | RLS-scoped |
| `service_id` | `uuid` NOT NULL, FK → `service.id` | The opening this notification was about |
| `recipient_count` | `integer` NOT NULL | Snapshot of how many active subscribers were sent to |
| `sent_at` | `timestamptz` NOT NULL, default `now()` | Only written after Postmark confirms success (research.md #2) |

**RLS**: Same `tenant_isolation` shape as above.

**Derived, not stored**: "has this service already been notified" (FR-007) is computed as
`EXISTS (SELECT 1 FROM notification_sends WHERE service_id = ?)`, surfaced by
`ServicesPage.vue` per row — not a boolean flag on `service` itself, so a resend naturally adds a
second row without needing to touch the `service` table at all.

## State transitions — `email_subscribers.status`

```
          subscribe (new email)
                │
                ▼
          ┌───────────┐  unsubscribe (link or admin removal)  ┌─────────────┐
   ──────▶│ subscribed│ ─────────────────────────────────────▶│ unsubscribed│
          └───────────┘                                        └─────────────┘
                ▲                                                     │
                └─────────────────── subscribe (same email again) ────┘
```

Both transitions are idempotent: subscribing an already-`subscribed` address, or unsubscribing an
already-`unsubscribed` one, succeed as no-ops (spec Acceptance Scenarios 1.2, 3.2).

## Validation rules

- `email`: basic format validation (not a full deliverability check) before any write — matches
  FR-002's "reject a malformed email," not an attempt to verify the mailbox exists.
- A notification send only targets rows where `status = 'subscribed'` for the service's own
  `tenant_id` — enforced by the query itself, not trusted from any client input.
- `unsubscribe_by_token()` returns `false` (not an error) for an unknown/malformed token, so the
  route can show the same generic "link isn't valid" message for every failure mode without
  distinguishing "already used," "never existed," or "malformed" (no information leak, matches
  spec Acceptance Scenario 3.3).

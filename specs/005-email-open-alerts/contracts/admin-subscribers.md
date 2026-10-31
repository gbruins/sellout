# Contract: Admin Subscriber Management & Notify

Admin-only routes (default-deny `adminBearer`, same as every other admin route). All
tenant-scoped via the caller's own JWT-resolved `tenant_id`, same as every other admin route.

## `GET /api/v1/subscribers`

Standard `BaseController.searchHandler` shape (same as `allowedStreets`'s `GET /allowed_streets`)
— paginated, sortable. Used by `SubscribersPage.vue`'s list.

**Response `200`**:
```json
{
  "data": [
    { "id": "...", "email": "visitor@example.com", "status": "subscribed", "subscribed_at": "...", "unsubscribed_at": null }
  ],
  "pagination": { "total": 42, ... }
}
```

## `GET /api/v1/subscribers/count`

A small dedicated endpoint (not derived client-side from a paginated list) so the count shown is
correct even when the list itself is paginated — `COUNT(*) WHERE status = 'subscribed'`.

**Response `200`**:
```json
{ "data": { "activeCount": 37 } }
```

## `DELETE /api/v1/subscriber?id=<uuid>`

Staff manually removes a subscriber (FR-014). Internally this is the *same* state transition as
the public unsubscribe link (data-model.md's state machine) — not a hard delete, not a separate
code path — so a manually-removed address can later resubscribe itself the normal way, same as
anyone else who unsubscribed.

**Response `200`**: the updated row, same shape `BaseController.deleteHandler` already returns
elsewhere, since this plugin's `del()` is a thin override that sets `status = 'unsubscribed'`
rather than its inherited soft/hard delete.

## `POST /api/v1/services/notify?id=<service-id>`

Staff clicks "Notify subscribers" for a specific service window (`ServicesPage.vue`). Awaits the
actual Postmark send (research.md #2) — the response only arrives once sending is confirmed one
way or the other.

**Response `200`** (sent, including to zero recipients — FR-012 still needs a definitive, visible
answer rather than nothing happening):
```json
{ "data": { "sent": true, "recipientCount": 12 } }
```
`recipientCount: 0` is a normal, successful response (not an error) — the frontend shows "There
are no subscribers to notify yet" for that case, per FR-012.

**Response `502`** (Postmark call itself failed): no `notification_sends` row is written
(research.md #2); staff sees a clear "the send failed, nothing was emailed, try again" message,
not a response implying partial/ambiguous success.

## `GET /api/v1/service?id=<service-id>` (existing route, response extended)

The existing admin service-detail response gains one additional field so `ServicesPage.vue` can
show "already notified" (FR-007) without a second round-trip per row:
```json
{ "data": { "...": "...", "last_notified_at": "2026-11-02T19:00:00.000Z" } }
```
`null` when never notified. Backed by `MAX(notification_sends.sent_at) WHERE service_id = ?`
(data-model.md's "derived, not stored" note).

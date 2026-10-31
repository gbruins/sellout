# Contract: Storefront Signup & Unsubscribe

Public-facing routes. See [data-model.md](../data-model.md) for the underlying table.

## `POST /api/v1/subscribers`

Auth: `apiKey` (the existing store Basic-auth key — same strategy `/cart` already uses; resolves
`tenant_id` the same way, no new mechanism).

**Request**:
```json
{ "email": "visitor@example.com" }
```

**Response `200`** (always this shape, whether the address was new, already subscribed, or
previously unsubscribed and now resubscribed — research.md #6, no distinction is exposed):
```json
{ "data": { "subscribed": true } }
```

**Response `400`**: malformed email address — `{ "data": null, "message": "..." }`, same error
shape as every other validated route in this codebase.

## `GET /api/v1/subscribers/unsubscribe?token=<uuid>`

Auth: `none` (`auth: false`) — this is the one public, unauthenticated route in this feature
(plan.md's Complexity Tracking justifies why). Reached by clicking the unsubscribe link in a
received email, not called from either SPA's own UI.

**Response `200`** for every outcome — valid token, already-unsubscribed token, and
unknown/malformed token all return the same generic confirmation page/response (data-model.md's
`unsubscribe_by_token()` validation rule — no information is leaked about which case occurred):
```json
{ "data": { "unsubscribed": true } }
```
(`selloutPizza`'s `UnsubscribePage.vue` renders a plain "you're unsubscribed" message regardless —
there is no failure state to show the visitor, by design.)

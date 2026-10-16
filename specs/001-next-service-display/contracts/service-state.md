# Contract: Service State

Both routes authenticate with the store key (HTTP Basic) or an admin session. They return
only published data.

## `GET /api/v1/services/next`

Returns the current service state. Used on first load and as the fallback.

**Response 200**

```json
{
  "data": {
    "status": "open",
    "server_now": "2026-10-16T21:15:00.000Z",
    "service": {
      "id": "uuid",
      "start_at": "2026-10-16T20:00:00.000Z",
      "end_at": "2026-10-17T02:00:00.000Z",
      "notes": "Pickup at the garage door",
      "inventory_count": 60,
      "max_per_order": 4
    },
    "remaining": 41,
    "menu": {
      "id": "uuid",
      "title": "Friday Menu",
      "description": null,
      "products": [
        { "id": "uuid", "title": "Margherita", "description": "...", "base_price": 2200 }
      ]
    },
    "next_service": null
  }
}
```

**Fields by status**

| status | `service` | `remaining` | `menu` | `next_service` |
|--------|-----------|-------------|--------|----------------|
| `open` | current service | integer >= 1 | published menu, or `null` if none assigned | `null` |
| `sold_out` | current service | `0` | menu (informational) | the next upcoming service, or `null` |
| `upcoming` | the upcoming service | not included | not included | `null` |
| `none` | `null` | not included | not included | `null` |

`start_at` and `end_at` are UTC ISO 8601. `server_now` lets clients correct for a wrong
device clock. `base_price` is in cents. Unpublished menus and products are never included.

**Errors**: `401` missing or bad store key.

## `GET /api/v1/services/next/stream`

Server-Sent Events. Same auth. Response headers:
`Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`.

| Event | When | Data |
|-------|------|------|
| `state` | On connect, then whenever the state changes | The same object as `data` above |
| (comment `: ping`) | Every 25 seconds | none, keeps the connection alive |

Each `state` event carries an `id` that increases with every change. A reconnecting client
needs no replay; the first event after connecting is a full `state`.

**Limits**: at most `SERVICE_STREAMS_PER_IP` concurrent streams per caller IP (default 50);
excess connections get `429`. `trustProxy` must be configured behind a proxy.

## Cart changes (slice 3)

| Route | Change |
|-------|--------|
| `POST /cart/item` | Returns `409 { code: "no_open_service" }` when no service is open. Returns `409 { code: "over_limit", max_per_order, remaining }` when the cart's pizzas would exceed the effective cap. Non-pizza items are never limited. Sets `carts.service_id` on first add. |
| `GET /cart`, any cart read | If the cart's service has ended and it has no live hold, the cart is emptied and the response includes `cart_reset: "service_ended"` once. |
| `POST /cart/checkout` | `409 { code: "service_closed" }` outside the service window; `409 { code: "sold_out" \| "over_limit" }` when stock or the cap is exceeded. Writes `checkout_expires_at`. |
| `POST /cart/checkout/cancel` | Clears `checkout_expires_at`. |

## Admin service routes

`POST /service` and `PUT /service` accept `max_per_order` (integer, 1 or more; the effective cap is `min(max_per_order, remaining)`) and
`service_menu_id`. Admin session only.

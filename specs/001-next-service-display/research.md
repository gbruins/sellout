# Research: Next Service Display

## R1. How does the server push the remaining count to the page?

- **Decision**: Server-Sent Events over a long-lived HTTP GET.
- **Rationale**: One-way server-to-browser updates are exactly what is needed. SSE is plain
  HTTP, so it passes through the existing Hapi CORS and auth setup, reconnects
  automatically, and needs no extra server package. A newly connected client receives a full
  snapshot, which satisfies "show the current count on reconnect" (FR-018).
- **Alternatives considered**:
  - WebSockets: two-way and heavier (extra package, upgrade handling, auth on upgrade).
    The page never sends data back, so it is not needed.
  - Polling every few seconds: rejected by the owner and wasteful at scale.
  - Third-party realtime service: adds cost and a new vendor for a small shop.

## R2. How does the storefront authenticate an SSE stream?

- **Decision**: Read the stream with `fetch` using `@microsoft/fetch-event-source`, sending
  the same Basic-auth header as every other call.
- **Rationale**: The browser `EventSource` cannot set headers. The library adds headers,
  automatic retry with backoff, and pausing while the tab is hidden, which covers the
  backgrounded-tab edge case.
- **Alternatives considered**:
  - Credentials in the query string: leaks the key into logs and history.
  - An unauthenticated public stream: breaks the default-deny rule (constitution II), even
    though the data is public.
  - Hand-written fetch reader: possible (about 40 lines) but re-implements retry and parsing.

## R3. How do multiple viewers and multiple server processes stay in sync?

- **Decision**: An in-process hub that holds all open responses and broadcasts one
  snapshot to each. A 3-second change-detecting tick plus explicit `publish()` calls from
  checkout start, cancel and the webhook.
- **Rationale**: The shop runs one process. The tick removes the need to track every
  event that can change the count (service start or end, hold expiry).
- **Alternatives considered**: Postgres LISTEN/NOTIFY, which makes the hub work across
  several instances. Deferred until the hosting setup needs it.

## R4. How is "remaining" counted without calling Stripe for every cart?

- **Decision**: Compute from the database:
  `remaining = max(0, inventory_count - paid_qty - held_qty)`, where `paid_qty` is the
  pizza quantity on closed carts for the service and `held_qty` is the pizza quantity on open carts
  whose `checkout_expires_at` is in the future. Only items whose product type slug is
  `pizza` count.
- **Rationale**: The hold ends at the Stripe session's expiry plus a 60-second margin, so a
  customer can never pay after their hold is released. `checkout_expires_at` is
  authoritative for counting; the Stripe lookup stays only as the edit lock check and clears
  the column when it sees an expired session. Cancel and webhook completion update the same
  columns.
- **Alternatives considered**: Asking Stripe for each open session (slow, rate limited,
  and the exact source of the existing lazy check); a separate holds table (more moving
  parts for no extra capability).

## R5. How are overselling races prevented?

- **Decision**: In one transaction, lock the service row with `FOR UPDATE`, recompute the
  remaining count excluding the current cart, check the cap, write a provisional
  `checkout_expires_at`, then commit before creating the Stripe session. Once the session
  exists, move the hold to its `expires_at` plus 60 seconds. If Stripe fails, clear the hold.
- **Rationale**: Serialises concurrent checkouts per service without a global lock.
- **Alternatives considered**: Optimistic retry (harder to reason about) and advisory locks
  (equivalent, less obvious to readers).

## R6. Definition of "next service" and overlaps

- **Decision**: Among services with `end_at > now`, pick the one with the earliest
  `start_at`. Status is `open` if `start_at <= now < end_at`, `sold_out` if open and
  remaining is 0, `upcoming` if it starts later, `none` if there is none. When sold out,
  the payload also carries the next upcoming service.
- **Rationale**: Matches FR-001 and the overlap edge case.

## R7. Streaming through Hapi

- **Decision**: Return a `PassThrough` stream with headers `Content-Type: text/event-stream`,
  `Cache-Control: no-cache`, `X-Accel-Buffering: no`, and disable gzip and the socket
  timeout for this route.
- **Rationale**: Compression and idle timeouts are the usual reasons SSE appears to hang.
  Verified against a real server in slice 2.
- **Open**: confirm the exact Hapi route options (`compression`, `timeout.socket`) while
  implementing.

## R8. Time zone display

- **Decision**: Format with `Intl.DateTimeFormat` and `timeZone: 'America/Los_Angeles'` in
  one helper per UI. The server never formats.
- **Rationale**: Handles daylight saving automatically and ignores the visitor's zone.
- **Open**: audit how the admin's `useDate` and `Format8601` convert values.

## R9. Which items count against inventory?

- **Decision**: Only pizzas: cart items whose product's `product_type` matches the product type
  with slug `pizza`. Drinks, sides and other future types are never counted, capped or held.
- **Rationale**: The pizza count is the scarce resource. The `Pizza` type already exists.
- **Alternatives considered**: Counting everything (wrong once non-pizza items exist); a per
  product flag (duplicates the product type).

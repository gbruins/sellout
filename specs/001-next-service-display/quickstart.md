# Quickstart: Validating Next Service Display

Run after each slice. Details of shapes are in [contracts/service-state.md](./contracts/service-state.md)
and [data-model.md](./data-model.md).

## Prerequisites

- Strawberry Server running with a store key (set `API_KEY_HASH`; use a known test key) and
  migration `80_service_holds.js` applied.
- A published product, a published service menu linked to it, and a few `service` rows.
  Menus have no admin screen yet, so insert them with SQL or a seed script.
- Storefront `.env` with `VITE_API_BASE_URL`, `VITE_API_USER`, `VITE_API_KEY`.
- Use temporary rows and delete them afterwards.

## Slice 1: state and display

| Scenario | Setup | Expect |
|----------|-------|--------|
| No services | Delete or end all services | `status: none`; page shows the empty message |
| Upcoming | One service starting in 2 hours | `status: upcoming`; page shows start and end in Los Angeles time and the notes; no counter or menu |
| Earliest wins | Two future services | Only the earlier is returned |
| Open | Service window contains now, with menu | `status: open`; counter, matrix and menu products shown |
| Unpublished hidden | Add an unpublished product to the menu | Not in the payload or the page |
| No menu | Open service without a menu | `menu: null`; page shows "menu not available yet" |
| Time zone | Load with the browser set to another zone | Times still show Los Angeles time |
| Error | Stop the server, reload | Friendly message with a retry |

```bash
curl -s -u store:<key> https://strawberry.local:10000/api/v1/services/next
```

## Slice 2: live stream

1. Open the storefront on an open service. In a second client, start and cancel a checkout.
2. Expect the counter to change within 3 seconds, with no reload.
3. Stop and restart the server. Expect the page to show it may be out of date, then
   reconnect and show the current count.
4. Let a service end while the page is open. Expect the page to move to the next service or
   the empty message within a minute.
5. Open 100 simulated streams and confirm 95% see a change within 3 seconds.

```bash
curl -N -u store:<key> https://strawberry.local:10000/api/v1/services/next/stream
```

## Slice 3: holds, caps and cart reset

1. Inventory 5, cap 4. Add 5 to a cart: expect `409 over_limit`. Add 4: accepted.
2. Start checkout with 4. Expect `remaining` to drop to 1 for everyone.
3. Cancel checkout. Expect `remaining` back to 5.
4. Let a started checkout expire. Expect `remaining` to recover without any request from it.
5. Two clients start checkout for the last pizza at the same time: exactly one succeeds.
6. Try checkout before the service starts and after it ends: `409 service_closed`.
7. Start checkout just before the end, pay just after: the order completes.
8. Keep items in a cart past the end of the service, then load the cart: it is empty and a
   notice appears once.
9. Sold out with a later service scheduled: the page shows "sold out" and the later date.

## Slice 4: admin

1. In the admin, create a service with a menu and a per-order cap. Reload and confirm both
   were saved.
2. Confirm start and end display in Los Angeles time in the list and the form.
3. Open the storefront during that window and confirm the menu appears.

## Automated checks

- Storefront: `npx vitest run` and `npx vue-tsc --noEmit -p tsconfig.app.json` (new files
  must be clean).
- Server: curl scripts above against a throwaway server on a spare port.

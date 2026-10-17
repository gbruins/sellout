# Quickstart: Menu Management validation

Prerequisites: dev DB migrated (`npm run migrate` in the server repo); throwaway server recipe from the 001 quickstart. Test data uses a `TMPTEST` prefix and is removed afterward.

1. **Order**: `node --require dotenv/config scripts/checkMenus.js` creates a menu, puts three pizzas in a chosen order, reads `/services/next` and expects that order; moves one and expects the new order; an unordered product sorts last.
2. **Store filtering**: with the store key, a draft menu returns 404 and a draft product is absent; the admin sees both.
3. **Checkout guard**: put an item in a cart, remove it from the menu, start checkout, expect `is no longer available`.
4. **Live refresh**: open `/services/next/stream`, edit the menu, expect a new state event within 3 seconds.
5. **Delete usage**: `/service_menu/{id}/usage` names the service using the menu; delete still succeeds.
6. **Admin**: `vite build` passes; in a browser create a menu, add products, reorder with the buttons, publish, assign to a service, delete with the warning.

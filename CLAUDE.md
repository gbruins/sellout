# selloutPizza

Customer-facing Vue 3 + Vite storefront SPA for a multi-tenant pizza ordering platform. Sibling repos: `strawberry-admin` (owner/admin SPA), `strawberry-server` (API backend — see its CLAUDE.md for the full data model).

## Scope

Pure customer-facing: router (`src/router/index.ts`) has only `/`, `/cart`, `/order/complete`, `/about`, `/unsubscribe` plus a catch-all 404 — no admin routes live here. Authenticates to the API via a per-tenant API key (Basic auth), not Supabase Auth. The only Supabase use is a Realtime subscription (see below).

## Conventions

- **API**: `src/api/` is a typed module (`import { api } from '@/api'`), not an injected plugin — stores and composables import it directly. Tests replace methods with `stubApi()` from `src/test/stubApi.ts`.
- **i18n**: every UI string lives in `src/locales/en-US.ts` and is rendered with `$t()` in templates. Stores never hold English text — errors are `{ key, params, plural }` (`src/utils/cartErrors.ts`) translated by the component. `src/test/setup.ts` installs i18n for all component tests.
- **Prices** are cents from the API and are shown without a currency symbol everywhere, via `usePrice().formatPrice` (the i18n `price` number format).
- **App-level state**: `DefaultLayout` owns the live service status (`useLiveServiceStatus`) and the initial cart load, so pages must not load/connect the service store themselves.

## Order model

Orders are `carts` rows on the server (see `strawberry-server/CLAUDE.md`) — `pickup_code` is the order number shown to the customer after checkout. `/order/complete` looks the order up by the Stripe `session_id` in the return URL (`GET /orders/confirmation`, `useOrderConfirmation`), not by the browser's cart credentials, so it survives refreshes and late webhooks.

## Realtime precedent

Live store status (open/closed, pizzas remaining) uses Supabase Realtime as a "something changed, refetch" signal on `tenant_service_activity` (`src/stores/service.ts`, `src/plugins/serviceRealtime.ts`), falling back to polling `GET /services/next` when no Realtime token is available. The earlier hand-rolled SSE stream was removed. Extend this Realtime pattern (also used by the admin kitchen board) rather than adding another live-update mechanism.

## Deployment

`render.yaml` lives in this repo's root (even though it also defines the `strawberry-admin` and `strawberry-server` Render services) — check here first when touching deployment config for any of the three apps.

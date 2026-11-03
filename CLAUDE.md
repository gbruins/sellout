# selloutPizza

Customer-facing Vue 3 + Vite storefront SPA for a multi-tenant pizza ordering platform. Sibling repos: `strawberry-admin` (owner/admin SPA), `strawberry-server` (API backend — see its CLAUDE.md for the full data model).

## Scope

Pure customer-facing: router (`src/router/index.ts`) has only `/`, `/cart`, `/order/complete`, `/about`, `/unsubscribe` — no admin routes live here. Authenticates to the API via a per-tenant API key (Basic auth), not Supabase — there is no Supabase client dependency in this repo.

## Order model

Orders are `carts` rows on the server (see `strawberry-server/CLAUDE.md`) — `pickup_code` is the order number shown to the customer after checkout (`src/pages/OrderCompleteView.vue`).

## Realtime precedent

This repo has a hand-rolled Server-Sent-Events client (`src/utils/serviceStream.ts`, using `@microsoft/fetch-event-source`) for live store open/closed status, backed by `strawberry-server/server/plugins/service/ServiceStream.js`. Before building a new live-update mechanism anywhere in these three apps, check whether this SSE pattern already covers the need, or whether Supabase Realtime (used for tenant-scoped data like kitchen order tracking, where it's a better fit than hand-rolled SSE) is now the preferred approach to extend — avoid ending up with a third different live-update mechanism.

## Deployment

`render.yaml` lives in this repo's root (even though it also defines the `strawberry-admin` and `strawberry-server` Render services) — check here first when touching deployment config for any of the three apps.

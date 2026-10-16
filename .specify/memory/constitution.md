# Sell Out Pizza Constitution

## Core Principles

### I. Server Owns the Truth
Prices, totals, tax, inventory and service availability MUST be computed on
Strawberry Server from database values. The storefront and admin are presentation
layers and MUST NOT be trusted for money or stock. Checkout line items MUST be built
from current DB product prices, and only published products may be sold.

### II. Store Access Is Least-Privilege
The storefront authenticates with the store Basic-auth key and is treated as a public,
non-secret client. Server routes MUST be default-deny (admin cookie) and opt in to store
access explicitly. Anonymous carts MUST be protected by a per-cart token, stored only as
a SHA-256 hash. Store callers MUST NOT see unpublished data or admin-only fields.

### III. Cards Only, Stripe-Hosted
Payment is by card through Stripe Checkout only. Card data MUST never touch our code.
Order completion MUST happen in the signature-verified webhook and MUST be idempotent.
A cart with an open checkout session MUST reject edits.

### IV. Pickup Only
The shop does not deliver. Features MUST NOT add delivery addresses, delivery fees or
street restrictions to the storefront flow unless this principle is amended first.

### V. Time Is UTC, Displayed in Los Angeles Time
The server MUST store and compare all timestamps in UTC. The storefront and the admin
MUST display times in the America/Los_Angeles time zone, never the visitor's local zone.
Display conversion happens in the UIs only.

### VI. Verify Before Done
Every behavior change MUST be verified: server routes by live request tests, storefront
logic by vitest. Changes MUST NOT be committed with failing tests they caused.

### VII. Specs Span Repos
Features that touch more than one repo are specified once, in this repo's `specs/`
folder. Each plan MUST list the changes per repo (server, admin, storefront).

## Additional Constraints

- Stack: Vue 3, Pinia and Tailwind storefront; Vue admin; Hapi, Knex and Postgres server.
- Secrets live in `.env` files and MUST NOT be committed. Only the hash of the store key
  is stored server-side.
- Known deferred work is tracked in `TODO.md`.

## Development Workflow

- Features that touch more than one repo or change behavior follow specify, plan, tasks,
  implement, converge. Small fixes MAY skip the spec.
- Commits are small and per repo, with only the author's own changes staged. Nothing is
  pushed without the owner's go-ahead.

## Governance

This constitution supersedes other practices. Amendments are made through
`/speckit-constitution` and versioned with semantic versioning: MAJOR for removed or
redefined principles, MINOR for new principles or materially expanded guidance, PATCH for
wording. Every plan MUST be checked against these principles, and any exception MUST be
justified in the plan.

**Version**: 1.0.0 | **Ratified**: 2026-10-16 | **Last Amended**: 2026-10-16

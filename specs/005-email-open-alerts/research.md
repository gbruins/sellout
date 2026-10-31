# Research: Email Alerts for Next Store Opening

## 1. Postmark: Broadcast stream, not Transactional

**Decision**: Send via a Postmark **Broadcast** message stream, created alongside the existing
(currently-unused) account, using the official `postmark` Node client's Batch Email API.

**Rationale**: This is a one-to-many send to an opt-in list, not a 1:1 transactional email.
Postmark explicitly separates these for deliverability/reputation reasons and can act on an
account that sends bulk/list mail through its transactional stream. No code in `strawberry-server`
currently uses Postmark for anything (confirmed by grep — `POSTMARK_API_KEY`/`EMAIL_ADMIN`/
`EMAIL_INFO` are declared in `.env.example` but read nowhere), so there's no existing transactional
usage to protect, but the separation is still the correct starting point rather than something to
retrofit later once real transactional email exists.

**Alternatives considered**: A dedicated marketing-email tool (Resend, Buttondown) — rejected for
v1 since it adds a second vendor/integration surface for a single-tenant-scale feature; reusing
Postmark (already the project's email vendor choice) via its Broadcast stream gets the same
deliverability protection with no new vendor.

## 2. Sending is awaited, not fire-and-forget

**Decision**: The "Notify subscribers" request AWAITS the Postmark Batch Email call before
responding, and only writes the `notification_sends` audit row on confirmed success.

**Rationale**: `ServiceMenuController`'s `ServiceStream.publish(tenantId)` (fire-and-forget, not
awaited) was the first pattern considered, since it's this codebase's existing precedent for "a
side effect after a DB write that shouldn't block the response." It doesn't fit here: that pattern
exists because the SSE publish is triggered on *every* menu edit, so paying its latency on every
such edit would be bad; "Notify" is instead the one explicit, infrequent, deliberate action whose
entire purpose *is* sending the email, and FR-007 requires staff to see an accurate "already
notified" record — which can only be accurate if it's written after confirmed success, not
optimistically before an unawaited call might still fail. At this feature's scale (one Postmark
Batch Email call, ≤500 recipients, typically sub-2-second), a staff click briefly waiting for its
own explicit action to complete is ordinary form-submission UX, not the kind of blocking
SC-005 is about (it's about *other, unrelated* admin work not being blocked by sends in general —
e.g. a background send should never freeze an unrelated page load elsewhere, which an awaited
request confined to its own click handles correctly).

**Alternatives considered**: Fire-and-forget (ServiceMenuController's pattern) — rejected per
above, would make the "already notified" audit trail unreliable. A job queue — rejected as
overbuilt for this scale; no queue/cron infrastructure exists anywhere in this codebase today
(confirmed by grep for `cron`/`bull`/`agenda`/`setInterval` outside the SSE hub), and introducing
one just for this would be a disproportionate addition.

## 3. Public unsubscribe: token-based, `auth: false`, SECURITY DEFINER lookup

**Decision**: The unsubscribe link encodes an unguessable per-subscriber token (a random UUID
column, not the row's own `id`). The route is `GET /api/v1/subscribers/unsubscribe?token=...`,
`auth: false` (no store key, no admin JWT — the email recipient has neither). It resolves and
updates the subscriber in one step via a narrow `unsubscribe_by_token(token uuid) RETURNS boolean`
Postgres function, `SECURITY DEFINER`, mirroring `get_cart_tenant_id()`'s existing precedent
(migration `96_multi_tenant_foundation.js`) for "a narrow, single-purpose, auditable RLS bypass for
exactly the one case with no ambient tenant context" — not a blanket bypass, and not reachable
with any other input than a valid token.

**Rationale**: No other mechanism can authenticate a bare click from an email client. Matches
`contracts/tenant-resolution.md`'s already-established reasoning for the Stripe webhook's own
`auth: false` + SECURITY-DEFINER-escape-hatch design — same shape, same justification, applied to
a second deliberately narrow case. GET (not POST) matches real-world one-click-unsubscribe links,
which must work from a plain clicked `<a>` with no JS.

**Known accepted tradeoff**: GET-based unsubscribe links can be pre-fetched by some email
providers' link-safety scanners, occasionally unsubscribing someone who never personally clicked.
This is a widely-known, low-stakes tradeoff for this exact feature shape (losing one subscriber to
a false-positive scan vs. forcing every recipient through a second confirmation step) — accepted
as-is rather than building a confirmation page, consistent with "one-click unsubscribe" being the
compliance expectation this feature is explicitly built to meet.

**Alternatives considered**: A confirmation page after the link ("are you sure?") — rejected, adds
friction for a low-stakes action and isn't what "one-click" means. Session/magic-link auth for the
unsubscribe page — rejected as unnecessary complexity; the token itself is the credential.

## 4. Email content: tenant's own configured time zone

**Decision**: The notification email states the selected service window's `start_at` (and `end_at`
if present) formatted in `tenants.timezone` (spec 004), computed server-side at send time — never
UTC, never the recipient's own device zone.

**Rationale**: Direct application of Constitution Principle V, already generalized to per-tenant
zones by spec 004's amendment. No new formatting logic needed beyond what `date-fns-tz` (already a
`strawberry-admin` dependency; added to `selloutPizza` in spec 004 for the same reason) already
does — this computation happens server-side in the email-rendering step, not reused client-side
code, since the recipient is reading an email, not a page in either SPA.

**Alternatives considered**: Format in the visitor's own timezone (inferred from signup) —
rejected, directly contradicts Principle V ("never the visitor's local zone").

## 5. New tables get their own RLS block (migration 96 already ran)

**Decision**: `email_subscribers` and `notification_sends`'s own migration (`97_...`) replicates
the `ENABLE`/`FORCE ROW LEVEL SECURITY` + `CREATE POLICY tenant_isolation ... USING (tenant_id =
app_current_tenant_id())` + `GRANT ... TO strawberry_app` block directly, rather than relying on
any later pass to retrofit it.

**Rationale**: `96_multi_tenant_foundation.js`'s `TENANT_SCOPED_TABLES` loop only ran once, against
tables that existed at that time (confirmed directly from that migration's code) — any table
created afterward is on its own for RLS setup. This was flagged explicitly during spec
004's Phase 6 exploration and is being applied here as the first real instance of it.

**Alternatives considered**: None — this is a correctness requirement, not a choice.

## 6. Idempotent subscribe: upsert on `(tenant_id, email)`

**Decision**: Subscribing is `INSERT ... ON CONFLICT (tenant_id, email) DO UPDATE SET status =
'subscribed', subscribed_at = now(), unsubscribed_at = null` — a unique constraint on
`(tenant_id, email)` backs this. Both "brand new email" and "re-subscribing a previously
unsubscribed email" (spec FR-004, Acceptance Scenario 1.4) go through the same upsert; the public
response is identical either way ("you're subscribed") — the API never reveals whether the address
was already on the list, since there's no value in that distinction for the visitor and it avoids
any (low-stakes but needless) email-enumeration signal.

**Rationale**: Single, simple state machine (`subscribed` / `unsubscribed` on one row) rather than
tracking subscribe/unsubscribe history as separate rows — matches spec's framing of unsubscribe as
"a state change, not a new identity" (Key Entities).

**Alternatives considered**: Hard-deleting the row on unsubscribe instead of a status flag —
rejected, loses the audit trail the Edge Cases/FR-009 implicitly rely on ("stops sending... until
it resubscribes" requires remembering the address existed) and would make the unsubscribe link
not idempotent on a second click in the natural way (Acceptance Scenario 3.2).

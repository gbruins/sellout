# Feature Specification: Email Alerts for Next Store Opening

**Feature Branch**: `005-email-open-alerts`

**Created**: 2026-10-29

**Status**: Draft

**Input**: User description: "Add the ability to collect email addresses on the selloutPizza home page for people to receive email alerts when the store is going to be open next (since the store is open inconsistently). Touches frontend, admin site, and backend/DB. Sending goes through Postmark. Settled decisions: sending is fully staff-manual (no auto-send when a service window is created or edited); single opt-in (no confirmation email); every sent email has a one-click unsubscribe link."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Visitor subscribes for alerts (Priority: P1)

A visitor finds the shop closed and wants to know next time it opens, without having to keep checking the site. They enter their email address once and are subscribed immediately.

**Why this priority**: The entire feature has no value without subscribers. This is the minimum slice that proves visitors actually want this.

**Independent Test**: With the shop closed, submit a valid email on the home page and confirm it is recorded as a subscriber for that tenant — independently verifiable without any admin or sending capability existing yet.

**Acceptance Scenarios**:

1. **Given** the shop is closed (no open service window), **When** a visitor enters a valid email address and submits, **Then** they see a confirmation that they're subscribed and the address is recorded.
2. **Given** a visitor who already subscribed, **When** they submit the same email address again, **Then** they see a friendly confirmation (not an error) and no duplicate subscription is created.
3. **Given** a visitor enters a malformed email address, **When** they submit, **Then** they see a validation message and nothing is recorded.
4. **Given** a visitor who previously unsubscribed, **When** they submit the same email address again, **Then** they become subscribed again.

---

### User Story 2 - Staff notifies subscribers of an opening (Priority: P2)

Staff schedules an upcoming opening and wants every current subscriber to hear about it by email, without manually collecting or emailing addresses themselves.

**Why this priority**: This is what turns the subscriber list into actual value — the list alone does nothing until staff can act on it. Depends on subscribers existing (User Story 1).

**Independent Test**: With at least one existing subscriber and an upcoming scheduled opening, trigger the notify action for that opening and confirm the subscriber receives an email describing it — independently verifiable with a seeded subscriber list, without needing a real visitor to have signed up through the UI first.

**Acceptance Scenarios**:

1. **Given** an upcoming scheduled opening and at least one active subscriber, **When** staff sends a notification for that opening, **Then** every active subscriber for that tenant receives an email describing that specific opening's date and time.
2. **Given** an upcoming scheduled opening and zero active subscribers, **When** staff attempts to send a notification, **Then** staff is told there are no subscribers to notify (not a silent no-op, not an error).
3. **Given** a notification has already been sent for a specific opening, **When** staff views that opening again, **Then** they can see it was already notified, and can still choose to send it again (e.g. after a time correction).
4. **Given** staff sends a notification, **When** the send is in progress, **Then** staff is not blocked from doing anything else in the admin while it completes.
5. **Given** the subscriber list for a tenant, **When** staff views it, **Then** they see the current count of active subscribers and can manually remove (unsubscribe) a specific one, e.g. after a phone complaint.

---

### User Story 3 - Subscriber removes themselves (Priority: P3)

A subscriber decides they no longer want these emails and removes themselves without contacting staff.

**Why this priority**: Independently testable as its own journey, but functionally required before User Story 2 ever sends a real email — not a "nice to have added later."

**Independent Test**: Click the unsubscribe link in a received notification email and confirm no further notifications are sent to that address — independently verifiable with a directly-crafted unsubscribe link, without needing a prior real send.

**Acceptance Scenarios**:

1. **Given** a subscribed email address, **When** that address's unsubscribe link is opened, **Then** the address stops receiving future notifications and the visitor sees a confirmation.
2. **Given** an already-unsubscribed address, **When** its unsubscribe link is opened again, **Then** the visitor sees the same confirmation (not an error) and nothing changes.
3. **Given** a malformed or expired unsubscribe link, **When** it is opened, **Then** the visitor sees a generic "this link isn't valid" message rather than an error page or a stack trace.

### Edge Cases

- A tenant is suspended (existing platform concept — specs/004-multi-tenant-supabase): sending notifications for that tenant's openings MUST be blocked, consistent with every other action being blocked for a suspended tenant.
- Staff edits a service window's time after already notifying subscribers about it: the already-sent email is not retroactively corrected; staff may choose to send again (Acceptance Scenario 2.3) if the change is significant enough to warrant it.
- A subscriber's email address is re-entered after they unsubscribed: they are re-subscribed (Acceptance Scenario 1.4), not permanently blocked.
- High-volume or scripted repeated signups against the public form: handled by the platform's existing request rate-limiting, not a new feature-specific mechanism.
- Two tenants' subscriber lists must never mix: a tenant's staff can only see and notify their own tenant's subscribers, and a subscriber only ever receives alerts for the tenant they subscribed to.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST let a storefront visitor submit an email address to subscribe to their tenant's "shop open" notifications, with no account or password required.
- **FR-002**: System MUST reject a submission with a malformed email address before subscribing it.
- **FR-003**: System MUST treat a duplicate subscription attempt (same email, same tenant, already active) as a successful no-op rather than creating a duplicate record or returning an error.
- **FR-004**: System MUST allow a previously-unsubscribed address to become subscribed again by submitting it again.
- **FR-005**: System MUST let a staff/admin user select a specific upcoming scheduled opening and send a notification email to every currently-active subscriber of that tenant for it.
- **FR-006**: System MUST NOT send any notification automatically — creating or editing a scheduled opening never triggers a send by itself; sending only ever happens from an explicit staff action.
- **FR-007**: System MUST show staff whether a notification has already been sent for a given opening, while still permitting them to send it again.
- **FR-008**: System MUST include a one-click, unauthenticated unsubscribe link in every notification email.
- **FR-009**: System MUST stop sending to an address once unsubscribed, until it resubscribes.
- **FR-010**: System MUST scope every subscriber, and every notification send, to the one tenant it belongs to — no staff member or subscriber can see or be affected by another tenant's data.
- **FR-011**: System MUST prevent sending any notification for a suspended tenant.
- **FR-012**: System MUST tell staff when a notify action found zero active subscribers, rather than appearing to succeed silently.
- **FR-013**: System MUST NOT block or delay other staff actions in the admin while a notification send is in progress.
- **FR-014**: System MUST let a staff/admin user manually remove (unsubscribe) a specific subscriber from their tenant's list.
- **FR-015**: System MUST show staff the current count of active subscribers for their tenant.

### Key Entities

- **Email Subscriber**: an email address subscribed to one tenant's "shop open" notifications. Belongs to exactly one tenant. Has a subscribed/unsubscribed state and the timestamps of when each occurred. An address may unsubscribe and later resubscribe — this is a state change, not a new identity.
- **Notification Send**: a record that a notification was sent for a specific scheduled opening, including when it was sent and how many subscribers it reached at that time — this is what lets staff see "already notified" (FR-007) and supports sending again.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A visitor can subscribe from the home page in well under a minute, with no account creation.
- **SC-002**: Staff can notify every current subscriber about a specific upcoming opening in a single action, without manually compiling or sending the list of addresses themselves.
- **SC-003**: A subscriber can remove themselves from the list in one click, without contacting staff.
- **SC-004**: Across two independently configured tenants, each with their own subscribers, zero cross-tenant visibility or delivery occurs — verified the same way tenant isolation was verified in specs/004-multi-tenant-supabase.
- **SC-005**: Sending a notification never makes the admin interface unresponsive or blocks staff from continuing other work.

## Assumptions

- Reuses the existing per-tenant storefront API key (specs/004-multi-tenant-supabase) to resolve tenant context for the public signup endpoint — no new public-facing authentication mechanism is introduced.
- Single opt-in, no confirmation-email step, per explicit product decision — the one-click unsubscribe link is the compliance mechanism in its place.
- Sending is fully staff-manual; there is no automatic or scheduled sending in this feature, now or implied for later.
- The actual email-delivery mechanism (e.g. which provider, which message stream) is an implementation decision made during planning, not a spec-level concern.
- Abuse/rate-limiting protection for the public signup endpoint reuses the platform's existing request-rate limiting; no new feature-specific abuse mechanism is assumed necessary at this scale.
- Each tenant runs its own separate storefront deployment (specs/004-multi-tenant-supabase); this feature's public signup form ships in `selloutPizza` as the platform owner's own instance, while the underlying capability (API + admin UI) is available to every tenant on the shared backend.
- A notification email describes the specific opening staff selected (its date/time) — this is the whole point of the feature, not a separate decision requiring clarification.
- Admin management scope for this version (resolved via clarification): staff get a subscriber list, the current active-subscriber count, manual removal of a specific subscriber, and the notify action — CSV export is explicitly deferred to a later version, not part of this feature.

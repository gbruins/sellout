# Feature Specification: Next Service Display

**Feature Branch**: `001-next-service-display`

**Created**: 2026-10-16

**Status**: Draft

**Input**: User description: "As the admin/store manager, I want to define when the shop will be open next (a "service"). On the Sell Out Pizza home page, fetch the next available service and display it. If the service window is currently open, show the items related to a service (the pizzas-remaining counter, the menu items, etc). If it is not currently open, show when the next service will be open."

## Clarifications

### Session 2026-10-16

- Q: Should pizzas be held back from the remaining count while a customer is paying? → A: Yes. Pizzas in an open checkout are held until the checkout is paid, cancelled or expires.
- Q: Is an order accepted if payment completes after the service ends? → A: Yes, if checkout started while the service was open.
- Q: What does the page show when the current service is sold out? → A: A sold-out message plus the next upcoming service's date and time, if any.
- Q: Is there a limit on pizzas per order? → A: Yes, a per-order cap the manager can set per service, defaulting to 4.
- Q (added by owner): How does the page stay in sync with the server's remaining count? → A: The server pushes changes to open pages; reloads and frequent polling are not the design. The push mechanism is chosen in the plan.
- Q: What happens to a customer's cart when its service ends? → A: The cart is emptied, because the next service may not offer the same items. A checkout already in progress is not affected.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See when the shop is next open (Priority: P1)

A visitor opens the home page while no service is running. They see the date and time of the next scheduled service, shown in Los Angeles time, and a clear indication that the shop is closed right now. The pizza counter and ordering menu are not shown.

**Why this priority**: Most visits happen outside service hours. Telling visitors when to come back is the minimum useful behavior and stands on its own.

**Independent Test**: Schedule a service starting in the future, load the home page, and confirm the next service date and time is shown and no ordering items are shown.

**Acceptance Scenarios**:

1. **Given** a service is scheduled for a future time, **When** a visitor opens the home page, **Then** the page shows that the shop is closed and displays the service's start time and end time in Los Angeles time.
2. **Given** several future services exist, **When** a visitor opens the home page, **Then** only the earliest upcoming service is shown.
3. **Given** no current or future service exists, **When** a visitor opens the home page, **Then** the page shows a message that no service is scheduled and no date.
4. **Given** the next service has notes, **When** the page shows it, **Then** the notes are displayed with it.

---

### User Story 2 - See the live service and its menu (Priority: P1)

A visitor opens the home page during a service window. They see that the shop is open, how many pizzas remain, and the menu items available for that service.

**Why this priority**: This is the core ordering experience that the closed-state page leads to.

**Independent Test**: Schedule a service whose window contains the current time, with a menu and a pizza count, and confirm the open state, the remaining count and the menu items are shown.

**Acceptance Scenarios**:

1. **Given** a service window contains the current time, **When** a visitor opens the home page, **Then** the page shows the shop as open, the pizzas remaining, and the products on the service's menu.
2. **Given** the service menu contains unpublished products, **When** the page shows the menu, **Then** unpublished products are not shown.
3. **Given** pizzas have been sold in this service, **When** the page is loaded, **Then** the remaining count equals the service's total minus the quantity already sold.
4. **Given** the remaining count is zero, **When** the page is shown, **Then** it shows the service as sold out, does not offer ordering, and shows the next upcoming service's date and time if one is scheduled.

---

### User Story 3 - The page changes state without a reload (Priority: P2)

A visitor leaves the home page open. When the service starts, the page switches from the countdown to the open view. When the service ends, it switches to the next upcoming service or the empty message.

**Why this priority**: Visitors often wait on the page for opening time. It is valuable but the page remains correct on a manual reload without it.

**Independent Test**: Load the page shortly before a service starts, wait past the start time, and confirm the page switches to the open state without a reload.

**Acceptance Scenarios**:

1. **Given** the page is showing an upcoming service, **When** the start time passes, **Then** the page shows the open state.
2. **Given** the page is showing an open service, **When** the end time passes, **Then** the page stops offering ordering and shows the next upcoming service or the empty message.
3. **Given** the visitor's device clock is wrong, **When** the page decides open or closed, **Then** it uses the shop's time, not the device clock.
4. **Given** the page is showing an open service, **When** pizzas are held, sold or released by any customer, **Then** the remaining count on the page updates on its own within a few seconds, without the visitor reloading.
5. **Given** the page has lost its live connection, **When** the connection is restored, **Then** the page shows the current remaining count, not the last count it received.

---

### User Story 4 - Manager chooses a menu for a service (Priority: P2)

The store manager, when creating or editing a service in the admin, picks which menu the service uses, so visitors see the right items.

**Why this priority**: Without it, a service has no menu and the open view is empty. Menus can be set up directly in the data until this exists.

**Independent Test**: In the admin, assign a menu to a service, then load the storefront during that service and confirm the menu's products appear.

**Acceptance Scenarios**:

1. **Given** the manager edits a service, **When** they choose a menu and set the per-order cap and save, **Then** the service keeps both.
2. **Given** a service has no menu, **When** it is open, **Then** the storefront shows the open state with a message that the menu is not available yet.

---

### Edge Cases

- A service has a start time but its end time has passed: it is not "next" and is ignored.
- Two services overlap in time: the one that started or starts earliest is shown.
- A service ends exactly when the next begins: the page moves straight to the next service's open state.
- The service data cannot be loaded: the page shows a friendly message and a way to retry, not an error screen.
- A visitor is in a different time zone: all times are shown in Los Angeles time, with the zone labelled.
- Daylight saving time begins or ends between now and the service: the displayed local time stays correct.
- The pizza count drops to zero during an open service while a visitor is viewing the page.
- Another customer's open checkout holds the last pizzas: the page shows them as unavailable, and they reappear if that checkout is abandoned.
- Many visitors have the page open at once: every one of them sees count changes at about the same time.
- The visitor's device goes to sleep or the browser tab is backgrounded: on return the page shows the current count.
- A customer returns after a service has ended with items still saved in their cart: the cart is empty and a short notice explains that the previous service has ended.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST determine the "next service" as the service whose window contains the current time, or if none, the service with the earliest future start time.
- **FR-002**: The system MUST decide whether a service is open using the shop's own clock, not the visitor's device clock.
- **FR-003**: The home page MUST show an open view when the next service is currently running and a closed view when it is upcoming.
- **FR-004**: The closed view MUST show the upcoming service's start and end time, and its notes when present.
- **FR-005**: The open view MUST show the pizzas remaining and the published products of the service's menu.
- **FR-006**: Pizzas remaining MUST equal the service's total inventory minus the quantity on paid orders and on open checkouts for that service, and MUST NOT go below zero.
- **FR-006a**: Pizzas in an open checkout MUST be released back to the remaining count when the checkout is cancelled or expires, and MUST become sold when it is paid.
- **FR-006b**: Starting a checkout MUST fail with a clear message if the cart's quantity exceeds the pizzas remaining at that moment.
- **FR-006c**: Each service MUST have a per-order pizza cap, set by the manager when scheduling the service and defaulting to 4. Adding to a cart or starting checkout beyond the cap MUST be refused with a clear message.
- **FR-007**: The system MUST show a sold-out state and prevent ordering when no pizzas remain, and MUST also show the next upcoming service's date and time when one exists.
- **FR-008**: The system MUST refuse to start a checkout for a service that is not currently open or has no pizzas remaining, even if the page is stale. A checkout started while the service was open MUST still be accepted if payment completes after the service ends.
- **FR-009**: The system MUST show an empty state when there is no current or future service.
- **FR-010**: All times MUST be stored in UTC and displayed in the America/Los_Angeles time zone, in both the storefront and the admin.
- **FR-011**: The page MUST update between closed, open and ended states without a manual reload.
- **FR-012**: Visitors MUST only see published menus and published products; unpublished data MUST NOT be exposed.
- **FR-013**: The header open or closed badge MUST reflect the same state as the page.
- **FR-014**: The store manager MUST be able to assign a menu to a service in the admin.
- **FR-015**: The page MUST show a friendly error with a retry when service data cannot be loaded.
- **FR-017**: While a visitor has the open view showing, the server MUST push changes to the remaining count (and to the open, sold-out and ended state) to the page as they happen. The page MUST NOT depend on the visitor reloading or on frequent repeated requests to stay accurate.
- **FR-018**: If the live connection drops, the page MUST reconnect automatically, show the current count on reconnect, and indicate to the visitor that the count may be out of date while disconnected.
- **FR-016**: A cart belongs to the service it was started for. When that service ends, the cart MUST be emptied and the customer told why, so items from one menu never carry into another service. A checkout already in progress MUST NOT be affected.

### Key Entities

- **Service**: A scheduled opening window with a start time, end time, optional notes, a total pizza inventory, a per-order pizza cap, and one menu.
- **Service Menu**: A named, publishable list of products offered during a service.
- **Product**: A pizza or other item that can be on one or more menus and sold.
- **Order**: A paid purchase, linked to the service it was bought for, whose quantities count against the service's inventory.
- **Cart**: A customer's in-progress selection of products, belonging to one service and emptied when that service ends.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time visitor can tell whether the shop is open and when it next opens within 5 seconds of the page loading.
- **SC-002**: The page's open or closed state agrees with the scheduled window for 100% of test cases, including across daylight saving changes.
- **SC-003**: A visitor with an open page sees the state change within 1 minute of a service starting or ending.
- **SC-008**: When a pizza is held, sold or released, every open page shows the new count within 3 seconds in at least 95% of cases, with 100 pages open at once.
- **SC-004**: No checkout can be started for a closed service or beyond its pizza inventory in 100% of test cases.
- **SC-005**: The remaining count shown is never more than one order out of date at load time.
- **SC-006**: Unpublished menus and products are never visible to visitors in any test.
- **SC-007**: The manager can schedule a service with a menu and see it appear on the storefront without developer help.

## Assumptions

- The shop operates in a single time zone, America/Los_Angeles, as set by the project constitution.
- Only one service is active at a time in normal operation. Overlaps are tolerated but not designed for.
- Orders are for pickup during the service; delivery is out of scope.
- Services and menus are created by the manager through the admin; menu and product management screens beyond choosing a menu for a service are out of scope for this feature.
- The pizza count shown is a live count of what remains, after paid orders and pizzas held by open checkouts.
- Existing sample inventory numbers on the home page are replaced by real service data.
- Work spans the server, the admin and the storefront. The first slice to build is the server lookup plus the storefront display (User Stories 1 and 2). Linking orders to services and enforcing stock (FR-006 to FR-008) follows, then the admin menu picker.

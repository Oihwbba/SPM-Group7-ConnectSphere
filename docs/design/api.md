# Server Actions reference

Every command and every server read the pages call, from `app/` on `main`
at commit `d54ed6e` (2026-10-13). There is no REST API: the browser calls
these as Server Actions.

How to read it:

- **Permission** is the `can()` action checked before anything is read or
  written (`lib/auth/can.ts`, ADR 0004).
- **Input** is the Zod schema the input must pass.
- **Writes** are the tables it changes.
- **Locks** are rows locked with `SELECT … FOR UPDATE` in its transaction,
  which is how two people acting at once are kept apart. A weaker lock is
  named in brackets.

Sign-in and sign-out (`lib/auth/actions.ts`) are not in the table: they need
no permission.

When you add or change a Server Action, update its row in the same pull
request.

## `app/(app)/bookings/actions.ts`

| Action | What it does | Permission | Input | Writes | Locks |
|---|---|---|---|---|---|
| `checkVenueAvailability` | Checks whether a venue is free for a period, and names any clashes, including being outside its opening hours (SCRUM-50, SCRUM-34 AC7). | `booking:request` | `venueAvailabilityQuerySchema` (lib/schemas/booking.ts) | nothing (read only) | — |
| `submitBookingRequest` | The Coordinator requests a venue for their event (SCRUM-50); refused outside the venue's opening hours (SCRUM-34 AC7). | `booking:request` | `bookingRequestSchema` (lib/schemas/booking.ts) | Booking | — |
| `decideBookingRequest` | Venue Staff approve or reject a pending request, or approve or reject a held one before it expires (SCRUM-53, 163). Approving a hold keeps it Held, records who approved it and when, and tells its Coordinator (SCRUM-163 AC7, SCRUM-124 AC4). Approving either is refused outside the venue's opening hours (SCRUM-34 AC7). | `booking:decide` | `bookingDecisionSchema` (lib/schemas/booking.ts) | AuditLog, Booking, Notification | Event row (`FOR KEY SHARE`), when approving a hold |
| `holdBookingRequest` | Venue Staff hold a pending request until a deadline, with a note for the Coordinator (SCRUM-163); refused outside the venue's opening hours, as approving is (SCRUM-34 AC7). | `booking:hold` | `bookingHoldSchema` (lib/schemas/booking.ts) | AuditLog, Booking, Notification | Event row (`FOR KEY SHARE`) |
| `confirmHold` | The assigned Coordinator confirms a live hold Venue Staff have approved, which makes the booking Approved (SCRUM-163 AC3); refused outside the venue's opening hours (SCRUM-34 AC7). | `booking:settle-hold` | `holdSettlementSchema` (lib/schemas/booking.ts) | AuditLog, Booking, Notification, SafetyCheck | — |
| `releaseHold` | The assigned Coordinator releases a live hold, which frees the venue (SCRUM-163 AC3). | `booking:settle-hold` | `holdSettlementSchema` (lib/schemas/booking.ts) | AuditLog, Booking, Notification, SafetyCheck | — |
| `withdrawBookingRequest` | The assigned Coordinator withdraws a pending venue request; a held one is released instead (SCRUM-142 AC4). | `booking:withdraw`; a held request also needs `booking:settle-hold` | `bookingWithdrawalSchema` (lib/schemas/booking.ts) | AuditLog, Booking, Notification, SafetyCheck | Event row |

## `app/(app)/equipment-requests/actions.ts`

| Action | What it does | Permission | Input | Writes | Locks |
|---|---|---|---|---|---|
| `createEquipmentRequest` | The Coordinator raises the event's equipment request (SCRUM-27), clearing a No equipment needed decision (SCRUM-170 AC4). | `equipment-request:create` | `createEquipmentRequestSchema` (lib/schemas/equipment-request.ts) | Event, EquipmentRequest, EquipmentRequestLine, EquipmentRequestUpdate | Event row |
| `updateEquipmentRequestStatus` | Technical Support moves a request from Pending Review to In Review, then to Approved or Rejected (SCRUM-28). | `equipment-request:review` | `reviewEquipmentRequestSchema` (lib/schemas/equipment-request.ts) | EquipmentRequest, EquipmentRequestUpdate, Notification | — |
| `suggestAlternativeEquipment` | Technical Support suggests another equipment type on a line (SCRUM-28 AC4). | `equipment-request:review` | `suggestAlternativeSchema` (lib/schemas/equipment-request.ts) | EquipmentRequest, EquipmentRequestLine, EquipmentRequestUpdate, Notification | — |
| `changeEquipmentRequest` | The assigned Coordinator changes an equipment request's lines; it goes back to Technical Support, and changed lines' reservations are released (SCRUM-142 AC1, AC2). | `equipment-request:change` | `changeEquipmentRequestSchema` (lib/schemas/equipment-request.ts) | EquipmentRequest, EquipmentRequestLine, EquipmentRequestUpdate, Notification, Reservation, SafetyCheck | EquipmentRequest row, Event row |
| `withdrawEquipmentRequest` | The assigned Coordinator withdraws a whole equipment request, releasing what it reserved (SCRUM-142 AC3). | `equipment-request:change` | `withdrawEquipmentRequestSchema` (lib/schemas/equipment-request.ts) | EquipmentRequest, EquipmentRequestUpdate, Notification, Reservation, SafetyCheck | EquipmentRequest row, Event row |

## `app/(app)/equipment/actions.ts`

| Action | What it does | Permission | Input | Writes | Locks |
|---|---|---|---|---|---|
| `getAllEquipmentAvailability` | What every equipment type has free over a period (SCRUM-29). | `equipment:read` | `allAvailabilitySchema` (lib/schemas/reservation.ts) | nothing (read only) | — |
| `getEquipmentAvailability` | What one equipment type has free over a period (SCRUM-29). | `equipment:read` | `availabilitySchema` (lib/schemas/reservation.ts) | nothing (read only) | — |
| `getEquipmentSchedule` | One type's reserved and free stock, from a chosen date (SCRUM-29, 30). | `equipment:read` | `equipmentScheduleSchema` (lib/schemas/reservation.ts) | nothing (read only) | — |
| `reserveEquipmentRequest` | Technical Support reserves every line of an approved request, or none (SCRUM-155). | `equipment:reserve` | `requestReservationSchema` (lib/schemas/reservation.ts) | Reservation | Equipment row, EquipmentRequest row, Event row |

## `app/(app)/events/actions.ts`

| Action | What it does | Permission | Input | Writes | Locks |
|---|---|---|---|---|---|
| `createDraftEvent` | The Organiser saves a request as a draft (SCRUM-15). | `event:create` | `createDraftEventSchema` (lib/schemas/event.ts) | Event | — |
| `submitEventRequest` | The Organiser submits a request; a Coordinator is assigned automatically (SCRUM-13, 14, 20). | `event:create` | `submitEventRequestSchema` (lib/schemas/event.ts) | AuditLog, Event, Notification | Event row, advisory lock while a Coordinator is picked |
| `getFormCatalogues` | The venue and equipment suggestions the request form offers, and the accessibility features and layouts venues have, Venue Staff's own included (SCRUM-13, SCRUM-34 AC6). | `event:create` | none | nothing (read only) | — |
| `transitionEventStatus` | A Coordinator approves or rejects a request (SCRUM-19, 24). | `event:review` | `statusTransitionSchema` (same file) | AuditLog, ClarificationRequest, Event | — |
| `confirmEvent` | The assigned Coordinator confirms a Planning event whose checklist is complete (SCRUM-81). | `event:confirm` | `confirmEventSchema` (same file) | AuditLog, Event | Event row |
| `startRequestFromRejected` | The Organiser starts a new Draft from a request rejected as needing a new submission (SCRUM-126). | `event:create` | `startRequestFromRejectedSchema` (same file) | AuditLog, Event | Event row |
| `discardDraftEvent` | The Organiser discards a Draft (SCRUM-130). | `event:discard` | `discardDraftSchema` (same file) | AuditLog, Event | — |
| `rejectPlanningEvent` | The assigned Coordinator rejects a Planning event that can't be fulfilled, releasing its arrangements (SCRUM-117). | `event:reject` | `rejectPlanningEventSchema` (same file) | AuditLog, Booking, EquipmentRequest, EquipmentRequestUpdate, Event, EventChangeRequest, Notification, Reservation | Event row |

## `app/(app)/events/change-request-actions.ts`

| Action | What it does | Permission | Input | Writes | Locks |
|---|---|---|---|---|---|
| `raiseChangeRequest` | The Organiser, or the assigned Coordinator on their behalf, asks to change a submitted event's fields or to cancel it; the event itself doesn't change until the request is decided (SCRUM-41). The assigned Coordinator is told (SCRUM-124 AC7). | `change-request:raise` | `raiseChangeRequestSchema` (lib/schemas/change-request.ts) | AuditLog, ChangeRequestField, EventChangeRequest, Notification | Event row |
| `getChangeRequestsForEvent` | An event's change requests, newest first (SCRUM-41 AC6). | `event:read`; the result also says whether the viewer may raise another | an event id | nothing (read only) | — |

## `app/(app)/events/clarification-actions.ts`

| Action | What it does | Permission | Input | Writes | Locks |
|---|---|---|---|---|---|
| `requestClarification` | The Coordinator asks the Organiser a question, naming the fields the answer may change (SCRUM-18, 108). | `clarification:request` | `requestClarificationSchema` (lib/schemas/clarification.ts) | ClarificationRequest, Notification | Event row |
| `getClarificationForEvent` | The event's current clarification thread (SCRUM-18). | `clarification:request` or `clarification:respond` | an event id | nothing (read only) | — |
| `respondToClarification` | The Organiser answers, with any changes to the named fields (SCRUM-18, 108). | `clarification:respond` | `respondClarificationSchema` (lib/schemas/clarification.ts) | AuditLog, ClarificationRequest, Event, Notification | — |

## `app/(app)/events/equipment-decision-actions.ts`

| Action | What it does | Permission | Input | Writes | Locks |
|---|---|---|---|---|---|
| `recordNoEquipmentNeeded` | The assigned Coordinator records that a Planning event with no live equipment request needs no equipment, completing the checklist's Equipment item (SCRUM-170 AC4). | `event:no-equipment` | `noEquipmentDecisionSchema` (lib/schemas/event.ts) | AuditLog, Event | Event row |
## `app/(app)/events/edit-actions.ts`

| Action | What it does | Permission | Input | Writes | Locks |
|---|---|---|---|---|---|
| `updateEventDetails` | The assigned Coordinator edits an Under Review or Planning event's details (SCRUM-25). In Planning, a change to the date, time, attendance, venue or equipment of an event with live arrangements first returns them for confirmation and saves nothing; once confirmed, the edit and their Needs Reconsideration flags are saved together (SCRUM-25 AC3, SCRUM-26 AC1). A layout, accessibility, date, time or attendance change outdates an Approved or awaiting safety check (SCRUM-166 AC13). | `event:edit` | `eventDetailsEditSchema` (lib/schemas/event-edit.ts) | AuditLog, Booking, Event, Reservation, SafetyCheck | Event row |
| `getOperationalNotes` | An event's operational notes, oldest first, with author and time, and whether the viewer may add one (SCRUM-25 AC6). | `event-note:read` | an event id | nothing (read only) | — |
| `addOperationalNote` | The assigned Coordinator, or Venue Staff or Technical Support once the event has a live booking or an equipment request, adds a permanent note (SCRUM-25 AC6). | `event-note:add` | `operationalNoteSchema` (lib/schemas/event-edit.ts) | EventOperationalNote | — |
| `canEditEventDetails` | Whether the event page offers Edit details (SCRUM-25 AC1). | `event:edit` | an event id | nothing (read only) | — |

## `app/(app)/events/readiness-actions.ts`

| Action | What it does | Permission | Input | Writes | Locks |
|---|---|---|---|---|---|
| `getEventReadiness` | The event's readiness checklist (SCRUM-110, 170). | `event:read`; the result also says whether the viewer may review, reject or confirm, settle or withdraw a venue request, and record No equipment needed | an event id | nothing (read only) | — |
| `getEventArrangements` | A Confirmed event's secured venue, time and equipment (SCRUM-81 AC6). | `event:read` | an event id | nothing (read only) | — |

## `app/(app)/events/registration-actions.ts`

| Action | What it does | Permission | Input | Writes | Locks |
|---|---|---|---|---|---|
| `registerForEvent` | An Attendee registers for a Confirmed event with places left (SCRUM-73, 74). | `registration:create` | `registerForEventSchema` (lib/schemas/registration.ts) | Registration | Event row |
| `withdrawRegistration` | An Attendee withdraws their registration (SCRUM-74, 77). | `registration:withdraw` | `withdrawRegistrationSchema` (lib/schemas/registration.ts) | Registration | Event row |

## `app/(app)/notifications/actions.ts`

| Action | What it does | Permission | Input | Writes | Locks |
|---|---|---|---|---|---|
| `markNotificationRead` | A user marks one of their own notifications read (SCRUM-48). | `notification:read` | `markNotificationReadSchema` (lib/schemas/notification.ts) | Notification | — |

## `app/(app)/venues/actions.ts`

| Action | What it does | Permission | Input | Writes | Locks |
|---|---|---|---|---|---|
| `createVenue` | Venue Staff add a venue with its opening hours for each day (SCRUM-34 AC3–AC5). | `venue:manage` | `venueSchema` (lib/schemas/venue.ts) | AuditLog, Venue, VenueOpeningHours | — |
| `updateVenue` | Venue Staff edit a venue. If it would stop a future Pending, Held or Approved booking fitting, the first save warns, listing the bookings, and writes nothing; saving again with those bookings confirmed saves it and flags them Needs Reconsideration (SCRUM-34 AC6, AC10–AC12; SCRUM-26). | `venue:manage` | `venueUpdateSchema` (lib/schemas/venue.ts) | AuditLog, Booking, Venue, VenueOpeningHours | Venue row (`FOR UPDATE`) |
| `retireVenue` | Venue Staff retire a venue. If it has future Pending, Held or Approved bookings, the first attempt warns, listing them, and writes nothing; retiring again with them confirmed retires it and flags them Needs Reconsideration, cancelling none (SCRUM-34 AC8, AC11; SCRUM-26). | `venue:manage` | `venueRetireSchema` (lib/schemas/venue.ts) | AuditLog, Booking, Venue | Venue row (`FOR UPDATE`) |

## `app/(app)/venues/availability/actions.ts`

| Action | What it does | Permission | Input | Writes | Locks |
|---|---|---|---|---|---|
| `recordUnavailability` | Venue Staff record that a venue is unavailable (SCRUM-37). Over bookings, it first returns the affected bookings unsaved; sent again confirming them, it saves the period and flags them Needs Reconsideration (SCRUM-161). The same period and reason again saves nothing (AC6). | `unavailability:record` | `recordUnavailabilitySchema` (lib/schemas/unavailability.ts) | VenueUnavailability, Booking (flag only), AuditLog, Notification | Affected events (`FOR KEY SHARE`), then affected bookings (`FOR UPDATE`), then the Venue row (`FOR NO KEY UPDATE`) |

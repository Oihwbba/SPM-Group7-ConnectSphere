# ADR 0007 — Lock an equipment pool while calculating and creating a reservation

> **Status: amended on 2026-10-05 by the last addendum.** The lock still
> stands, but `createReservation` no longer exists: equipment is reserved only
> from an approved request (`reserveEquipmentRequest`, SCRUM-155 and 156),
> which locks the event, then the request, then the equipment rows in id
> order.

## Context

SCRUM-31 reserves a quantity from a shared equipment pool for a time period.
Overlapping reservations are valid until their combined quantities exceed the
pool, so a database exclusion constraint cannot express the rule. The story
also explicitly requires that two Technical Support Staff members competing
for the final unit cannot both succeed.

Availability must deduct confirmed overlapping reservations and scheduled
equipment unavailability. As elsewhere in ConnectSphere, periods are
half-open: an existing reservation ending exactly when another starts does not
overlap it.

## Decision

`createReservation` runs inside a Prisma transaction and obtains
`SELECT … FOR UPDATE` on the selected `Equipment` row before calculating
availability or inserting a `CONFIRMED` reservation. It then sums only rows
where `startAt < requestedEnd` and `endAt > requestedStart`, plus overlapping
maintenance/unavailability, and rejects a request that exceeds the remaining
quantity.

The browser converts its `datetime-local` values to UTC ISO instants before
calling the server action. This preserves the Technical Support user's chosen
time rather than letting a zone-less value be interpreted differently by the
server.

## Alternatives rejected

- **Check availability and insert without a lock.** Two concurrent requests
  can both observe the final unit and over-allocate the pool.
- **An exclusion constraint.** It can reject every overlap, but this domain
  permits overlapping reservations while their summed quantity fits the pool.
- **Use total quantity only.** That ignores confirmed reservations and
  maintenance periods, producing incorrect availability.

## Consequences

- Only one competing reservation can consume the final available unit.
- Reservations that merely touch at their endpoints are accepted.
- Reservation writes for the same equipment type are serialised briefly; this
  is a deliberate trade-off for correctness.

---

## Addendum (2026-09-19) — Independent date/time controls, Singapore wall-clock conversion, and live feedback (PR #46)

### Context

Following the initial backend pool-locking implementation in SCRUM-31, PR #46 addressed critical user interaction, validation, and timezone edge cases:
1. Native `datetime-local` inputs coupled date and time selection, forcing arbitrary default start/end times when users only wished to pick a date.
2. Selecting past dates or past times on the current day was not blocked in real time on the client.
3. Availability feedback lacked intermediate states: entering a quantity of `0` falsely showed positive green confirmations, while stock exhaustion lacked prominent warning feedback.
4. Clients in different local timezones suffered drift when local date inputs were converted to UTC instants without explicitly locking to Singapore wall-clock time (`Asia/Singapore`).
5. Layout reflows and dynamic height recalculations caused visual flickering and GPU layout shifts during rapid user selections.

### Decision

1. **Independent visual date and time pill controls.** Separated start and end inputs into distinct visual pill controls with full keyboard accessibility. Date selection does not force an arbitrary default time, allowing users to specify both independently.
2. **Real-time past-bound prevention.** Added real-time minimum constraints on both date and time pickers to immediately disallow past dates, as well as past hours/minutes when the current day is selected.
3. **Tri-state live availability feedback.**
   - Quantity `0`: displays a neutral prompt asking the user to enter a quantity of at least 1.
   - Quantity within available pool: displays a positive confirmation badge with remaining stock.
   - Quantity exceeding available pool: displays an explicit red warning banner, immediately disabling submission.
4. **Singapore wall-clock conversion (`utcToSgWallTime` / `parseSingaporeDateTime`).** Standardized wall-clock calculations across both event creation and equipment reservation forms (`lib/datetime.ts`). All inputs are converted with respect to Singapore (`UTC+8`) so client browser timezone variations cannot skew the reserved period.
5. **Layout stabilization.** Enforced solid card backgrounds and fixed container min-heights across the reservation controls and live inventory grid, eliminating layout thrashing and rendering flicker.

### Consequences

- Equipment reservation form provides immediate, foolproof feedback before requests hit the server action.
- Dates and times remain strictly aligned to Singapore time regardless of client location.
- 100% unit and Playwright E2E coverage validates all interaction paths and error bounds.

---

## Addendum (2026-10-05) — Reserving from an approved request, and one lock order everywhere (SCRUM-155, SCRUM-156)

### Context

SCRUM-155 reserves every line of an approved equipment request in one step,
and SCRUM-156 makes that the only way to reserve: the one-type form now only
checks availability, and `createReservation` was removed. A request has
several lines, so one reservation now locks several `Equipment` rows. It also
runs beside two other actions that lock the same rows in a different order:
rejecting a Planning event (SCRUM-117) locks the event and then its requests,
and confirming an event (SCRUM-81) locks the event. Two transactions that take
the same rows in opposite orders can deadlock, and Postgres then cancels one.

### Decision

1. **One lock order for every action that touches an event's arrangements:**
   the `Event` row first, then the `EquipmentRequest` row, then the
   `Equipment` rows in id order (`ORDER BY "id" FOR UPDATE`). Taking the event
   first also stops the event being confirmed or rejected while it is being
   reserved for.
2. **All or nothing.** Every line is checked against the pool, reservations
   and maintenance under those locks before anything is written; if any line
   is short, nothing is reserved.
3. **What is still to reserve is judged per line** (`outstandingLines` in
   `lib/equipment/requests.ts`). A line counts as reserved only through
   confirmed reservations made for that request, or made with the old
   one-type form, that span the whole event. The listing and the action share
   this rule, and the action reads it under the locks.

### Consequences

- The same request can't be reserved twice, and two requests racing for the
  last unit can't over-allocate it, whatever order their lines are in
  (TC-155-07, TC-155-08).
- Reserving can't deadlock with rejecting the same event (TC-155-15), and
  confirming takes the event first too.
- A new action that locks any of these rows must take them in the same order.

## Addendum (2026-10-25) — The venue edit takes the venue first, and retries a deadlock (SCRUM-202)

### Context

SCRUM-34's venue edit and retirement (`updateVenue`, `retireVenue` in
`app/(app)/venues/actions.ts`) lock the `Venue` row first, so two edits can't
judge the bookings against a venue the other is changing, and then flag the
bookings the change affects. Approving or holding a booking (SCRUM-53,
SCRUM-163) locks the event, then the booking, then the venue
(`lockedVenueTimes`, since SCRUM-160), and flagging a booking inserts
notifications that take a key-share lock on its event (SCRUM-124). So an edit
and an approval of a booking at that venue, at the same moment, take the same
rows in opposite orders. Postgres aborts one as a deadlock (40P01), and the
venue actions had no retry, so Venue Staff got an unhandled error. Found by
the GLM review of #213 and the PO's review of #195.

### Decision

The venue edit and retirement keep their order and run once more on a
deadlock (`onceMoreOnDeadlock`, `lib/db-errors.ts`), as the booking actions
already do.

**Alternative rejected:** taking the rows in this ADR's order (each affected
booking's event, then the booking, then the venue). The edit only knows which
bookings it affects after reading the venue's current values under its lock,
so it would have to read, lock the events and bookings, lock the venue, and
then read again in case a new request arrived in between. That is a large
change to two actions for a case Postgres already resolves safely.

### Consequences

- Nothing is ever half-written: the aborted attempt rolls back, and the retry
  judges the bookings as the approval left them. A booking it now affects
  that Venue Staff weren't shown makes the edit warn again (SCRUM-34 AC10).
- The venue edit and retirement are the one exception to "a new action takes
  the rows in the same order" above; both are covered by a forced deadlock
  and a real race in `tests/integration/venue-edit-deadlock.test.ts`
  (TC-202-02, TC-202-03).

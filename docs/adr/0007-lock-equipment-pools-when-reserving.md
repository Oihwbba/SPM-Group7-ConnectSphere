# ADR 0007 — Lock an equipment pool while calculating and creating a reservation

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

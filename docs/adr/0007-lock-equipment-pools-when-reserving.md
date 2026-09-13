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

# ADR 0003 — Bookings and reservations carry their own times

Stories: SCRUM-26 (flagging arrangements a change affects). SCRUM-44, named
here when this was written, was never built; SCRUM-26 and SCRUM-128 carry its
work.

## Context

A `Booking` links an `Event` to a `Venue`, and a `Reservation` links an
`Event` to `Equipment`. Both are about a period of time. The obvious modelling
choice is to store the time once, on the `Event`, and read it through the
relation whenever a booking or reservation needs it — never duplicating data.

But the domain has a specific, graded requirement: when an event's date or time
changes after arrangements have been made, the customer wants those existing
arrangements to be **visibly out of sync** so a coordinator can review them
(the "Event Change Requests" and "Event Information Management" core features).
If the times are always read from the event, a booking silently follows the
event's new date and the "this arrangement predates the change" signal is lost.

## Decision

`Booking` and `Reservation` each store their own `startAt` and `endAt`,
copied from the event at the time the booking/reservation is made. They are
deliberately denormalised.

When an event's time changes, dependent bookings and reservations keep their
original times. A feature can then compare `booking.startAt` against
`event.startAt` and flag the mismatch for a human to resolve — exactly the
workflow the customer described.

## Alternatives rejected

- **Always join to `Event` for times.** Normalised and DRY, but it makes it
  impossible to tell that a booking was arranged against an earlier version of
  the event. It designs out the very signal the customer asked for.
- **An event-version/history table.** A full temporal model would also solve
  it, but it is far more machinery than a first release needs, and every
  feature developer would have to understand it. Rejected as over-engineering
  for the current requirements.

## Consequences

- Detecting "out of date" arrangements is a simple field comparison, not a
  historical reconstruction.
- The duplication is real: the same time can appear on an event and its
  booking. This is intended, and the mismatch is a feature, not a bug — but it
  must be documented (here) so nobody "fixes" it by joining to the event.
- Booking-conflict checks (a later feature) read `Booking.startAt`/`endAt`
  directly, which is also where the denormalised times help.

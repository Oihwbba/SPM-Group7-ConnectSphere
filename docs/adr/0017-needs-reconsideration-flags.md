# ADR 0017 — Needs Reconsideration is a flag the Coordinator resolves, never a status

## Context

When an event changes under its arrangements (a new date, more attendees, a
venue closed for repairs, a safety check asking for changes), its venue
bookings and equipment reservations may no longer fit. The customer said
staff decide offline and the Coordinator updates the system, and Week 7
change 2 says affected bookings are identified, never silently removed.
SCRUM-26 calls this Needs Reconsideration. Seven other stories raise it
(SCRUM-25, 128, 34, 160, 161, 32 and 166), so the rule has to be one shared
piece, not seven copies.

SCRUM-172 already added the columns: `needsReconsideration`, when it was
raised, why, and who resolved it and when, with CHECKs that a raised flag has
a reason and a resolution has both who and when.

## Decision

1. **A flag, on top of the status, not a status.** A flagged Approved booking
   is still Approved (AC2). So it keeps blocking its venue, and a flagged
   reservation keeps its stock (AC4), with no change to the double-booking
   constraint, the occupancy triggers or equipment availability, which all
   read the status. Flagging updates only the flag columns; the booking
   trigger fires on status, time, venue and minutes, so a flag never takes
   the venue lock.
2. **One helper raises it, `flagArrangements` in lib/reconsideration.ts.**
   Each flag source calls it inside its own transaction with a reason, for
   all of an event's arrangements or for the ones named (a safety check's
   picks, the bookings unavailability falls on). It writes only live rows
   (Pending, Held or Approved bookings, Confirmed reservations) and never the
   status or period (AC6, AC11). A row already flagged keeps its first reason.
3. **Only the assigned Coordinator resolves it**, through a new permission,
   `arrangement:reconsider`, with the same relationship rule as confirming
   (AC7). `resolveReconsiderationFlag` locks the event row first, as
   confirming does, so a resolution and a confirm take turns.
4. **Still stands re-checks the arrangement against the event as it is now**
   (AC8): it covers the event's period, the venue is active, the attendance
   fits the event and the venue, and the occupied period is clear of other
   bookings and unavailability (the same `findVenueBlockers` as a request,
   minus itself). A reservation must still add up to what the live requests
   need, the readiness checklist's rule. A refusal says why.
5. **Cancel is a conditional update** on the row still being flagged and
   live, so it releases the venue or stock exactly once (AC9). If the event
   was Confirmed it returns to Planning (AC10), and an Approved or awaiting
   safety check becomes Outdated, as SCRUM-166 AC13 asks whenever a booking
   or reservation changes.
6. **The readiness checklist reads the flag** (AC12): a flagged live
   arrangement makes its item "Needs reconsideration" with the reason, so the
   event can't be confirmed. The Organiser sees the state, not the reason.
7. **Approval refuses a flagged Pending request** (AC5) in the same
   conditional update that checks it is still Pending, so a flag raised after
   the request was read still stops it.

## Alternatives rejected

- **A NEEDS_RECONSIDERATION status.** Every rule that reads Approved or
  Confirmed (the exclusion constraint, the triggers, availability, the
  checklist, confirmation) would need it added, and a flagged booking would
  stop blocking the moment one was missed. The story says the status doesn't
  change.
- **Moving or cancelling arrangements automatically when the event moves.**
  AC6 and AC11 forbid it: a new period may not be free, and staff decide.
- **A separate "flags" table.** It would allow several reasons per row, but
  the columns already exist (SCRUM-172) and one open reason is enough for the
  Coordinator to act; Still stands re-checks everything regardless of why.

## Consequences

- Nothing raises a flag yet. Each source story calls `flagArrangements` when
  it is built; SCRUM-25's edit form also uses `impactfulChanges` and
  `flaggableArrangements` for AC1's warning.
- SCRUM-163's Hold and Confirm-hold actions must refuse a flagged booking the
  same way approval does (AC5).
- A second flag on a row already flagged keeps the first reason. If a source
  needs every reason kept, it should add an audit entry or move flags to
  their own table.
- Notifications on raising and resolving are SCRUM-124's.

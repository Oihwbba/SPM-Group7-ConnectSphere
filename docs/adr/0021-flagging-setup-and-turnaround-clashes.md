# ADR 0021 — A longer setup or turnaround flags the bookings it makes clash; it moves none

## Context

SCRUM-159 gives each venue a setup and turnaround time, and each booking
copies them when it is held or approved (AC8), so a later change to the
venue's times doesn't move any booking, and the database's no-double-booking
constraint keeps holding. Week 7 change 1 says bookings that "become
problematic under the new rule should be identified rather than silently
removed". SCRUM-160 decides what "problematic" means and what happens to
those bookings.

## Decision

1. **A clash is judged with the new times.** When Venue Staff lengthen a
   time, every Approved or live Held booking at the venue that hasn't started
   is measured with the new minutes; one already under way keeps its own.
   Where two occupied periods overlap, or one overlaps recorded
   unavailability, that is a clash (`lib/venue-time-clashes.ts`). Shortening
   can't create one, so it isn't checked (AC6).
2. **Shown first, flagged on confirmation.** `changeVenueTimes` returns the
   clashes unsaved; sent again with `confirmed`, it saves the times and flags
   the clashing bookings in the same transaction (AC1, AC2). The booking's
   status, times and copied minutes are left alone, so the database still
   sees no double booking, and the Coordinator resolves the flag (SCRUM-26).
3. **The booking that took the venue later is flagged.** That is the earlier
   of when it was held and when it was approved, or, for a seeded booking
   with neither, when it was requested. If that booking has already started,
   the other is flagged, since only one that hasn't started can be dealt with.
4. **Each clash is recorded in the booking's history** (`AuditLog`,
   `RECONSIDERATION_FLAGGED`, the other booking or unavailability in
   `newValue`). That is how a booking is never flagged twice for the same
   clash, even after its flag is resolved (AC7), and how Venue Staff see what
   each flagged booking clashes with (AC5), with no new table.
5. **Approval and the change take turns.** Approving a booking now reads the
   venue's minutes under the same row lock (`FOR NO KEY UPDATE`) the occupancy
   trigger takes, and so does the change. A booking approved during a change
   either copies the new minutes or is already Approved when clashes are
   looked for. Using the trigger's own lock mode means two approvals never
   deadlock upgrading it.

## Alternatives rejected

- **Copy the new minutes onto existing bookings.** It would move what was
  agreed (SCRUM-159 AC8), and the database would refuse every booking that
  then overlapped.
- **Refuse a change that creates a clash.** The customer wants the bookings
  identified, not the change blocked.
- **A table of clashes.** The audit log already records who did what to a
  booking; one more kind of entry covers AC5 and AC7 without a migration on
  the shared database.
- **Flag both bookings of a clash.** Only one has to move or be cancelled,
  and AC2 names the later one.

## Consequences

- The edit form is SCRUM-34's. Until it exists, `changeVenueTimes` is
  reached only through its tests; the form calls it and shows the returned
  clashes before asking to confirm.
- A Coordinator who decides a flagged booking still stands (SCRUM-26) is
  checked against the booking's own minutes, so it passes; whether to keep
  it is their call, as the customer asked.
- Holding a booking must take the same lock once holds are on this branch
  (SCRUM-163).

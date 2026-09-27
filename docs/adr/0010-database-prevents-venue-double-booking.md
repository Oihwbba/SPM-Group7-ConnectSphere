# ADR 0010 — The database, not the application, prevents a venue being double-booked

## Context

Double-booked venues are the customer's top complaint, and SCRUM-53 makes the
hardest case explicit: two members of Venue Staff approve overlapping requests
for the same venue at the same moment, and exactly one may succeed. A pending
request blocks nobody, so the rule only bites at approval.

The obvious implementation is to check for an overlapping approved booking and
then write the approval. That fails under real simultaneity. Both approvals run
their check before either has written, both see a free venue, and both write.
No amount of care in application code closes that gap, because the gap sits
between two separate statements.

## Decision

We let PostgreSQL refuse the second approval. The `Booking` table carries an
exclusion constraint, `booking_no_double_booking`, which says no two rows with
the same `venueId` and status `APPROVED` may have overlapping
`tsrange(startAt, endAt, '[)')` periods. The `[)` bounds are the same
half-open rule as `lib/period.ts`, so a booking ending at 4pm and one starting
at 4pm do not conflict in either place.

The approval action still checks first. That gives staff a clear message
naming the clash in the ordinary case, and it also covers recorded
maintenance, which lives in another table. When two approvals race past the
check, the constraint rejects whichever commits second, and the action reports
it as "Conflicting". Occasionally Postgres resolves the race as a deadlock
instead of a constraint error, because each approval is left waiting on the
other's uncommitted row. So the action retries once, and the retry sees the
winner.

## Alternative rejected: an advisory lock per venue

We already lock the equipment row for reservations (ADR 0007), and an advisory
lock on the venue id would work in the same way. We rejected it because a lock
only protects code that remembers to take it. A future feature, a script or a
manual SQL fix that writes an approved booking without the lock could still
double-book. The exclusion constraint holds however the row is written. The
integration test proves this by approving through raw SQL with no application
code involved. Equipment cannot use a constraint, because overlapping
reservations there are legal until their summed quantity exceeds the pool.
That is why the two decisions differ.

## Consequences

- A venue can never hold two overlapping approved bookings, whatever the code path.
- Pending requests may overlap freely; staff choose between them.
- The losing approval stays pending, so staff can reject it with a reason.
- Maintenance periods are enforced by the application check, not the
  constraint. A maintenance period recorded at the same instant as an
  approval could slip through. Recording unavailability arrives with
  SCRUM-37, and that story should revisit this.
- The constraint needs the `btree_gist` extension, which Supabase provides.

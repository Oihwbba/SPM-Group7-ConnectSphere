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

---

## Addendum (2026-09-28) — The maintenance gap is closed (SCRUM-37)

### Context

The consequence above left one path unguarded. An approved booking and a
recorded maintenance period live in two tables, and an exclusion constraint
only sees one. So an approval and a maintenance record written at the same
instant could both pass the application's check and both be saved, leaving a
venue booked and closed at once. SCRUM-37 asks that recording unavailability
never silently overrides a booking, so this is the sprint to close the gap.

### Decision

Two triggers now guard the venue, one on each table. Approving a booking, or
recording unavailability, first locks that venue's row, then refuses the write
if the other table already holds an overlapping period. Recording
unavailability also refuses an overlap with a period already recorded. The
overlap test uses the same half-open `[)` ranges as the constraint and
`lib/period.ts`, so touching periods still do not clash.

The lock is what makes this hold under simultaneity. Two writes for the same
venue now take turns: the second waits for the first to commit, then sees it
and is refused. The lock is `FOR NO KEY UPDATE`, the weakest that makes them
take turns, so an ordinary pending request, which only references the venue,
is never held up. A refusal is raised as an exclusion violation naming the
rule, so the application reports it exactly as it reports a double booking.

### Alternatives rejected

- **One shared table for bookings and unavailability,** under a single
  exclusion constraint. It is the tidiest guarantee, but it would restructure
  the booking model and its migration a sprint after they were accepted.
- **Leave it to the application and document the gap.** The application check
  is still there, for the message it gives staff, but a check alone cannot
  close a race, which is the reason this ADR exists.

### Consequences

- A venue can never be both booked and unavailable for the same moment,
  whatever the code path. A forced race on real Postgres (both writes past
  the application's check together) saves exactly one, and disabling the
  triggers makes that test fail.
- Writes that make one venue unavailable are serialised for a moment. That is
  the same trade-off ADR 0007 makes for equipment, and it only affects one
  venue at a time.
- Unlike the constraint, the triggers do not check rows that already existed;
  they guard every write from now on. Existing data was checked for clashes
  before the migration and none were found.

## Addendum (2026-10-08) — Occupied periods, holds, and unavailability over bookings (SCRUM-172)

Week 7 changes what the database must guarantee. Four stories each change a
rule: a booking now occupies its venue for its setup and turnaround time too
(SCRUM-159), a tentative Held booking blocks the venue until its expiry
(SCRUM-163), unavailability can be recorded over bookings, which are flagged
rather than refused (SCRUM-161), and an event can book several venues
(SCRUM-162). The rules were rewritten once, in the SCRUM-172 migration
`20261008120000_week7_schema_and_booking_rules`, so the four stories build on
one set of rules instead of each editing the same constraints.

### Decision

- **Occupied periods.** A booking stores the setup and turnaround minutes it
  was held or approved with, and occupies
  `[startAt − setupMinutes, endAt + turnaroundMinutes)`, computed by the
  immutable function `booking_occupied_period`. Storing the minutes on the
  booking, not reading the venue's, is SCRUM-159 AC8: a later change to the
  venue's times doesn't move a booking; SCRUM-160 finds the clashes it
  creates. Existing bookings have 0 and 0, so nothing they satisfied changes.
- **`booking_no_double_booking`** keeps its name and is now over occupied
  periods of Approved **and Held** bookings. Keeping the name means the
  application recognises the refusal unchanged.
- **`booking_overlaps_unavailability`** (the trigger) compares the booking's
  occupied period with recorded unavailability, for Approved and Held.
- **Unavailability may overlap bookings** (SCRUM-161 AC1). The trigger on
  `VenueUnavailability` now refuses only overlapping unavailability. It still
  takes the venue lock, so an approval and an unavailability record for one
  venue still take turns, and each sees the other (SCRUM-161 AC7).
- **`booking_one_per_venue_per_event`** replaces `booking_one_venue_per_event`:
  an event has at most one Pending, Held or Approved booking per venue, not
  per event (SCRUM-162 AC2).
- **An expired hold stops blocking without anyone acting** (SCRUM-163 AC4).
  A row stays `HELD` until something writes it, and a constraint can't read
  the clock. So before checking any Pending, Held or Approved write at a venue,
  the booking trigger marks that venue's holds whose `holdExpiresAt` has passed
  as `EXPIRED`. A lapsed hold therefore never blocks a request, a hold or an
  approval, while a hold that hasn't expired still does. Showing a lapsed hold
  as Expired before anything is written there is the application's job
  (SCRUM-163).
- **A lapsed hold can't be confirmed.** The same trigger refuses setting a
  Held booking to Approved once its expiry has passed, as
  `booking_hold_expired`, whether or not anything has marked it Expired yet
  (SCRUM-163 AC4 and AC8: Approved or Expired, never both).

### Alternatives rejected

- **Read the venue's minutes in the constraint.** An EXCLUDE constraint can
  only index the row's own columns, and reading the venue's current minutes
  would move existing bookings whenever the venue changed, which SCRUM-159 AC8
  forbids.
- **Leave expired holds in the constraint and expire them with a scheduled
  job.** The app has no scheduler (SCRUM-48 AC8 and SCRUM-124 AC5 avoid one on
  purpose), and until the job ran a lapsed hold would refuse requests the
  customer says should succeed.
- **Keep refusing unavailability over a booking in the database.** SCRUM-161
  replaces that behaviour; leaving it would force the story to rewrite these
  rules again.

### Consequences

- Recording unavailability over an approved booking is no longer refused by
  the database. Until SCRUM-161 saves it and flags the booking, SCRUM-37's
  action keeps the refusal itself: it takes the venue lock, then checks, then
  writes, in one transaction, so an approval can't land between the check and
  the write. The SCRUM-37 race test still saves exactly one.
- One venue per event (SCRUM-50 AC8) is now held by the action's check alone;
  the database holds one per venue. Two simultaneous requests for the same
  event at two different venues could both be saved. SCRUM-162 makes that the
  intended behaviour.
- Any Pending, Held or Approved write at a venue may also mark that venue's
  lapsed holds Expired, in the same transaction. Those booking rows are locked
  before the venue row. Today nothing takes the venue lock and then writes
  booking rows, so the two orders can't deadlock; SCRUM-161, which will flag
  bookings while holding the venue lock, has to keep that in mind.

## Addendum (2026-10-12) — The application compares occupied periods too (SCRUM-159)

### Context

The SCRUM-172 rules compare occupied periods, but the application's own
check (`findVenueBlockers`, used by the request form, a request, an approval,
the Venue Staff queue and recording unavailability) still compared booked
periods, and nothing copied a venue's minutes onto a booking. So every booking
kept 0 and 0, and the database's occupied periods were the booked periods.

### Decision

- **One helper, `occupiedPeriod`, in lib/venue-availability.ts**, computes
  `[startAt − setup, endAt + turnaround)` exactly as `booking_occupied_period`
  does. Callers ask `findVenueBlockers` about the period as it would occupy
  the venue: a request or approval with the venue's current minutes, recorded
  unavailability as it is.
- **Each approved or held booking counts for its own stored minutes.** Its
  occupied period can't be filtered in a Prisma `where`, so the lookup loads
  Approved bookings and Held ones whose hold hasn't expired within
  `MAX_SETUP_TURNAROUND_MINUTES` (1,440, the database's bound) either side,
  then keeps those whose occupied period overlaps. Nothing further away can
  reach the period. A hold past its expiry is left out even while its row
  still says Held, as the database expires it before checking.
- **Approving copies the venue's minutes onto the booking**, the same minutes
  the conflict check used, in the conditional update (AC8). A hold (SCRUM-163)
  must copy them the same way.
- **A refusal names the whole occupied time**, "…, including setup and
  turnaround", so the times shown explain it.

### Alternatives rejected

- **Compute occupied periods in SQL with `$queryRaw`.** It would reuse
  `booking_occupied_period` exactly, but the lookup is shared by five callers
  and their unit tests, which mock Prisma's typed client; a raw query would
  replace typed reads for a filter that a one-day window plus `overlaps`
  already gets right.
- **Read the venue's current minutes for existing bookings.** That would move
  approved bookings when a venue's times change, which AC8 forbids.

### Consequences

- The database stays the guarantee for simultaneous approvals (AC5); the
  application's check now agrees with it, so a request the database would
  refuse is refused earlier, with a readable message.
- The availability calendar loads bookings a day either side of the week, so
  setup or turnaround reaching into the week is drawn.

# ADR 0019 — Events complete on the next read after they end, not by a scheduled job

## Context

SCRUM-82 closes events two ways. The assigned Coordinator **cancels** an event
that won't go ahead, which must release everything held for it, because the
customer's problem is that "cancelled events may continue to occupy venue or
equipment reservations". And a Confirmed event that has finished must show as
**Completed** "everywhere from that moment" (AC7).

The app has no scheduler: the graders run it on their own machines, and
deployments go through GitHub Actions. Hold expiry (SCRUM-163) already solves
the same problem by acting when something next touches the data.

## Decision

1. **Cancelling is one transaction** that locks the event row, as confirming
   and rejecting do, then sets the event Cancelled with the reason, who and
   when, and releases everything in the same transaction (AC3): bookings,
   holds and pending requests; reservations, whose stock returns to the pool;
   open equipment requests; a safety check awaiting review becomes Outdated;
   registrations are cancelled; submitted change requests are rejected with
   the reason. A repeat cancel finds the event already Cancelled and changes
   nothing (AC4). It is SCRUM-117's release, widened to Week 7's holds and
   safety checks, and to registrations, since a cancelled event may have
   Attendees.
2. **Reject refuses an event with registrations** as well as one ever
   Confirmed (AC5), so it is cancelled instead.
3. **Completion is lazy.** `completeFinishedEvents` runs as the Events, event
   detail and My Registrations pages load. One `UPDATE … WHERE status =
   'CONFIRMED' AND endAt < now RETURNING id` decides which rows changed, so
   two pages loading at once complete each event once and write one history
   entry for it (AC8). The strict `<` keeps an event Confirmed at exactly its
   end (AC7), and only Confirmed rows match, so a Cancelled event never
   completes (AC9).
4. **Overdue is computed, not stored** (AC10): an event still Submitted, Under
   Review or Planning whose start has passed. It is shown beside the status in
   the Coordinator's list and changes nothing.

## Alternatives rejected

- **A scheduled job (cron, Vercel Cron, a GitHub Actions schedule).** It only
  runs on the deployment, not on a grader's machine, and between runs a
  finished event would still read as Confirmed.
- **Computing Completed on the fly without saving it.** Every query that
  filters on status (Attendees' browse list, registration, the Coordinator's
  tabs) would need the same time check, and AC7 asks for the status to be
  saved.
- **A COMPLETED check per event in each query.** It would scatter the rule
  across every reader; one helper run at the top of the pages keeps it in one
  place.

## Consequences

- A finished event stays Confirmed in the database until someone opens one of
  those pages; nothing reads it in between, so nobody sees the difference.
- SCRUM-128, which applies an Organiser's approved cancellation request (AC2),
  should call the same cancellation.
- The Lead's queue (SCRUM-165) can show overdue requests with the same
  `isOverdue` rule.

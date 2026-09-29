# ADR 0011 — An event's readiness checklist is computed on demand, per viewer

SCRUM-110 (the checklist), consumed by SCRUM-81 (the Confirm action).

## Context

The customer's rule is short: "Approved means there is enough information to
start planning. Confirmed means the essential arrangements are complete."
SCRUM-110 turns "essential arrangements are complete" into a checklist the
Coordinator sees on the event page: **Venue booking**, always, and
**Equipment**, when equipment was requested. When every item is complete the
checklist says **Ready to confirm**, which is what enables SCRUM-81's Confirm
action. The Organiser sees the same items and states, without internal
reasons.

The story was first written as a hidden business rule and rewritten in Jira on
30 Sep 2026 as this checklist. The rewrite dropped the reconsideration-flag
criteria (they belong with the impactful-change stories, SCRUM-43/44) and
changed equipment from "a confirmed reservation exists" to "every requested
line is reserved in full for the event's period".

The records the checklist reads are owned by other stories: venue bookings
(SCRUM-50/53), equipment requests (SCRUM-27/28) and reservations (SCRUM-31).
Approving an equipment request does not reserve anything; Technical Support
reserve separately, and a reservation is not linked to a request line. Several
cases are not settled by the criteria, so this ADR settles them.

## Decision

`getReadinessChecklist(db, eventId)` in `lib/event-readiness.ts` builds the
checklist from the event's records in one read and returns
`{ ready, items }`. Each item has a name, whether it is complete, a state, an
internal reason (or none) and, for equipment, one line per requested item such
as "Projector 3/5 reserved". It never writes, and it takes the database client
as a parameter, so SCRUM-81 can call it inside the transaction that confirms.

`getEventReadiness(eventId)` in `app/(app)/events/readiness-actions.ts` serves
it to the event page. The viewer must be related to the event through
`can(…, "event:read")`, the Organiser who owns it or its Coordinator. A viewer
who can also `event:review` it, the Coordinator, gets the reasons; the
Organiser gets `withoutInternalReasons(…)`. Anyone else gets "Event not found.",
the same answer as a missing event (SCRUM-68).

Where the criteria are silent:

1. **The venue item reads as the most advanced booking.** Any approved booking
   completes it. Otherwise a pending booking shows "Pending"; otherwise the
   latest rejection shows "Rejected – _reason_"; otherwise "Not requested".
   After a rejection the Coordinator books again, so the newer booking is what
   matters. Cancelled bookings are ignored.
2. **Which equipment requests count.** Pending, in-review and approved requests
   are live, and their lines are added up per item (two live requests for 2 and
   3 Projectors need 5). A cancelled request is no longer wanted. A rejected
   request is replaced by the Coordinator's next one; if it is the only
   request, the Equipment item shows "Rejected" and stays incomplete, because
   the equipment is still wanted but not arranged.
3. **"Reserved in full for the event's period."** A reservation counts towards
   a line only if it is confirmed, is for the requested item, and spans the
   whole event, from its start to its end. Such reservations are added up, so
   3 + 2 Projectors cover a line of 5. A reservation for part of the day does
   not count at all: the event needs the equipment for all of it. An event with
   no dates cannot have equipment reserved in full.
4. **Only a Planning event can be ready to confirm.** The items are computed
   for any event, but `ready` also requires the Planning status, and the page
   shows the checklist only on Planning events.
5. **Status filtering happens in code, not in the query.** The rule fetches the
   event's bookings, requests and reservations with their statuses and filters
   them in TypeScript. An event has only a handful of these rows, and this way
   every rule is exercised by the unit tests, which replace the database. (The
   first version filtered registrations in the query, and a review showed no
   test could catch that filter being removed.)

**Open question for the PO:** Technical Support can suggest an alternative item
for a request line (SCRUM-28). This rule counts only reservations of the
requested item, so a line covered by the alternative still shows as short.
If the alternative should count, that is a small change to decision 3.

## Alternatives rejected

- **Store readiness on the event**, updated whenever a booking, request or
  reservation changes. Every write in four other stories would have to
  remember to update it, and a missed update would show the wrong checklist.
  Computing it from the records cannot drift.
- **Count part-period reservations in proportion**, or at their busiest
  instant. A projector reserved for the morning does not serve the afternoon
  session, so it cannot make the line complete.
- **Return only true or false.** The Coordinator needs to know what is
  missing, and SCRUM-81's "the outstanding items are listed" would push each
  caller to re-derive the reasons.
- **Hide the reason in the component.** The Organiser's browser would still
  receive it. Removing it on the server keeps it out of the response.

## Consequences

- SCRUM-81 imports `getReadinessChecklist` for its Confirm check and uses
  `ready`; the event page already shows the items it will list when Confirm is
  unavailable. Neither re-implements the rules.
- Changing what counts as complete is a change to one file and its tests
  (`tests/unit/event-readiness.test.ts`, specified in
  `docs/testing/SCRUM-110.md`).
- The checklist is always current, at the cost of one read each time the
  event's details open.
- The rule takes no locks. SCRUM-81 must re-check readiness inside the
  transaction that confirms and make the status change conditional (as the
  gate in ADR 0006 does), so an arrangement cancelled at the same moment
  cannot leave a wrongly confirmed event.
- Decisions 2 and 3 rest on reservations not being linked to request lines. If
  a later story links them, the rule should match reservations to lines
  directly.

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
`{ ready, items }`. Each item has a name, whether it is complete, a state and
an internal reason (or none). It never writes, and it takes the database client
as a parameter, so SCRUM-81 can call it inside the transaction that confirms.

`getEventReadiness(eventId)` in `app/(app)/events/readiness-actions.ts` serves
it to the event page. The viewer must be related to the event through
`can(…, "event:read")`, the Organiser who owns it or its Coordinator. A viewer
who can also `event:review` it, the Coordinator, gets the reasons; the
Organiser gets `withoutInternalReasons(…)`. Anyone else gets "Event not found.",
the same answer as a missing event (SCRUM-68).

Where the criteria are silent:

1. **The venue item reads as the most advanced booking, for the event's
   time.** An approved booking completes it only if it covers the whole event.
   Bookings keep their own times (ADR 0003), so after an event moves, its old
   booking no longer secures the venue. Otherwise a pending booking shows
   "Pending"; otherwise an approved booking for another time shows "Approved
   for a different time"; otherwise the latest rejection shows "Rejected –
   _reason_"; otherwise "Not requested". After a rejection or a move the
   Coordinator books again, so the newer booking is what matters. Cancelled
   bookings are ignored. (Added after review of #101: the criteria say only
   "a venue booking for this event is Approved", but counting a booking for
   the wrong day would let a moved event read as ready, and equipment already
   has to cover the event's period.)
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

## Addendum (2026-10-03)

SCRUM-110 AC 4 was simplified with the PO: the Equipment item no longer lists
one line per requested item ("Projector 3/5 reserved"). It shows only Reserved,
Not fully reserved or Rejected. When stock is short, Technical Support rejects
the request rather than reserving part of it, so the per-item count added
little. The completeness rule is unchanged: a partial reservation still leaves
Equipment incomplete (AC 3), because nothing yet stops one being made.

## Addendum (2026-10-04)

The PO changed SCRUM-110 AC 4 again after testing: with only "Not fully
reserved", a Coordinator could not tell what was missing (a laptop had been
reserved where a projector was requested). The Equipment item now names the
items not reserved in full, without counts, e.g. "Not fully reserved:
Projector, Laptop", in the order they were requested. Counts stay out, as on
3 Oct; the completeness rule is unchanged.

## Addendum (2026-10-11) — Corrections from the docs audit (SCRUM-173)

Context says the reconsideration-flag criteria belong with "the
impactful-change stories, SCRUM-43/44". Neither is in the backlog any more:
SCRUM-43 was merged into SCRUM-41 and SCRUM-128, and SCRUM-26 and SCRUM-128
carry SCRUM-44's work (ADR 0003). The flags belong to SCRUM-26 now. The
checklist itself is unchanged.

## Addendum (2026-10-12) — a request awaiting re-check blocks Confirm (SCRUM-142 AC10)

SCRUM-142 lets the Coordinator change an equipment request's lines before
the event is confirmed. Removing a line sends the request back to Pending
Review for Technical Support to re-check, but leaves the other lines
reserved, so under decisions 2 and 3 the event read as ready, and could be
confirmed before the re-check. Technical Support could then reject a request
whose stock a Confirmed event still held. SCRUM-142 AC 10 (decision 1 of the
PO's 12 Oct review, for the PO to confirm) closes that gap: Equipment is
complete only when every requested line is reserved in full and every live
request is Approved. A Pending or in-review request whose lines are all
reserved shows "Awaiting Technical Support review"; one with a line not
reserved in full still names it ("Not fully reserved: …"), as before.
Decision 2 still decides which requests count, and decision 3 how
reservations are matched.

## Addendum (2026-10-14) — Equipment is always listed; No equipment needed (SCRUM-170 AC4)

SCRUM-170 AC 4 supersedes SCRUM-110 AC 3: an event with no equipment request
no longer drops the Equipment item. With no live request, the item shows
"Not decided" and is incomplete until the assigned Coordinator either creates
a request or records **No equipment needed**, which completes it and keeps who
and when (`Event.noEquipmentNeededAt` and `noEquipmentNeededById`, which the
CHECK `event_no_equipment_decision_complete` keeps set or cleared together).
A rejected request still shows "Rejected", and the decision is offered there
too. Otherwise an event whose equipment was simply never thought about could be
confirmed, which is the gap SCRUM-166 AC 1 relies on closing.

A decision and a live request never stand side by side. Creating a request
clears the decision, and recording the decision is refused while a live
request exists. Both actions lock the event row first, so when they happen at
the same moment one waits for the other. Changing the event's equipment
requirements also clears it (SCRUM-25 for a direct edit; SCRUM-128 and
SCRUM-26 for a change request). Decisions 2 to 5 are unchanged.

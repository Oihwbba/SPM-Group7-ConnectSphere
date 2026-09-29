# ADR 0011 — One read-only rule decides when an event is ready to confirm

SCRUM-110 (the rule), consumed by SCRUM-81 (Planning → Confirmed).

## Context

The customer's definition is short: "Approved means there is enough
information to start planning. Confirmed means the essential arrangements are
complete." SCRUM-110 turns "essential arrangements are complete" into a rule,
and says it must be the single authoritative definition: no other story may
add its own confirmation gate. SCRUM-81 owns the status change itself, and
SCRUM-43 can send a Confirmed event back to Planning after an impactful
change, after which the rule must be met again.

The arrangements the rule looks at are owned by other stories and teammates:
venue bookings (SCRUM-50/53), equipment requests (SCRUM-27/28), reservations
(SCRUM-31) and the "needs reconsideration" flags an impactful change sets
(SCRUM-44). So the rule has to be readable by all of them, and it has to
settle several questions the acceptance criteria leave open.

## Decision

`getConfirmationReadiness(db, eventId)` in `lib/event-readiness.ts` is the
rule. It reads the event and its arrangements in one query and returns
`{ ready, gaps }`, where `gaps` lists **every** outstanding item, in a fixed
order, rather than stopping at the first: `NOT_IN_PLANNING`,
`NO_APPROVED_VENUE_BOOKING`, `NO_CONFIRMED_EQUIPMENT_RESERVATION`,
`UNRESOLVED_RECONSIDERATION`. It never writes, and it takes the database
client as a parameter, so SCRUM-81 can call it inside the transaction that
changes the status. That transaction, not this rule, is responsible for
making the check and the write atomic.

Where the criteria are silent, the rule decides as follows:

1. **Only a Planning event can be ready.** The story defines readiness for a
   Planning event. An Approved event is not yet planning, and a Confirmed one
   is already confirmed, so both report `NOT_IN_PLANNING`, alongside any
   other gaps so the Coordinator can see what is still missing.
2. **A venue booking is always required, and the Organiser's venue
   requirement is not read** (AC 5). Any booking for the event with status
   APPROVED satisfies it, so a rejected booking followed by an approved one
   is ready.
3. **A rejected equipment request still needs equipment.** Only a
   _cancelled_ request stops blocking. A rejection means Technical Support
   could not provide what was asked, not that the event no longer needs it.
   The Coordinator either cancels the request or gets equipment reserved.
4. **Any confirmed reservation for the event satisfies AC 2.** Reservations
   made through SCRUM-31 are not linked to a request, and approving a request
   (SCRUM-28) does not create reservations, so the rule cannot match
   reservations to request lines one to one.
5. **A reconsideration flag is resolved when it is cleared, or when the
   flagged record leaves play**: a booking cancelled or rejected, a
   reservation cancelled, a registration withdrawn or cancelled. This follows
   the customer's ruling that nothing is auto-cancelled; staff decide offline
   and the Coordinator records the decision, which may be a cancellation. A
   flag on a record still in play (a pending or approved booking, a confirmed
   reservation, a registered attendee) blocks confirmation.

## Alternatives rejected

- **Store a readiness flag on the event**, updated whenever a booking,
  reservation or flag changes. Every one of those writes, in four other
  stories, would have to remember to update it, and a missed update would
  silently confirm or block the wrong event. Computing it on demand from the
  records themselves cannot drift.
- **Return only true or false.** SCRUM-81 needs to tell the Coordinator what
  is missing, and a single boolean would push each caller into re-deriving
  the reasons, which is the competing gate AC 9 forbids.
- **Treat a rejected equipment request as "no equipment needed".** It would
  let an event be confirmed without the equipment the Organiser asked for,
  purely because Technical Support could not supply it.
- **Require a reservation for every line of the request.** It would be
  stricter, but reservations carry no link to request lines today, so the
  rule would have nothing to match on. If a later story links them, this
  rule should tighten.

## Consequences

- SCRUM-81, SCRUM-43 and any future screen showing outstanding arrangements
  import this function; none of them re-implements a readiness check.
- Changing what "ready" means is a change to one file and its tests
  (`tests/unit/event-readiness.test.ts`, specified in
  `docs/testing/SCRUM-110.md`).
- Readiness is always current, at the cost of one read per check. The read
  fetches only flagged registrations, so a large event stays cheap.
- Because the rule does not lock anything, SCRUM-81 must still make the
  status change conditional (as ADR 0006's gate does), so an arrangement
  cancelled between the check and the write cannot leave a wrongly confirmed
  event.
- Decisions 3 and 4 depend on how equipment requests and reservations relate
  today. If equipment reservations become linked to requests, revisit them.

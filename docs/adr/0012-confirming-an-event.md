# ADR 0012 — Approval moves an event to Planning; the assigned Coordinator confirms it

SCRUM-81, using SCRUM-110's readiness checklist (ADR 0011) and the status gate
of ADR 0006.

## Context

The customer's rule: "Approved means there is enough information to start
planning. Confirmed means the essential arrangements are complete." SCRUM-81,
rewritten in Jira on 30 Sep 2026, asks for three things:

- Approving a request makes the event show as **Planning**, with the approval
  (who, when) in its history.
- On a Planning event whose readiness checklist is complete, the event's
  **assigned** Coordinator can **Confirm** it. Confirming records who confirmed
  it and when. Anyone else is refused, and a repeat confirm changes nothing.
- The Organiser of a Confirmed event sees its confirmed venue, date/time and
  reserved equipment.

Until now, approval left an event in Approved with no way forward, so no
newly requested event could ever reach Confirmed or be seen by Attendees.

## Decision

**Approval.** `transitionEventStatus` still accepts only APPROVED or REJECTED
(ADR 0006). An approval now saves the event as **PLANNING** in the same
conditional update, and writes two history entries in the same transaction:
the Coordinator's approval (Submitted or Under Review → Approved) and the
system's move (Approved → Planning, no actor). The event's `decidedById` and
`decidedAt` record who approved it and when. Approved is never persisted on
its own; the history shows the event passed through it.

**The approver becomes the coordinator of an unassigned request.** A
Coordinator may decide a submitted request nobody was assigned to (SCRUM-19).
Because only an event's assigned Coordinator may confirm it (AC 7), such an
event would otherwise reach Planning with nobody able to confirm it. Approving
it therefore assigns the approver, recorded as an ASSIGNED history entry. A
rejection assigns nobody.

**Confirming.** `confirmEvent` sits beside `transitionEventStatus` in
`app/(app)/events/actions.ts`, the same single gate for status changes, and
follows the same pattern:

1. `requirePermission(…, "event:confirm")`, then `can(…, "event:confirm",
event)`. The new `event:confirm` capability is granted to Coordinators, and
   its relationship check is stricter than review's: only the Coordinator
   **assigned** to the event, never any Coordinator looking at an unassigned
   request. Anyone unrelated gets "Event not found." (SCRUM-68).
2. In one transaction: lock the event row (`SELECT … FOR UPDATE`), re-read its
   status and coordinator, then re-check readiness with SCRUM-110's
   `getReadinessChecklist` under the lock, as ADR 0011 requires. Only then set
   CONFIRMED and write one history entry (Planning → Confirmed) carrying the
   confirming Coordinator as actor. The entry's timestamp is the time.
3. If the event is already Confirmed, report success and write nothing (AC 8).
   A double-click, or a confirm from a tab opened earlier, therefore records
   one confirmation. Two simultaneous confirms take turns on the lock, and the
   second finds the event already Confirmed.
4. Refusals change nothing: not ready (the message names the outstanding
   items), not in Planning, or reassigned while the request waited.

**The Confirm action on the page** is a button under the readiness checklist.
It is shown only to the assigned Coordinator (the checklist response carries
`canConfirm`), is disabled until the checklist is complete, and disappears
once the event is Confirmed, when the checklist gives way to the confirmed
arrangements. The server checks all of this again, since hiding a button is
not access control.

**Confirmed arrangements** are read by `getConfirmedArrangements` in
`lib/event-readiness.ts`, with the same whole-event rule as the checklist: the
newest approved booking that covers the event (as the checklist's venue item reads the newest first), the event's date and time, and the
confirmed reservations covering the whole event, totalled per item. Its
Organiser and Coordinator see them on the event's details.

**Reservations for Planning events.** Venue bookings and equipment requests
already accepted Planning events. Reserving equipment (SCRUM-31) accepted only
Approved events, which no event stays in any more, so it now accepts Approved
and Planning (`RESERVABLE_EVENT_STATUSES`).

## Alternatives rejected

- **Save Approved, then move to Planning in a second step.** Another write, and
  a moment where the event is Approved with nobody moving it on. The history
  already records the pass through Approved.
- **Confirm automatically as soon as the checklist is complete.** The story
  gives the Coordinator a Confirm action and records who confirmed, which
  matches the customer briefing ("the Event Coordinator confirms the event").
  It also avoids every arrangement story having to trigger confirmation.
- **Add `confirmedAt` and `confirmedById` columns.** The history entry already
  records who and when, and a schema change would need a migration and a
  standup announcement for no extra information.
- **Refuse a repeat confirm with an error.** The first confirm succeeded, so an
  error would tell the Coordinator something went wrong when it didn't.
- **Leave unassigned approved events without a coordinator.** They could never
  be confirmed.

## Consequences

- Every approved event now enters Planning, and the booking, equipment-request
  and reservation stories all accept it there.
- Tests that expected Approved after approval now expect Planning:
  `tests/unit/event-status.test.ts`, `e2e/events.spec.ts` and the decision race
  in `tests/integration/concurrency.test.ts`, which now counts decisions (the
  entries leaving Submitted) rather than all history entries, since an
  approval writes more than one.
- The seeded Approved event (`evt_approved`) still demonstrates the Approved
  badge (SCRUM-23), though new events no longer stay in that status.
- SCRUM-43 will move a Confirmed event back to Planning after an approved
  impactful change; the same checklist and Confirm action then apply again.
- Notifying the Organiser of the confirmation is left to the notification
  stories, which the customer's notification ruling covers; SCRUM-81's
  criteria do not ask for it.

## Amendment, 3 Oct 2026

SCRUM-81's criteria were renumbered on 1 Oct (a new AC 2 moved the later
criteria up by one; the numbers above are current), and AC 5 now also opens registration
when the event is confirmed. Step 2 sets `registrationEnabled` in the same
update as the status, so a confirmed event can take registrations (SCRUM-73)
without any seed data. It is set to true unless the event's
`registrationRequired` is explicitly false: the Organiser's Registration
needed choice belongs to SCRUM-127 and is not on the form yet, so every
request made so far leaves it unset, and those events should open. When
SCRUM-127 lands, a No keeps registration closed with no change here.

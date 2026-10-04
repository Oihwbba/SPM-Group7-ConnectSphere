# ADR 0015 — Rejecting a Planning event releases its arrangements in one transaction

SCRUM-117. It uses the rejection outcome of SCRUM-126 (ADR 0013) and sits
beside SCRUM-81's Confirm on the readiness checklist (ADR 0011, ADR 0012).

## Context

The customer: "If essential requirements cannot be fulfilled, the event gets
rejected rather than sitting pending indefinitely." Until now an event could
only be rejected while Submitted or Under Review (SCRUM-19); once approved
into Planning, a Coordinator who couldn't find a venue had no way to close it.
SCRUM-117 asks that the assigned Coordinator can reject a Planning event that
was never Confirmed, with a reason and an outcome, releasing everything held
for it, and that an event which was ever Confirmed is cancelled instead
(SCRUM-82), because Attendees may have registered.

## Decision

1. **A separate action, `rejectPlanningEvent`**, rather than widening
   `transitionEventStatus`. The two rejections release different things (a
   request holds nothing; a Planning event holds bookings and stock), and
   ADR 0006's single gate keeps the request decision simple.
2. **A new permission, `event:reject`,** with the same rule as `event:confirm`:
   only the event's assigned Coordinator, never any Coordinator looking at an
   unassigned event.
3. **One transaction, after locking the event row.** Status, reason and
   outcome are written, then the event's Pending and Approved bookings,
   Confirmed reservations and open equipment requests are cancelled, and its
   submitted change requests are rejected with the same reason. Cancelling a
   reservation is what returns its stock, since availability counts only
   Confirmed reservations. A confirm or reject at the same moment takes turns
   on the lock and sees the other's result.
4. **"Ever Confirmed" is read from the history**: SCRUM-81 writes a
   Planning → Confirmed entry on every confirmation, so a count of those
   entries answers it without a new column.
5. **Reject sits on the readiness checklist**, next to Confirm, the screen
   where the Coordinator sees what can't be arranged. The checklist response
   carries `canReject`, so the button is only offered when the server would
   accept it; the server checks again.
6. **History and notice.** The status change, the outcome and a summary of
   what was released are recorded by the Coordinator; the Organiser is
   notified with the reason.

## Alternatives considered

- **Extend `transitionEventStatus` to Planning.** It would mix two different
  sets of side effects into the one gate.
- **A `confirmedAt` column.** Another column to keep in step, when the history
  already records every confirmation.
- **Mark the arrangements for reconsideration instead of cancelling them**
  (SCRUM-26). A rejected event no longer needs them, and holding them would
  keep venues and stock from other events.

## Consequences

- When SCRUM-128/SCRUM-26 can send a Confirmed event back to Planning, its
  history already makes Reject unavailable, as AC 4 requires.
- Rejected requests and Planning events share the outcome rule; the database
  refuses either without one (ADR 0013).

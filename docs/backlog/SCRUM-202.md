<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-21. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-202 - Bug: A venue edit can deadlock with a simultaneous booking decision or event edit

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-202 |

---

Two Sprint 3 reviews found the same lock-order problem around SCRUM-34's venue edit (`updateVenue` / `retireVenue` in `app/(app)/venues/actions.ts`):

1. **#213 (SCRUM-124), GLM Medium:** `flagArrangements` (`lib/reconsideration.ts`) updates booking and reservation rows, then inserts notifications whose `eventId` foreign key takes a key-share lock on the Event row. The venue actions flag bookings without locking their events first, so their order is booking → event, the reverse of the event → booking order the booking actions use (ADR 0007). A Coordinator action that locks the event and then writes the same booking can deadlock with a venue edit flagging it.
2. **#195 (SCRUM-160), PO review (GLM was at its weekly limit):** approving or holding a booking now locks the booking and then the venue (`lockedVenueTimes` in `app/(app)/bookings/actions.ts`), while `updateVenue` locks the venue and then the bookings it flags. An approval and a venue edit at the same venue at the same moment can deadlock.

In both cases Postgres aborts one transaction (40P01), so no data is corrupted. But the venue actions have no `onceMoreOnDeadlock` retry, so the user gets an unhandled error.

**Acceptance criteria**

1. The venue edit and retirement actions retry once on a deadlock (`onceMoreOnDeadlock`, as the booking actions do), or take their locks in the same order as the booking and event actions.
2. An integration test runs a venue edit that flags a booking at the same moment as an approval (or a Coordinator's event edit) of that booking, and both end in a defined outcome with no unhandled error.
3. ADR 0007's lock order is updated if the order changes.

Found in Sprint 3; moved to the backlog at sprint close for the next sprint's PO to assign and estimate. Related: SCRUM-34, SCRUM-124, SCRUM-160, SCRUM-26.

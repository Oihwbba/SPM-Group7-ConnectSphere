<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-30. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-32 - Modify or Cancel Reservation

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-10 - Equipment Management |
| **Priority** | Medium |
| **Story points** | 3 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-32 |

---

* User Story: As a Technical Support Staff member, I want to modify or cancel equipment reservations, so that I can adapt to changing event requirements and free up equipment when needed.
* Acceptance Criteria:
    * Given a reservation exists, when I modify the quantity, then the system updates availability for the affected time periods.
    * Given I increase a reservation's quantity beyond what is available for any part of the period, when I save, then the change is rejected and the shortfall is shown.
    * Given I set a reservation's quantity to zero or a negative number, when I save, then the change is rejected and the quantity is reported as invalid - cancelling is a separate action.
    * Given a reservation exists, when I cancel it, then the equipment quantity is fully restored to the available pool.
    * Given a reservation has already been cancelled, when it is cancelled again, then nothing changes and no additional quantity is returned to the pool.
    * Given I modify dates/times, when the new period overlaps other reservations, then the system warns me and prevents the save.
    * Given the new period only touches another reservation at an endpoint, when I save, then the change is accepted - periods that touch do not overlap.
    * Given I cancel a reservation, when I confirm, then the associated Event Coordinator is notified.
    * Given I make changes, when I save, then an audit trail is created showing what changed, who made the change, and the timestamp.


‌

Note (2026-09-07): double-cancellation, quantity validity and endpoint semantics were added following the Week 2 assignment feedback. Double-cancellation matters here specifically because each cancellation returns quantity to the pool - repeating it would inflate availability.

Functionality Area: Equipment Reservation

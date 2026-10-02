<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-02. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-29 - Check equipment availability

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-10 - Equipment Management |
| **Priority** | Highest |
| **Story points** | 3 |
| **Status in Jira** | In Review |
| **Sprint** | SCRUM Sprint 2 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-29 |

---

**User story:** As a Technical Support Staff member, I want to check whether enough suitable equipment is available for a specific date and time, so that I can tell whether an equipment request can be fulfilled.

**Acceptance criteria**

1. Given I specify an equipment type, date and time range, when I check availability, then the system shows the quantity available for the whole period.
2. Given the requested quantity is at or below the available quantity for the whole period, then the equipment is reported as available and can be reserved (SCRUM-31).
3. Given the requested quantity exceeds the available quantity, then the shortfall is shown and the reservation is prevented.
4. Quantities already reserved for an overlapping period are excluded from the available quantity. Equipment requests that haven't been reserved don't reduce it.
5. Given a reservation ends exactly when my period begins, or begins exactly when it ends, then that quantity counts as available: periods that only touch at an endpoint do not overlap.
6. Quantities recorded as unavailable (Damaged or Under maintenance) for an overlapping period are excluded from the available quantity. In Release 1 these records come from seed data.
7. Given a quantity of zero or less, or an end time not after the start, then the check is rejected as invalid and no result is shown.

**Change log**

* 2026-09-07: endpoint semantics, the accepted side and input validation added after the Week 2 assignment feedback.
* 2026-10-01 (mid-sprint correction, no new scope): unavailability described as a quantity over a period.
* 2026-10-01 (audit): AC2–AC4 say reservations again, matching the merged code (the earlier 1 Oct text said Approved items hold stock). Unavailability records come from seed data, because equipment catalogue maintenance (SCRUM-119) is beyond Release 1.

Functionality Area: Equipment Availability Checking

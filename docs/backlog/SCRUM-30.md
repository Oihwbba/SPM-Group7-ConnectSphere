<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-07. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-30 - View equipment conflicts

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-10 - Equipment Management |
| **Priority** | Medium |
| **Story points** | 3 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 2 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-30 |

---

**User story:** As a Technical Support Staff member, I want to see which equipment is already committed to other events, so that I can spot conflicts and make informed decisions about new requests.

**Acceptance criteria**

1. Given I select an equipment type, then I see all its current and future commitments: reservations and recorded unavailability, each with its period and quantity.
2. Given a requested period, then commitments that overlap it are listed under "Commitments during requested period", and all others, including those that only touch the period at an endpoint, are listed under "Other commitments" and are left out of the availability calculation.
3. Given overlapping commitments still leave enough stock for the requested quantity, then they are shown as availability-affecting but not highlighted.
4. Given overlapping commitments leave less stock than the requested quantity, then the result is highlighted in red as a conflict and the shortfall is shown.
5. Two commitments where one ends exactly when the next begins are shown as adjacent, not as conflicting.
6. Given recorded unavailability, then I see its reason (e.g. Damaged, Under maintenance), quantity and period.
7. Given the type has no commitments in the period I'm viewing, then it is shown as fully available rather than as an empty list.

**Change log**

* 2026-09-07: touching-endpoint and no-commitment cases added after the Week 2 assignment feedback; rule matches SCRUM-29 and SCRUM-31.
* 2026-10-01 (mid-sprint correction, no new scope): merged two duplicate "exceeds available" criteria into AC4. SCRUM-55 (equipment calendar) was merged into this story and is closed.
* 2026-10-01 (audit): AC1 says reservations again, matching the code (the earlier 1 Oct text said Approved items). SCRUM-119 references removed: it is beyond Release 1 and unavailability records come from seed data.

Functionality Area: Equipment Availability Checking

<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-30. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-30 - View Equipment Conflicts

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-10 - Equipment Management |
| **Priority** | Medium |
| **Story points** | 2 |
| **Status in Jira** | In Progress |
| **Sprint** | SCRUM Sprint 2 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-30 |

---

* User Story: As a Technical Support Staff member, I want to see which equipment is already committed to other events, so that I can identify conflicts and make informed decisions about new requests.
* Acceptance Criteria:

    * Given I am viewing equipment, when I select a specific item, then I can see a list of all current and future reservations.
    * Given I view commitments for the requested period, when existing commitments overlap the requested period but the requested quantity can still be fulfilled, then they are shown as availability-affecting commitments and are not highlighted in red.
    * Given two reservations for the same equipment touch at an endpoint - one ends exactly when the next begins - when I view them, then they are shown as adjacent and are NOT highlighted as conflicting.
    * Given I check conflicts for a requested period, when overlapping commitments cause the requested quantity to exceed the available quantity, then the system flags this as a hard conflict.
    * Given I view equipment status, when it's marked unavailable, then I can see the specific reason (e.g., Maintenance, Damaged) and the duration of unavailability.
    * Given a piece of equipment has no reservations or unavailability in the period I am viewing, when I open it, then it is shown as fully available rather than as an empty list.
    * Given I view commitments for the requested period, when the requested quantity exceeds the available quantity, then the system highlights the result in red and shows the shortfall.
    * Given I view commitments for a selected equipment type, when commitments overlap the requested period, then they are shown under “Commitments during requested period”.
    * Given I view commitments for a selected equipment type, when commitments do not overlap the requested period, including commitments that only touch the requested period at an endpoint, then they are shown under “Other commitments” and are not included in the requested-period availability calculation.


‌

Note (2026-09-07): the touching-endpoint and no-conflicts criteria were added following the Week 2 assignment feedback - without them, "overlapping" is open to interpretation and a back-to-back reservation could be shown as a false conflict. The rule matches SCRUM-29 and SCRUM-31.

Functionality Area: Equipment Availability Checking

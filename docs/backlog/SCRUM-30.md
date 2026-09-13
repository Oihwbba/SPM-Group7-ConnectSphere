<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-13. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-30 - View Equipment Conflicts

| | |
|---|---|
| **Epic** | SCRUM-10 - Equipment Management |
| **Priority** | Medium |
| **Story points** | 2 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-30 |

---

* **User Story:** As a Technical Support Staff member, I want to see which equipment is already committed to other events, so that I can identify conflicts and make informed decisions about new requests.
* **Acceptance Criteria:**

    * Given I am viewing equipment, when I select a specific item, then I can see a list of all current and future reservations.
    * Given I view reservations, when there are overlapping time slots for the same equipment, then they are clearly highlighted in red.
    * Given two reservations for the same equipment touch at an endpoint - one ends exactly when the next begins - when I view them, then they are shown as adjacent and are NOT highlighted as conflicting.
    * Given I check conflicts, when equipment is committed to an event with an overlapping time slot, then the system flags this as a hard conflict.
    * Given I view equipment status, when it's marked unavailable, then I can see the specific reason (e.g., Maintenance, Damaged) and the duration of unavailability.
    * Given a piece of equipment has no reservations or unavailability in the period I am viewing, when I open it, then it is shown as fully available rather than as an empty list.
    

‌

**Note (2026-09-07):** the touching-endpoint and no-conflicts criteria were added following the Week 2 assignment feedback - without them, "overlapping" is open to interpretation and a back-to-back reservation could be shown as a false conflict. The rule matches SCRUM-29 and SCRUM-31.

Functionality Area: Equipment Availability Checking

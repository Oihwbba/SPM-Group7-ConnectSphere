<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-13. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-29 - Check Equipment Availability

| | |
|---|---|
| **Epic** | SCRUM-10 - Equipment Management |
| **Priority** | Highest |
| **Story points** | 3 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-29 |

---

* **User Story:** As a Technical Support Staff member, I want to check if sufficient suitable equipment is available for a specific date and time, so that I can confirm whether we can fulfill equipment requests.
* **Acceptance Criteria:**

    * Given I am checking availability, when I specify equipment type, date, and time range, then the system displays the total available quantity.
    * Given the requested quantity is at or below the available quantity for the whole period, when I check availability, then the equipment is reported as available and can proceed to reservation.
    * Given the requested quantity exceeds the available quantity, when I check availability, then the system reports the shortfall and prevents the reservation.
    * Given I check availability, when equipment is already reserved for an overlapping date and time range, then it is excluded from the available quantity.
    * Given an existing reservation ends at exactly the moment my requested period begins, or begins at exactly the moment it ends, when I check availability, then that equipment counts as available - periods that touch at an endpoint do not overlap.
    * Given I check availability, when equipment is marked "Under Maintenance" or "Damaged" for that date, then it is not shown as available.
    * Given I enter a quantity of zero or a negative number, or an end time earlier than the start, when I check availability, then the check is rejected as invalid and no result is shown.
    

‌

**Note (2026-09-07):** endpoint semantics, the accepted-side behaviour and the input-validity rules were added following the Week 2 assignment feedback - "overlaps" needed a stated boundary rule, and a threshold needs observable behaviour on both sides, not only the failure side.

Functionality Area: Equipment Availability Checking

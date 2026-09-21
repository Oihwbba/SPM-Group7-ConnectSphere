<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-21. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-31 - Reserve Equipment for Event

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-10 - Equipment Management |
| **Priority** | Highest |
| **Story points** | 3 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 1 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-31 |

---

* **User Story:** As a Technical Support Staff member, I want to reserve available equipment for an approved event, so that the equipment is secured and not available for other overlapping events.
* **Acceptance Criteria:**

    * Given the requested quantity is at or below the quantity available for the whole period, when I save the reservation, then it is created with status "Confirmed" and availability reduces by exactly that quantity.
    * Given I create a reservation, when I specify the event, then the reservation is permanently linked to that specific event ID.
    * Given the requested quantity exceeds what is available for any part of the period, when I save, then the system prevents over-allocation and shows the shortfall.
    * Given an existing reservation ends at exactly the moment my period begins, or begins at exactly the moment it ends, when I save, then the reservation is accepted - periods that touch at an endpoint do not overlap.
    * Given exactly one unit of an equipment type remains for a period, when two Technical Support Staff members reserve it at the same moment, then only one reservation is accepted and the total reserved never exceeds the pool.
    * Given I enter a quantity of zero or a negative number, when I save, then the reservation is not created and the quantity is reported as invalid.
    * Given a reservation is created, when I view equipment availability, then the reserved quantity is deducted from the total available pool.
    

Functionality Area: Equipment Reservation

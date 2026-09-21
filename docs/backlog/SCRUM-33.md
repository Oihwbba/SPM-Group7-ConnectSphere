<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-21. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-33 - View Event Reservations

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-10 - Equipment Management |
| **Priority** | Medium |
| **Story points** | 2 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-33 |

---

* **User Story:** As an Event Coordinator, I want to view all equipment reservations associated with my event, so that I know what equipment has been secured for my event.
* **Acceptance Criteria:**

    * Given I am an Event Coordinator, when I view my event dashboard, then I can see a list of all reserved equipment.
    * Given I view reservations, when I select an item, then I can see equipment details and technical specifications.
    * Given I view my reservations, when changes are made by Technical Staff, then I can see the current status (Confirmed, Pending, Cancelled).
    * Given my event has no equipment reservations, when I open the list, then an explicit "no equipment reserved" message is shown rather than an empty table.
    

**Customer clarification (2026-09-13) — scope reduced:** _"Export/print are not listed in core features at the moment."_

The fourth criterion previously read _"Given I have reservations, when I need to, then I can export or print a summary list of reserved equipment."_ **It has been removed.** This closes Q10 in the customer Q&A log, which flagged that the export action appeared to cross the Week 4 scope line — the customer has confirmed it does.

It is replaced with an empty-state criterion, so the story still states behaviour on both sides.

If the team wants export later, raise it as a new backlog item rather than reinstating it here.

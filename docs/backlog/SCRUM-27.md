<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-13. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-27 - Create Equipment Request

| | |
|---|---|
| **Epic** | SCRUM-10 - Equipment Management |
| **Priority** | Highest |
| **Story points** | 1 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-27 |

---

* **User Story:** As an Event Coordinator, I want to create an equipment request for my event, specifying equipment type, quantity, and technical requirements, so that the technical support team knows exactly what equipment I need.
* **Acceptance Criteria:**

    * Given I am an Event Coordinator, when I create a new equipment request, then I can link it to a specific event name and date.
    * Given I am creating a request, when I add equipment, then I can select the equipment type from a predefined system list.
    * Given I am adding equipment, when I specify quantity, then the system validates that it is a positive whole number.
    * Given the same equipment type is already on this request, when I add it again, then no duplicate line is created and I am told the type is already on the request.
    * Given I am adding equipment, when I enter technical requirements, then I can provide free-text specifications.
    * Given I have completed the request, when I submit it, then the request is saved with the status "Pending Review".
    * Given this event already has a request pending review, when I submit another, then I am shown the existing request rather than creating a second one for the same event.
    

‌

**Note (2026-09-07):** the two duplicate criteria were added following the Week 2 assignment feedback, which asked what happens when the same thing is submitted twice. The quantity-validation criterion this story already had is exactly what that feedback asked for elsewhere.

Functionality Area: Equipment Request Management

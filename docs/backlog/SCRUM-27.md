<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-02. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-27 - Create an equipment request

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-10 - Equipment Management |
| **Priority** | Highest |
| **Story points** | 2 |
| **Status in Jira** | In Review |
| **Sprint** | SCRUM Sprint 2 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-27 |

---

**User story:** As an Event Coordinator, I want to create an equipment request for my event, specifying equipment type, quantity and technical requirements, so that Technical Support knows exactly what equipment I need.

**Acceptance criteria**

1. Given I am the assigned Coordinator of an event in Planning, when I create an equipment request, then it is linked to that event and shows the event's name, date and time.
2. Given I add equipment, then I choose the type from the equipment catalogue; retired types are not offered.
3. Given I enter a quantity, then it must be a positive whole number; otherwise the line is refused and the quantity is reported as invalid.
4. Given the same equipment type is already on the request, when I add it again, then no duplicate line is created and I am told the type is already on the request.
5. Given I add equipment, then I can enter free-text technical requirements for each line.
6. Given I submit the request, then it is saved with the status Pending Review and its history starts with the submission.
7. Given the event already has a request that is Pending Review or In Review, when I submit another, then no second request is created and I am shown the existing one.
8. Given I open my equipment requests, then I see each request's lines (type, quantity, technical requirements), its status (Pending Review, In Review, Approved, or Rejected with the reason), any alternative Technical Support suggested, and its history, or "No equipment requests yet".

**Related:** Technical Support reviews requests in SCRUM-28 and reserves stock in SCRUM-31. Changing lines before confirmation is SCRUM-142. Pre-filling from the Organiser's equipment choices is SCRUM-127. Technical Support is notified of new requests by SCRUM-124.

**Change log**

* 2026-09-07: the two duplicate criteria were added after the Week 2 assignment feedback.
* 2026-10-01 (mid-sprint correction, no new scope): removed a duplicated "Confirmed → refused" criterion and restated the re-pending rule (withdrawn below).
* 2026-10-01 (audit): restored to the criteria the merged code was built against: the request has one status (Pending Review, In Review, Approved, Rejected) and stock is held by separate reservations (SCRUM-31). The per-item wording is withdrawn. Changing lines before confirmation, which the customer asked for, moved to SCRUM-142. SCRUM-33 (view requests) was merged here, so AC8 states what the Coordinator sees, as built. One code change is needed before acceptance: the merged code also accepts Confirmed events (REQUESTABLE_EVENT_STATUSES in lib/equipment/requests.ts), and AC1 limits requests to Planning because a Confirmed event's details can't change.

Functionality Area: Equipment Request Management

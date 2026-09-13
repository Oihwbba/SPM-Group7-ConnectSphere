<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-13. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-18 - Request clarification or amendments on a submitted request

| | |
|---|---|
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Highest |
| **Story points** | 2 |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 1 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-18 |

---

**As an Event Coordinator**, I want to send a request for clarification or amendment back to the Event Organiser, so that I get the information I need before deciding on their request.

**Acceptance Criteria:**

* Given a submitted request, when the Coordinator requests clarification, then the event **remains in "under review"** and is marked as awaiting the Organiser's response, and the Organiser is notified (see SCRUM-56)
* Awaiting-clarification is a sub-state shown on screen, **not a tenth status value** — the nine values in SCRUM-23 are unchanged
* Organiser can see exactly what the Coordinator is asking for, and can respond or amend their request accordingly
* Given the Organiser responds, when the response is saved, then the clarification is marked answered and the Coordinator can re-review the request
* Given a clarification is already open on an event, when the Coordinator requests another, then no second open clarification is created for the same event

**Customer clarification (2026-09-13) — resolves the open question:** _"Clarification is part of Event Review and Approval. No separate status required; can be sub-state of 'under review' if the team finds that it makes it more clear."_

This settles Q3 in the customer Q&A log. The previous uncertainty — whether "awaiting clarification" should become its own status — is closed in favour of keeping nine statuses and modelling the clarification as its own record against the event.

**INVEST:** Independent (a back-and-forth step that can be built without the final approve/reject decision existing yet); Negotiable (how amendments are structured is open); Valuable (directly named in the briefing: "clarifies requirements" is core to the Coordinator's role); Estimable/Small (one message-and-response loop); Testable (Organiser sees the request; Coordinator sees the response; status stays "under review" throughout).

Functionality Area: Event Review and Approval

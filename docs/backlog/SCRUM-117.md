<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-04. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-117 - Reject an event that can't be fulfilled

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Medium |
| **Story points** | 2 |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 2 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-117 |

---

**User story:** As an Event Coordinator, I want to reject an event in Planning when its essential arrangements can't be secured, so that it doesn't sit pending indefinitely.

**Acceptance criteria**

1. Given an event in Planning that has never been Confirmed, when I reject it with a reason, then its status becomes Rejected and the Organiser sees the reason.
2. The reason is required, and I must choose the outcome (Amend and resubmit, or Submit as a new request) as in SCRUM-126.
3. Rejecting, in the same operation, cancels the venue booking or pending venue request, cancels equipment reservations and returns their stock, cancels any open equipment request, and rejects any Submitted change request with the same reason.
4. Given the event has ever been Confirmed, then Reject is not offered; the Coordinator cancels it instead (SCRUM-82), because Attendees may already be registered.
5. Only the assigned Coordinator can reject (SCRUM-67).
6. The Organiser is notified (SCRUM-45) and the rejection is recorded with who and when.

**Customer basis:** "If essential requirements cannot be fulfilled, the event gets rejected rather than sitting pending indefinitely." "If an event remains incomplete or unfulfilled (e.g., no venue found at all), the request gets rejected."

**Change log**

* 2026-10-01 (story not started): limited to events never Confirmed; added the outcome choice (SCRUM-126) and the change-request rule. The transition is listed in SCRUM-135.
* 2026-10-01 (audit): AC3 names reservations and open equipment requests, matching the built equipment model. SCRUM-126 moved into Sprint 2, since AC2 depends on it.

Functionality Area: Event Review and Approval

<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-13. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-21 - Hand an event over to a different coordinator

| | |
|---|---|
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Medium |
| **Story points** | 2 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-21 |

---

**As an Event Coordinator**, I want to hand an event over to a colleague who has agreed to take it, so that responsibility can shift when availability or workload changes.

**Acceptance Criteria:**

* Given an event has an assigned Coordinator, when that Coordinator initiates a handover and names a colleague, then a pending handover is recorded and the named Coordinator is asked to accept it
* Given a pending handover, when the named Coordinator accepts, then they become the assigned Coordinator and the previous assignment ends
* Given a pending handover that has not been accepted, then the original Coordinator remains the point of contact and remains responsible — the handover is not effective until accepted
* Exactly one Coordinator is assigned at any moment; a pending handover never creates a second assignment
* A record exists of who was previously assigned, who initiated the handover and who accepted it, with timestamps (supports the briefing's auditability requirement: what changed, who changed it, when)
* Both the outgoing and the incoming Coordinator are notified (see SCRUM-57)

**Customer clarification (2026-09-13):** _"Reassignment should be discussed offline. Once there is an agreement, the original co-ordinator can make the change and request the new co-ordinator to accept the change. Detail process and UI implementation is up to the team."_

Two consequences worth stating plainly:

1. The negotiation happens **outside** ConnectSphere. The system does not host a request/approve conversation — it records the handover once the humans have agreed, and captures the new Coordinator's acceptance.
2. This is also the answer to _"can a coordinator decline or withdraw?"_ — there is no decline on initial assignment (SCRUM-20 is automatic); declining is done by handing the event over.

**⚠ Re-estimate before continuing.** Sized at 2 points as a single field update. It now needs a pending-handover state and an acceptance step. Bring it to planning poker.

**INVEST:** Independent (a follow-on to assignment, but a separate testable action); Negotiable (the UI for initiating and accepting is explicitly the team's choice); Valuable (the briefing calls out reassignment "when staff responsibilities or availability change"); Estimable and Small (one pending state, one acceptance, one log entry); Testable (initiate, assert original still responsible; accept, assert it moves).

Functionality Area: Coordinator Assignment

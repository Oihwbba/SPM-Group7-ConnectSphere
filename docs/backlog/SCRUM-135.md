<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-04. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-135 - Refuse any event status change the lifecycle does not allow

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Medium |
| **Story points** | 2 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-135 |

---

**User story:** As an Event Coordinator, I want the system to refuse any status change that the agreed lifecycle doesn't allow, so that every user sees a status that matches what actually happened to the event.

**Acceptance criteria**

1. Given a Draft, when the Organiser submits a valid request, then it becomes Submitted (SCRUM-14).
2. Given a Submitted request, when a Coordinator is assigned, then it becomes Under Review (SCRUM-20).
3. Given a request is Under Review, or Submitted with no Coordinator, when a Coordinator approves it, then it is recorded as Approved and moves to Planning in the same action; a Coordinator who approves an unassigned request becomes its Coordinator (SCRUM-19, SCRUM-81).
4. Given a request is Under Review, or Submitted with no Coordinator, when a Coordinator rejects it with a reason and an outcome, then it becomes Rejected (SCRUM-19, SCRUM-126).
5. Given an event is in Planning and has never been Confirmed, when its Coordinator rejects it because arrangements can't be met, then it becomes Rejected (SCRUM-117).
6. Given a Rejected request whose outcome is Amend and resubmit, when the Organiser resubmits it, then it becomes Submitted and then Under Review with the same Coordinator (SCRUM-108).
7. Given an event in Planning with a complete readiness checklist, when its Coordinator confirms it, then it becomes Confirmed (SCRUM-81, SCRUM-110).
8. Given a Confirmed event, when an approved impactful change request is applied (SCRUM-128) or its Coordinator cancels a flagged booking or reservation (SCRUM-26), then it returns to Planning.
9. Given an event is Under Review, in Planning or Confirmed, when its assigned Coordinator cancels it, then it becomes Cancelled (SCRUM-82).
10. Given a Confirmed event, when its end time has passed, then it becomes Completed (SCRUM-82).
11. Given a request for any other transition, including one made directly through the API, then it is refused, the status doesn't change, and the refusal names the current status.
12. Approved is recorded in the event's history but is never a resting status: no event remains Approved after the approval action completes.
13. Completed and Cancelled are final. Rejected is final unless the Coordinator chose Amend and resubmit (SCRUM-126).
14. Repeating a transition does not create a second history entry or a second notification.
15. Clarification stays a sub-state of Under Review (SCRUM-18), not a status.

**Why this is a new story:** SCRUM-24 (Sprint 1, Done) names SCRUM-43 and SCRUM-83 as owners, but both were merged (into SCRUM-41/SCRUM-128 and SCRUM-82). Transitions were also added later by SCRUM-117 and SCRUM-26, and SCRUM-81 now moves an approved event straight to Planning. Done stories are not reopened, so this story carries the current list and supersedes SCRUM-24's transition list; SCRUM-24's other rules still apply. The same list is in the Confluence page "ConnectSphere Cross-Cutting Requirements Model", section 1.

**Change log**

* 2026-10-01 (audit): the transition table is now one numbered criterion per transition. Added deciding a Submitted request that has no Coordinator, which the code allows (AC3, AC4). Cancelling starts from Under Review, because a Submitted request has no Coordinator to cancel it.

Functionality Area: Event Status Management

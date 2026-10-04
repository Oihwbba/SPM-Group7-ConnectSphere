<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-04. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-108 - Answer a clarification, or amend and resubmit a rejected request

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | High |
| **Story points** | 5 |
| **Status in Jira** | In Progress |
| **Sprint** | SCRUM Sprint 2 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-108 |

---

**User story:** As an Event Organiser, I want to answer my Coordinator's clarification request and, when allowed, amend and resubmit a rejected request, so that I can fix what was raised without starting again.

**Acceptance criteria**

1. Given a Coordinator requests clarification (SCRUM-18), then they can tick which request-form fields I may change in my answer; ticking none means a text answer only.
2. Given my event is Under Review with an open clarification, when I open it, then I see what was asked and can edit only the ticked fields, plus a free-text response.
3. Given I save my response, then the clarification is marked Answered, the event stays Under Review, and the Coordinator is notified (SCRUM-45) and can resume the review.
4. Saving the same response again changes nothing.
5. Fields the clarification doesn't name can only be changed through a change request (SCRUM-41).
6. Given the Coordinator approves or rejects the request, then any open clarification is closed and can no longer be answered.
7. Given my event is Rejected and the Coordinator chose Amend and resubmit (SCRUM-126), then I see an Amend and Resubmit action, and the rejection reason stays visible while I edit.
8. Given the Coordinator chose Submit as a new request, then Amend and Resubmit is not offered.
9. Amending edits the same event; its history is kept.
10. Resubmitting applies the same validation as a first submission (SCRUM-13, SCRUM-14).
11. Given the amended request passes validation, then the event becomes Submitted and then Under Review with the same Coordinator as before; automatic assignment (SCRUM-20) does not run again. If the request was rejected before any Coordinator was assigned, or that Coordinator no longer holds the role, SCRUM-20 assigns one. Rejecting a request nobody was assigned to makes the rejecting Coordinator its coordinator.
12. Resubmitting twice creates no duplicate submission, history entry or notification.
13. Only the event's Organiser can answer or amend (SCRUM-67).
14. Responses, amendments and resubmissions are recorded with who and when.

**Related:** the Sprint 1 code already offers Amend & Resubmit on every rejected request and runs automatic assignment again on resubmission; AC7, AC8 and AC11 change that. The answer's notification (AC3) and closing on a decision (AC6) are already built.

**Customer basis:** "Rejected events may be resubmitted after appropriate changes are made; rejection is not necessarily final." "Only edits via Coordinator and the co-ordinator also decide whether it calls for a new submission." "Organiser cannot directly edit after submission; must request via Coordinator."

**Change log**

* 2026-10-01 (backlog refinement, story not started): clarification edits limited to the named fields; the Coordinator's choice of outcome moved to SCRUM-126; added the same-Coordinator rule; re-estimated from 3 to 5 after the SCRUM-109 merge.
* 2026-10-01 (audit): AC1 adds the Coordinator's side of naming fields, because the clarification built in Sprint 1 is a free-text question with no field list. AC6 states what the code already does when a request is decided. AC11 covers a request rejected before any Coordinator was assigned, which the code allows (SCRUM-135 AC4). Group headings removed. SCRUM-126 moved into Sprint 2 because AC7 and AC8 depend on it.
* 2026-10-04: AC11 makes the rejecting Coordinator the coordinator of an unassigned request, so the rejected request leaves other Coordinators' lists and comes back to them on resubmission (PO decision, raised by Hann Qian).

Functionality Area: Event Review and Approval

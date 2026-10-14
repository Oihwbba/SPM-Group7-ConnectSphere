<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-15. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-135 - Refuse any event status change the lifecycle does not allow

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Medium |
| **Story points** | 3 |
| **Status in Jira** | In Review |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-135 |

---

**User story:** As an Event Coordinator, I want the system to refuse any status change that the agreed lifecycle doesn't allow, so that every user sees a status that matches what actually happened to the event.

**Acceptance criteria**

1. Given a Draft, when the Organiser submits a valid request, then it becomes Submitted (SCRUM-14).
2. Given a Submitted request, when the Lead assigns a Coordinator, then it becomes Under Review (SCRUM-165).
3. Given a request is Under Review, when its assigned Coordinator approves it, then it is recorded as Approved and moves to Planning in the same action (SCRUM-19, SCRUM-81). A Submitted request with no Coordinator can't be approved.
4. Given a request is Under Review, when its assigned Coordinator rejects it with a reason and an outcome, then it becomes Rejected (SCRUM-19, SCRUM-126). A Submitted request with no Coordinator can't be rejected.
5. Given an event is in Planning and has never been Confirmed, when its Coordinator rejects it because arrangements can't be met, then it becomes Rejected (SCRUM-117).
6. Given a Rejected request whose outcome is Amend and resubmit, when the Organiser resubmits it, then it becomes Submitted and then Under Review with the same Coordinator (SCRUM-108), or stays Submitted in the Lead's queue if that Coordinator no longer holds the role (SCRUM-165).
7. Given an event in Planning with a complete readiness checklist, including an Approved safety check (SCRUM-166), when its Coordinator confirms it, then it becomes Confirmed (SCRUM-81, SCRUM-110).
8. Given a Confirmed event, when an approved impactful change request is applied (SCRUM-128) or its Coordinator cancels a flagged booking or reservation (SCRUM-26), then it returns to Planning.
9. Given an event is Under Review, in Planning or Confirmed, when its assigned Coordinator cancels it, then it becomes Cancelled (SCRUM-82).
10. Given a Confirmed event, when its end time has passed, then it becomes Completed (SCRUM-82).
11. Given a request for any other transition, including one made directly through the API, then it is refused, the status doesn't change, and the refusal names the current status.
12. Approved is recorded in the event's history but is never a resting status: no event remains Approved after the approval action completes.
13. Completed and Cancelled are final. Rejected is final unless the Coordinator chose Amend and resubmit (SCRUM-126).
14. Repeating a transition does not create a second history entry or a second notification.
15. Clarification stays a sub-state of Under Review (SCRUM-18), not a status.
16. Neither the safety check (SCRUM-166) nor a reassignment (SCRUM-21) changes the event's status: the safety check is a step within Planning, as clarification is within Under Review.

**Supersedes:** SCRUM-19, SCRUM-69 AC1 and AC4, SCRUM-81 AC2 and SCRUM-108 AC11, where any Coordinator could approve or reject an unassigned request and became its Coordinator. Replaced by SCRUM-165 (Week 7 change 5).

**Customer basis:** G4: "Approval = sufficient info for planning. Confirmation = essential arrangements completed." G4: "Clarification is part of Event Review and Approval. No separate status required; can be sub-state of 'under review' if the team finds that it makes it more clear." Week 7 change 5: "Event Coordinators should only be able to manage events assigned to them."

**Why this is a new story:** SCRUM-24 (Sprint 1, Done) names SCRUM-43 and SCRUM-83 as owners, but both were merged (into SCRUM-41/SCRUM-128 and SCRUM-82). Transitions were also added later by SCRUM-117 and SCRUM-26, and SCRUM-81 now moves an approved event straight to Planning. Done stories are not reopened, so this story carries the current list and supersedes SCRUM-24's transition list; SCRUM-24's other rules still apply. The same list is in the Confluence page "ConnectSphere Cross-Cutting Requirements Model", section 1.

**Change log**

* 2026-10-01 (audit): the transition table is now one numbered criterion per transition. Added deciding a Submitted request that has no Coordinator, which the code allows (AC3, AC4). Cancelling starts from Under Review, because a Submitted request has no Coordinator to cancel it.
* 2026-10-07 (Week 7 changes 5 and 6): AC2 has the Lead assign the Coordinator (SCRUM-165). AC3 and AC4 no longer let a Coordinator decide a Submitted request with no Coordinator, because Coordinators manage only events assigned to them. AC6 returns a resubmitted request to the Lead's queue if its Coordinator no longer holds the role. AC7 needs an approved safety check (SCRUM-167). AC16 keeps the safety check and reassignment out of the status list. Re-estimated from 2 to 3 points.
* 2026-10-07 (backlog refinement): AC7 and AC16 point to SCRUM-166, which SCRUM-167 was merged into.
* 2026-10-09 (PO review): added a Customer basis and a Supersedes line matching SCRUM-165.

Functionality Area: Event Status Management

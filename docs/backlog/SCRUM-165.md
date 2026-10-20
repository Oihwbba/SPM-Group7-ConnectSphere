<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-20. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-165 - Lead assigns new requests from an unassigned queue

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Highest |
| **Story points** | 5 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-165 |

---

**User story:** As an Event Coordinator Lead, I want new requests to wait in an unassigned queue until I assign a Coordinator, so that each event goes to a suitable Coordinator instead of being assigned automatically.

**Acceptance criteria**

1. Given an Organiser submits a request, then no Coordinator is assigned: it stays Submitted, appears in the Unassigned queue, and every Lead is notified (SCRUM-124).
2. The queue lists unassigned requests oldest first, with name, dates, expected attendance, Organiser and submission time. A request whose start has passed is marked Overdue.
3. Given I open a request from the queue, then I see its basic information, read-only.
4. Given I assign a request, then I choose one active Coordinator; the screen shows each Coordinator's number of active events and suggests the least-loaded one.
5. Given I assign a Coordinator, then the event gets that Coordinator and moves to Under Review in one operation, and the Coordinator and the Organiser are notified (SCRUM-45).
6. Given two Leads assign the same request at the same moment, then exactly one assignment is saved and the other Lead is shown who it went to.
7. I can't assign a Coordinator who is the event's Organiser (SCRUM-121). Assigning a request that already has a Coordinator is refused and shows the current one; changing it is reassignment (SCRUM-21).
8. Given a request is unassigned, then Coordinators can't open it for decision or decide it; they see their own events and the read-only all-events list (SCRUM-141).
9. Given a rejected request is amended and resubmitted (SCRUM-108), then it keeps its Coordinator; if that Coordinator no longer holds the role, it returns to the queue.
10. Only Leads can see the queue and assign (SCRUM-67).
11.  Given I assign a Coordinator to a request, then I'm recorded as the event's supervising Lead, since the Lead supervises the Coordinator they allocated for that event.

**Related:** the Lead's view of every assignment and active event is SCRUM-141.

**Supersedes:** SCRUM-20 (automatic assignment); the assignment step in SCRUM-14 and SCRUM-24; SCRUM-17's viewing rule, for Leads; SCRUM-19 and SCRUM-69 AC1 and AC4 (any Coordinator can decide an unassigned request); SCRUM-68's boundary note; SCRUM-81 AC2 (the approving Coordinator becomes assigned); SCRUM-108 AC11 (automatic assignment on resubmission, and a rejecting Coordinator taking an unassigned request).

**Customer basis:** Week 7 change 5: "Newly submitted event requests should no longer be assigned directly to an Event Coordinator. Instead, they first enter an unassigned queue that can be viewed by the Event Coordinator Lead. The Lead can review basic event information, assign a suitable Event Coordinator, and reassign events where necessary. Event Coordinators should only be able to manage events assigned to them … Relevant users should be notified when assignments or reassignments occur."

**Why this is a new story:** SCRUM-20 (Sprint 1, Done) assigns automatically, and SCRUM-69, SCRUM-81 and SCRUM-108 (Sprint 2, Done) let any Coordinator take an unassigned request.

**Change log**

* * 2026-10-16 (W9 clarifications, PO approved): AC11 added. The Lead who assigns a request becomes its supervising Lead ("Lead is responsible for supervising the co-ordinator that he/she allocated for an event request"), recorded in the field SCRUM-172 AC12 added.
  * 2026-10-07 (Week 7 change 5): created.


Functionality Area: Coordinator Assignment

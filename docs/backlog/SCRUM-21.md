<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-04. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-21 - Hand an event to another coordinator and show who is currently assigned

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Medium |
| **Story points** | 3 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-21 |

---

**User story:** As an Event Coordinator, I want to hand an event to a colleague who has agreed to take it, so that responsibility can move when workload or availability changes.

**Acceptance criteria**

1. Given I'm the assigned Coordinator of an event that is Under Review, Planning or Confirmed, when I name another Coordinator, then a Pending handover is created and they are asked to accept it.
2. Given a Pending handover, when the named Coordinator accepts, then they become the assigned Coordinator and the handover becomes Approved, in one operation.
3. Given I cancel my Pending handover, then it becomes Cancelled and I stay assigned.
4. Until a handover is accepted I remain the assigned Coordinator; an event never has more than one assigned Coordinator.
5. An event has at most one Pending handover. Repeating the same request shows the existing one instead of creating another.
6. I can't name myself, and I can't name a Coordinator who is the event's Organiser (SCRUM-121).
7. Given the event is Cancelled, Rejected or Completed while a handover is Pending, then the handover becomes Cancelled.
8. The Organiser sees the current Coordinator's name on the event; it changes only when a handover is accepted.
9. The handover records who started it, who accepted it, and when.
10. After acceptance, the previous Coordinator can still open the event read-only from the all-events list (SCRUM-141) but cannot edit it.

**Notifications:** owned by SCRUM-45 (the named Coordinator when a handover is proposed; both Coordinators and the Organiser when it is accepted).

**Customer basis:** "Reassignment should be discussed offline. Once there is an agreement, the original co-ordinator can make the change and request the new co-ordinator to accept the change." "Calendar view allows viewing of the event. Previous co-ordinator cannot edit the info." "Co-ordinator cannot decline. See earlier response on changing co-ordinator."

**Change log**

* 2026-10-01: rewritten in one format; added the self and Organiser exclusions, the end of a Pending handover when the event closes, and the previous Coordinator's read-only access.
* 2026-10-01 (audit): removed the Decline step. The customer says a Coordinator cannot decline, and a handover is agreed offline before it is entered; one entered by mistake is cancelled by the Coordinator who started it (AC3). Handover statuses are now Pending, Approved and Cancelled. The previous Coordinator's read-only access now comes from the all-events list (SCRUM-141), because the event calendar (SCRUM-120) is beyond Release 1.

Functionality Area: Coordinator Assignment

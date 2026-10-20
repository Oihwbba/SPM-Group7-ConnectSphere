<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-20. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-21 - Reassign an event to another Coordinator and show who is currently assigned

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Highest |
| **Story points** | 3 |
| **Status in Jira** | In Review |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-21 |

---

**User story:** As an Event Coordinator Lead, I want to reassign an event to another Coordinator, so that responsibility can move when workload or availability changes.

**Acceptance criteria**

1. Given an event is Under Review, Planning or Confirmed, when I reassign it to another active Coordinator, then that Coordinator becomes its assigned Coordinator at once; there is no acceptance step.
2. An event never has more than one assigned Coordinator.
3. I can't reassign an event to a Coordinator who is its Organiser (SCRUM-121). Choosing the current Coordinator changes nothing.
4. Given an event is Draft, Submitted, Rejected, Cancelled or Completed, then Reassign isn't offered and a direct request is refused. A Submitted request is assigned from the queue instead (SCRUM-165).
5. Given I reassign an event, then the previous Coordinator can no longer edit it and can still open it read-only from the all-events list (SCRUM-141).
6. The new and previous Coordinators and the Organiser are notified (SCRUM-45).
7. Each reassignment records who made it, from whom, to whom, and when.
8. The Organiser always sees the current Coordinator's name on the event.
9. Given two Leads reassign the same event at the same moment, then exactly one reassignment is saved.
10. Only Leads can reassign (SCRUM-67).

**Supersedes:** SCRUM-69 AC3 (the event moves when a handover is accepted) and SCRUM-20's last criterion (a Coordinator who can't take an event reassigns it).

**Customer basis:** Week 7 change 5: "The Lead can review basic event information, assign a suitable Event Coordinator, and reassign events where necessary … Relevant users should be notified when assignments or reassignments occur." Earlier answer still in force: "Calendar view allows viewing of the event. Previous co-ordinator cannot edit the info."

**Change log**

* 2026-10-01: rewritten in one format; added the self and Organiser exclusions, the end of a Pending handover when the event closes, and the previous Coordinator's read-only access.
* 2026-10-01 (audit): removed the Decline step. The customer says a Coordinator cannot decline, and a handover is agreed offline before it is entered; one entered by mistake is cancelled by the Coordinator who started it. Handover statuses are now Pending, Approved and Cancelled. The previous Coordinator's read-only access now comes from the all-events list (SCRUM-141), because the event calendar (SCRUM-120) is beyond Release 1.
* 2026-10-07 (Week 7 change 5): rewritten so the Lead reassigns, effective at once. The Coordinator-to-Coordinator handover with acceptance is removed; the earlier customer answer ("the original co-ordinator can make the change and request the new co-ordinator to accept the change") came before the Lead role.

Functionality Area: Coordinator Assignment

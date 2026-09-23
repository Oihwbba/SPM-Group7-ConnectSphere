<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-23. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-20 - Auto-assign a coordinator to a submitted event

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Highest |
| **Story points** | 3 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 1 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-20 |

---

As ConnectSphere, I want every submitted event to be assigned a single Event Coordinator automatically, so that every event has one clear internal point of contact without anyone having to claim it.

Acceptance Criteria:

* Given an event reaches "submitted" status, when the assignment runs, then the system assigns exactly one Event Coordinator automatically — there is no manual claim or pick-from-a-list step.
* An event has at most one assigned Coordinator at any moment.
* The assigned Coordinator is recorded on the event as the internal point of contact.
* Events are distributed fairly using a least-loaded rule: a new event goes to the Coordinator with the fewest events in an active state (Under Review, Approved, Planning or Confirmed). Completed, Cancelled and Rejected events do not count towards load. Ties go to the Coordinator whose account was created first, so the result is deterministic. The rule is defined in one place (lib/coordinator-assignment.ts).
* There is no upper limit on how many events one Coordinator can hold. Fairness comes from the least-loaded rule, not from a cap.
* Given two events are submitted at the same moment, when assignment runs, then they are assigned one after the other and the second assignment counts the first, so neither is decided on stale load figures.
* Given assignment succeeds, when it completes, then the event's status moves to "under review" and the Organiser and assigned Coordinator are notified through SCRUM-46.
* There is no accept-or-decline step on initial assignment. A Coordinator who cannot take an event uses reassignment instead (SCRUM-21).
* Given no Coordinator account exists when an event is submitted, then the event remains Submitted, is not treated as Under Review, and stays visible to Coordinators rather than failing silently.


Customer clarification (2026-09-13): "Event co-ordinator are auto-assigned by the system and only 1 co-ordinator can be assigned to a specific event. Detail implementation is up to the team as long as it is fair and technically possible." And, on whether a Coordinator may decline: "No acceptance step; decline handled outside system as changing co-ordinator."

Note (2026-09-23): criteria updated to match the delivered behaviour.

* The fairness rule is now stated instead of left open, as the original criterion required ("the chosen rule must be documented and deterministic").
* "Available Coordinators" became "a Coordinator account exists". The system has no concept of Coordinator availability, and the customer did not ask for one.
* Three automatic-retry criteria were removed: retry when availability changes, idempotent retries, and moving to Under Review exactly once when a Coordinator becomes available. They were not built, and cannot occur in Release 1: Coordinator accounts come only from the seed because account creation is out of scope, so a running system never has zero Coordinators. If account creation is added later, retry should return as its own story.


INVEST: Independent (assignment does not depend on review/approval being finished); Negotiable (the fairness mechanism was the team's choice); Valuable (one clear internal point of contact); Estimable and Small; Testable (including the no-Coordinator and simultaneous-submission cases).

Functionality Area: Coordinator Assignment

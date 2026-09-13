<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-13. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-20 - Auto-assign a coordinator to a submitted event

| | |
|---|---|
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Highest |
| **Story points** | 1 |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 1 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-20 |

---

**As ConnectSphere**, I want every submitted event to be assigned a single Event Coordinator automatically, so that every event has one clear internal point of contact without anyone having to claim it.

**Acceptance Criteria:**

* Given an event reaches "submitted" status, when the assignment runs, then the system assigns exactly one Event Coordinator automatically — there is no manual claim or pick-from-a-list step
* An event has at most one assigned Coordinator at any moment
* The assigned Coordinator is recorded on the event as the internal point of contact
* The assignment rule distributes events fairly across available Coordinators. The exact rule (round-robin, least-loaded, or similar) is the team's choice, provided it is fair and stated in one place
* Given the assignment is saved, when it completes, then the event's status moves to "under review" and both the Organiser and the assigned Coordinator are notified (see SCRUM-46)
* There is no accept-or-decline step on initial assignment. A Coordinator who cannot take an event uses reassignment instead (see SCRUM-21)
* Given no Coordinator is available to assign, when an event is submitted, then the event still reaches "submitted" and is visible to Coordinators rather than failing silently

**Customer clarification (2026-09-13):** _"Event co-ordinator are auto-assigned by the system and only 1 co-ordinator can be assigned to a specific event. Detail implementation is up to the team as long as it is fair and technically possible."_ And, on whether a Coordinator may decline: _"No acceptance step; decline handled outside system as changing co-ordinator."_

This **replaces** the story's previous open question and its previous behaviour. The story formerly assumed any Coordinator could self-assign or assign a peer; the customer has ruled that out in favour of automatic assignment.

**⚠ Re-estimate before continuing.** This story was sized at 1 point as "pick a coordinator from a dropdown". Automatic assignment with a stated fairness rule is materially more work. Bring it to the next planning poker rather than carrying the old number.

**INVEST:** Independent (assignment does not depend on review/approval being finished); Negotiable (the fairness rule itself is explicitly the team's choice); Valuable (named directly in the briefing as the main internal point of contact); Estimable and Small (one rule, one relationship); Testable (submit several events, assert exactly one Coordinator each and a fair spread).

Functionality Area: Coordinator Assignment

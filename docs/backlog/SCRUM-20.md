<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-21. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-20 - Auto-assign a coordinator to a submitted event

| | |
|---|---|
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Highest |
| **Story points** | 1 |
| **Status in Jira** | In Review|
| **Sprint** | SCRUM Sprint 1 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-20 |

---

**As ConnectSphere**, I want every submitted event to be assigned a single Event Coordinator automatically, so that every event has one clear internal point of contact without anyone having to claim it.

**Acceptance Criteria:**

- Given an event reaches "submitted" status, when the assignment runs, then the system assigns exactly one Event Coordinator automatically — there is no manual claim or pick-from-a-list step.
- An event has at most one assigned Coordinator at any moment.
- The assigned Coordinator is recorded on the event as the internal point of contact.
- The assignment rule distributes events fairly across available Coordinators. The exact fair mechanism (round-robin, least-loaded, or similar) is the team's choice, but the chosen rule must be documented and deterministic.
- Given assignment succeeds, when it completes, then the event's status moves to "under review" and the Organiser and assigned Coordinator are notified through SCRUM-46.
- There is no accept-or-decline step on initial assignment. A Coordinator who cannot take an event uses reassignment instead (SCRUM-21).
- Given no Coordinator is available when an event is submitted, then the event remains **Submitted** and is not treated as Under Review.
- While an event remains Submitted without a Coordinator, the system automatically retries assignment when Coordinator availability changes and through the normal assignment retry mechanism.
- Repeated retry or duplicate assignment attempts are idempotent: they cannot assign more than one Coordinator or create duplicate assignment notifications.
- When a Coordinator becomes available, the first successful assignment moves the event from Submitted to Under Review exactly once.

**Customer clarification (2026-09-13):** *"Event co-ordinator are auto-assigned by the system and only 1 co-ordinator can be assigned to a specific event. Detail implementation is up to the team as long as it is fair and technically possible."* And, on whether a Coordinator may decline: *"No acceptance step; decline handled outside system as changing co-ordinator."*

**INVEST:** Independent (assignment does not depend on review/approval being finished); Negotiable (the fairness mechanism is the team's choice); Valuable (one clear internal point of contact); Estimable and Small; Testable (including no-availability and retry/idempotency cases).

Functionality Area: Coordinator Assignment

<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-21. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-81 - Move an approved event through planning to confirmed

| | |
|---|---|
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Highest |
| **Story points** | 5 |
| **Status in Jira** | To Do|
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-81 |

---

**As ConnectSphere**, I want an approved event to move automatically into Planning and then become Confirmed only when the confirmation-readiness rule is satisfied, so that Attendees can register only when the event is ready.

**Acceptance Criteria:**

- Given a request is approved by SCRUM-19, then the event enters **Approved** first and is then automatically advanced to **Planning**; there is no manual action required from the Coordinator.
- The Approved → Planning transition is owned by this story and uses the single persisted status defined by SCRUM-24.
- Given an event is Planning, when SCRUM-110's confirmation-readiness conditions become true, then the event changes to **Confirmed**.
- Given the venue booking is rejected, the event remains Planning and the Coordinator can submit another booking request.
- Given a Confirmed event has an approved impactful change, SCRUM-43 moves it back to **Planning**; SCRUM-110 must become true again before it can return to Confirmed.
- Confirmed is the state that gates attendee registration.
- The Planning → Confirmed transition must be idempotent; repeated readiness checks do not create duplicate transitions or notifications.

**Boundary:** SCRUM-110 owns the definition of readiness. Venue and equipment stories own the actual booking/reservation decisions. SCRUM-43 owns the specific Confirmed → Planning transition after an approved impactful change. SCRUM-81 owns the Approved → Planning and Planning → Confirmed transitions.

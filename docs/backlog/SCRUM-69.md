<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-13. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-69 - View only the events assigned to me

| | |
|---|---|
| **Epic** | SCRUM-9 - Access Control |
| **Priority** | High |
| **Story points** | 2 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-69 |

---

**As an Event Coordinator**, I want my event list to show the events I have been assigned to coordinate, so that I can work from an accurate list of my own responsibilities.

**Acceptance Criteria:**

* A Coordinator's default event list contains only events where they are the assigned coordinator
* Reassigning an event to another Coordinator removes it from the previous Coordinator's list and adds it to the new one's
* An unassigned submitted event is visible to Coordinators who may pick it up or be assigned to it
* Whether a Coordinator may view events assigned to a colleague is governed by a single stated rule, not left to each screen

**Note:** depends on "Assign a coordinator to a submitted event" (SCRUM-20) and "Reassign an event to a different coordinator" (SCRUM-21) under the Event Request Lifecycle epic. Coordinate the sprint in which these land — this story is testable only once assignment exists.

**INVEST:** Independent — only partially, and honestly: the assignment relationship is created by SCRUM-20. Size and test it alongside that story rather than in isolation; Negotiable (colleague visibility is an open customer question, flagged above); Valuable (a coordinator working from a list of all 500 staff's events cannot do their job); Estimable and Small (one relationship filter); Testable (assign, assert presence; reassign, assert it moves).

Functionality Area: User Authorisation and Authentication

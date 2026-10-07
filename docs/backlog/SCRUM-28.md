<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-08. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-28 - Review and update an equipment request

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-10 - Equipment Management |
| **Priority** | Highest |
| **Story points** | 3 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 2 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-28 |

---

**User story:** As a Technical Support Staff member, I want to review equipment requests and update them as arrangements are made, so that Event Coordinators know the exact status of their requests.

**Acceptance criteria**

1. Given I am Technical Support Staff, when I open the request queue, then I see requests oldest first, with each line's equipment type, quantity and technical requirements, the event's period, and how many of that type are free for that period.
2. Given a request is Pending Review, when I start reviewing it, then it moves to In Review, so the Coordinator can see someone is working on it.
3. Given a request is In Review, when I decide it, then I set it to Approved, or to Rejected with a required reason. A decided request can't be decided again.
4. Given a line's type doesn't have enough free for the event's period, when I review it, then I can suggest another type that does have enough, and the suggestion is shown to the Coordinator. A suggestion holds no stock.
5. Given I save any update, then the Coordinator who raised the request is notified once, with the new status and any note.
6. Given I open a request, then I see its history: each status change and suggestion, who made it and when.
7. Given two Technical Support Staff update the same request at the same moment, then only the first update is saved and the other is told to refresh.

**Related:** approving a request doesn't reserve stock; Technical Support reserves it with SCRUM-31, and the readiness checklist counts reservations (SCRUM-110). If a request is Rejected, the Coordinator raises a new one (SCRUM-27), rejects the event (SCRUM-117) or, if it was ever Confirmed, cancels it (SCRUM-82). Competing requests are decided in order (SCRUM-134). Status labels: SCRUM-131.

**Change log**

* 2026-09-30: AC6–AC8 added mid-Sprint 2 to rectify SCRUM-31, which stores reservations as "Confirmed", also an event status (withdrawn below).
* 2026-10-01 (mid-sprint correction, no new scope): stated that approvals are all-or-nothing (withdrawn below).
* 2026-10-01 (audit): restored to the criteria the merged code was built against (30 Sep): review the whole request, suggest alternatives, notify the Coordinator and keep a history. The per-item wording and the migration of reservation statuses are withdrawn; the clash between a reservation's "Confirmed" and the event status is fixed on screen by SCRUM-131, which shows reservations as Reserved. AC2, AC3 and AC7 state behaviour the merged code already has.

Functionality Area: Equipment Request Management

<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-13. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-71 - Record who changed what and when

| | |
|---|---|
| **Epic** | SCRUM-9 - Access Control |
| **Priority** | Low |
| **Story points** | 3 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-71 |

---

**As an Event Coordinator**, I want to see who made each significant change to an event and when, so that I can understand how an event reached its current state and resolve disputes about what was agreed.

**Acceptance Criteria:**

* Every status change, approval, rejection, assignment and booking decision records the acting user, the action and a timestamp
* The record is written as part of the action, so an action cannot succeed without being recorded
* The history for an event is visible to users who may already view that event, under the same rules as the ownership and assignment stories in this epic
* Recorded entries cannot be edited or deleted through the application
* The history shows the previous and new value for the fields the briefing calls important — date, time, expected attendance, venue and equipment requirements

**Note:** auditability is named in the briefing's non-functional requirements ("what, who, when") but is NOT one of the twenty core Release-1 features. Keep it in the backlog, prioritise it below the rest of this epic, and pull it in once the actions it records exist. It pairs naturally with "Flag edits that affect existing arrangements" (SCRUM-26).

**INVEST:** Independent — partially: it records actions defined in other stories, so it can be built once but only tested as those actions land; Negotiable (retention, granularity and whether Organisers see it are all open); Valuable (directly addresses the briefing's complaint that information is spread across email, spreadsheets and chat with no record); Estimable and Small (one append-only record, one write point); Testable (perform each recorded action, assert an immutable entry with actor and timestamp).

Functionality Area: User Authorisation and Authentication (non-functional: auditability)

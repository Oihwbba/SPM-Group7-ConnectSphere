<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-28. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-72 - View an event I could attend

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-11 - Attendee Registration |
| **Priority** | Highest |
| **Story points** | 2 |
| **Status in Jira** | In Progress |
| **Sprint** | SCRUM Sprint 2 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-72 |

---

**As an Attendee**, I want to browse confirmed events and see whether registration is currently available, so that I can decide whether to attend.

**Acceptance Criteria:**

* The Attendee can browse a list of **Confirmed** events that are not Cancelled.
* Event name, description, date, time, venue name and location are shown.
* The registration period and remaining capacity are shown.
* An event whose registration period has not opened, has been manually closed, or has expired is still visible, but the register action is unavailable and the current registration state is shown.
* A Confirmed event with no explicitly configured registration period follows the default timing rule in SCRUM-75.
* A full event remains visible and is shown as full rather than disappearing from the browse list.
* An event that is Cancelled no longer appears in the attendee browse list.
* Direct event URLs do not bypass the same visibility and registration-state rules.

**Boundary:** this story owns event browsing and the attendee-facing event-detail view. SCRUM-70 covers registration-record privacy; SCRUM-73–75 cover registration actions and timing.

Functionality Area: Attendee Registration

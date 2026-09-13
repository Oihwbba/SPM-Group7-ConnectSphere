<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-13. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-72 - View an event I could attend

| | |
|---|---|
| **Epic** | SCRUM-11 - Attendee Registration |
| **Priority** | Highest |
| **Story points** | 2 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-72 |

---

**As an Attendee**, I want to view the details of an event that is open for registration, so that I can decide whether to attend.

**Acceptance Criteria:**

* Only events that are confirmed and have registration enabled appear to Attendees
* Event name, description, date, time, venue name and location are shown
* The registration period and remaining capacity are shown
* An event whose registration period has not opened, or has closed, is shown with its registration state rather than an active register action
* An event that is cancelled no longer appears

**Note:** this story is the sole source of truth for what event-browsing fields an Attendee sees; "View only my own registrations as an Attendee" (SCRUM-70, Access Control epic) covers registration-record ownership only, not event-browsing — **updated 2026-09-06** during the full backlog synthesis, which found the two stories had drifted into covering the same ground independently.

**INVEST:** Independent (needs an event that can reach "confirmed" status — SCRUM-24 — but not the registration actions below); Negotiable (whether Attendees browse a public list or arrive via a direct link is an open customer question); Valuable (no Attendee registers for something they cannot see); Estimable and Small (one read view, one visibility rule); Testable (assert each event state produces the expected visibility and action).

Functionality Area: Attendee Registration

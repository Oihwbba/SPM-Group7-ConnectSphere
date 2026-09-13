<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-13. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-83 - Mark a confirmed event completed once it has passed

| | |
|---|---|
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Low |
| **Story points** | 2 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-83 |

---

**As ConnectSphere**, I want a confirmed event to move to "completed" once its date has passed, so that past events are recorded accurately and are distinguishable from ones still upcoming.

**Acceptance Criteria:**

* Given a confirmed event whose end date and time have passed, when the system next checks, then its status changes to "completed".
* Given the current time is exactly the event's end instant, when the system checks, then the event is NOT yet completed - it completes only once that instant has passed.
* Given an event that has already been marked completed, when the system checks again, then its status does not change and no duplicate notification is sent.
* An event that was cancelled before its date is never marked completed.
* A completed event's other recorded details (venue, equipment, registrations) remain visible unchanged.

**Note:** lowest priority of the three status-gap stories added 2026-09-06 - Release 1 works end-to-end without it (nothing else gates on "completed"), but it's one of the 9 named statuses and its absence would leave every past event stuck reading "confirmed" forever.

**Note (2026-09-07):** the exact-end-instant and already-completed criteria were added following the Week 2 assignment feedback. The INVEST note below previously left "exact timing" open; the boundary is now decided in the criteria - end instant exclusive - so the story is testable. Whether "end" means the stated end time or end of day is still a team decision, but whichever is chosen, the boundary rule above holds.

**INVEST:** Independent; Negotiable (whether "end" is the stated end time or end of day); Valuable (accuracy of the historical record, feeds any future reporting even though reporting itself is out of Release-1 scope); Estimable and Small (one time comparison, one status write); Testable (advance to exactly the end instant and assert not completed; advance past it and assert completed; assert a cancelled event is unaffected).

Functionality Area: Event Status Management

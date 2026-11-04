<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-11-04. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-149 - [REPLACED BY SCRUM-162] Use event attendance in venue booking

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | High |
| **Story points** | - |
| **Status in Jira** | Done |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-149 |

---

**Not changed in this review:** this task was closed without being built, after Week 7 change 3 superseded it. Now that an event can book several venues, each booking holds part of the audience. Attendance is therefore set per booking (SCRUM-162 AC4), and the safety check judges whether the venues together suit the whole audience (SCRUM-166). Registration capacity still follows SCRUM-74. Because the rule lives in those stories, updating this task would duplicate it.

---

Fix the remaining SCRUM-50 implementation gap identified by audit finding F21.

Acceptance criteria:

1. Venue booking requests use the event's expected attendance as the authoritative attendance value.
2. The booking form does not allow the Coordinator to submit a lower or higher attendance than the event's expected attendance.
3. Venue capacity validation compares the venue capacity against the event's expected attendance.
4. Registration capacity continues to follow event expected attendance.
5. Add regression coverage preventing a venue booking for fewer seats than the event can register.

Related: SCRUM-50, SCRUM-74, SCRUM-127.

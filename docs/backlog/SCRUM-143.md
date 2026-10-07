<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-07. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-143 - [SUPERSEDED BY SCRUM-162] Enforce one venue request per event

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | High |
| **Story points** | - |
| **Status in Jira** | Done |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-143 |

---

Fix the remaining SCRUM-50 implementation gap identified by the 1 Oct backlog audit.

Acceptance criteria:

1. For a given event, at most one Pending or Approved venue booking can exist at a time, regardless of which Coordinator submits it.
2. A second request for the same event is rejected with the existing booking shown.
3. Separate events may request the same venue and overlapping periods; conflict rules remain unchanged.
4. Rejected or Cancelled prior bookings do not block a new request.
5. Add/adjust tests for the event-level uniqueness rule and concurrent submissions.

Related: SCRUM-50, SCRUM-127, SCRUM-134. Fixes audit finding F03.

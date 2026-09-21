<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-21. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-26 - Flag edits that affect existing arrangements

| | |
|---|---|
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | High |
| **Story points** | 3 |
| **Status in Jira** | To Do|
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-26 |

---

**As an Event Coordinator**, I want the system to warn me before an impactful planning edit affects existing arrangements, so that I can re-check those arrangements before confirming the change.

**Acceptance Criteria:**

- The impactful fields are exactly **date, time, expected attendance, venue and equipment**.
- Given an existing venue booking or equipment reservation, when the Coordinator changes one of those fields to a different value, then a warning is shown before the edit is confirmed.
- If the field value is unchanged, no warning is raised.
- If no booking or reservation exists, no arrangement-impact warning is required.
- The warning does not automatically cancel a booking or reservation.
- Once the Coordinator confirms the edit, dependent arrangements follow SCRUM-44's reconsideration path.
- This story covers Coordinator-initiated planning edits. Organiser-initiated post-submission changes use SCRUM-41–43.

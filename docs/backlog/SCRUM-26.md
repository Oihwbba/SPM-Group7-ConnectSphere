<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-13. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-26 - Flag edits that affect existing arrangements

| | |
|---|---|
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | High |
| **Story points** | 3 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-26 |

---

**As an Event Coordinator**, I want the system to flag when an edit would affect arrangements already made, so that I know to re-check bookings before the change goes through.

**Acceptance Criteria:**

* The impactful fields are exactly five: **date, time, expected attendance, venue and equipment**. Every other field is routine and is handled by SCRUM-25
* Given a venue booking or equipment reservation already exists for the event, when a Coordinator edits any of those five fields, then the system flags that existing arrangements may be affected **before** the edit is confirmed
* Given no booking or reservation exists for the event, when any field is edited, then no flag is raised
* Given an impactful field is edited but its value is unchanged, when the Coordinator saves, then no flag is raised
* The flag warns and requires the Coordinator to confirm; it does not silently cancel anything. What happens to the affected arrangements afterwards is SCRUM-44's path
* This story covers a Coordinator's own edits during planning. An Organiser-initiated change after submission is a different path (SCRUM-41 to 44)

**Customer clarification (2026-09-13) — confirms the field list:** _"Significant changes are those affecting arrangements (date/time, attendance, venue, equipment). Other edits are ordinary."_

The story previously asked whether anything beyond those five should count as impactful. The answer is no, and the list is now stated as settled rather than assumed. Also confirmed: _"Significant changes require review offline before changes are made on the system"_ — which is why this story warns rather than auto-cancels.

**INVEST:** Independent (a validation rule layered on top of the general edit action); Negotiable (whether the flag blocks the edit outright or warns and proceeds is still the team's call — the criteria above choose warn-and-confirm); Valuable (directly required: "the system should distinguish...important changes that may affect arrangements already made"); Estimable/Small (one conditional check over five fields); Testable (edit each of the five with and without an existing booking; assert the flag appears only where expected).

Functionality Area: Event Information Management

<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-07. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-71 - Record who changed what and when

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Low |
| **Story points** | 5 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-71 |

---

**Beyond Release 1** (label `beyond-release-1`): Activity/Change History is on the Week 4 list of features not required for Release 1, and the team descoped this story on 29 Sep. For Release 1, recording who did what and when stays a Definition of Done rule for every story (Confluence §11). The code already records Coordinator assignment, approval and rejection, and venue booking decisions, and the SCRUM-81 branch adds the move to Planning and confirmation. This story adds the remaining entries and the timeline.

**User story:** As an Event Coordinator or Event Organiser, I want to see who made each important change to an event and when, so that we can understand how the event reached its current state and settle disagreements about what was agreed.

**Acceptance criteria**

1. These actions each record the actor (a user or the system), the action and a timestamp: every status change; approval and rejection with the outcome from SCRUM-126; Coordinator assignment and handover; clarification request and response; amendment and resubmission; change request raised and decided; venue booking requested and decided; equipment request created and reviewed, and equipment reserved; flag raised and resolved; event cancellation; registration and withdrawal.
2. For date, time, expected attendance, venue and equipment, the entry also records the previous and the new value.
3. The entry is written in the same operation as the action, so an action cannot succeed without its entry.
4. Entries cannot be edited or deleted through the application.
5. The event page shows a timeline of these entries (newest first) with actor, action, time in SGT and any reason.
6. The timeline is visible to the event's Organiser, its assigned Coordinator and previous Coordinators. Other users cannot see it (SCRUM-67).
7. Entries the code already records (Coordinator assignment, approval and rejection, venue booking decisions, the move to Planning and confirmation) appear in the timeline from when they were recorded. Other actions are covered from the release of this story onward.

**Customer basis:** "Important actions should be recorded in the system; co-ordinator and organiser should be able to view." Requirement 8f: "ConnectSphere should be able to determine what was changed, who changed it, and when the change was made."

**Change log**

* 2026-10-01: back in scope (the "descoped" label was removed). The customer requires it, and SCRUM-21, SCRUM-26, SCRUM-81, SCRUM-108 and SCRUM-126 depend on it. Moved from the Access Control epic to Event Request Lifecycle. Visibility narrowed to the Organiser and Coordinators, as the customer said. Re-estimated from 4 (not on the scale) to 5.
* 2026-10-01 (audit): beyond Release 1 again (label `beyond-release-1`), following the Week 4 not-required list and the team's 29 Sep decision. The stories that depended on it only need their actions recorded, which the Definition of Done already requires. Waiting-list actions removed from AC1 (SCRUM-79 is beyond Release 1); the equipment entries match the built request-and-reservation model; AC7 names what the code already records.

Functionality Area: Event Information Management (Auditability)

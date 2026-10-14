<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-15. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-25 - Update routine event information during planning

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Highest |
| **Story points** | 3 |
| **Status in Jira** | In Progress |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-25 |

---

**User story:** As an Event Coordinator, I want to update routine event details and keep operational notes while the event is being reviewed and planned, so that the event record stays accurate as ordinary details change.

**Acceptance criteria**

1. Given I'm the event's assigned Coordinator and the event is Under Review or Planning, I can edit routine fields directly. Routine fields are every event field except date, time, expected attendance, venue and equipment.
2. A routine edit does not change the event's status and does not flag any arrangement. Given I change the layout or accessibility needs after a safety check was requested, then that check becomes Outdated (SCRUM-166).
3. Given the event is in Planning and I change date, time, expected attendance, venue or equipment, then the warning and flagging in SCRUM-26 apply. Given the event is Under Review, the change is saved directly with no warning, because no venue or equipment can be requested before Planning (SCRUM-50 AC7, SCRUM-27 AC1).
4. The Organiser cannot edit any field directly after submission. They raise a change request (SCRUM-41). The only exception is closing or reopening registration (SCRUM-75).
5. Given the event is Confirmed, no event detail can be edited directly by anyone; changes go through SCRUM-41 and SCRUM-128. Closing or reopening registration (SCRUM-75) and operational notes (AC6) stay available because they are not event details.
6. The assigned Coordinator can add operational notes at any status except Cancelled. Any Venue Staff member can add them once the event has a venue booking (Pending, Held or Approved), and any Technical Support Staff member once it has an equipment request. Notes cannot be edited or deleted, show author and time, and are visible to internal users who can view the event and to the event's Organiser.
7. Any other user, including a previous Coordinator, is refused with no change (SCRUM-67).

**Customer basis:** "Organiser cannot directly edit after submission; must request via Coordinator."

**Change log**

* 2026-10-01: user story narrowed to the Coordinator; added Under Review editing, the operational notes rule and the Confirmed exceptions. Change-request decision points to SCRUM-128.
* 2026-10-01 (audit): AC6 now says which staff can add notes, because no Venue Staff or Technical Support member is assigned to an event (SCRUM-124). Preparation progress (SCRUM-123) removed from AC5, because it is beyond Release 1; staff record preparation as operational notes instead.
* 2026-10-07 (Week 7 changes 4 and 6): AC6 counts a Held booking (SCRUM-163). AC2 adds that a routine change to the layout or accessibility needs puts a requested safety check out of date (SCRUM-167).
* 2026-10-07 (backlog refinement): AC2 points to SCRUM-166, which SCRUM-167 was merged into.
* 2026-10-08: AC4 and AC5 refer to closing or reopening registration, because setting the window was removed from SCRUM-75.
* 2026-10-13: AC3 states the Under Review case, which SCRUM-26 AC1 doesn't cover (SCRUM-26 AC1 only defines that warning for a change to date, time, expected attendance, venue or equipment for an event in Planning, not Under Review).
* 2026-10-14 (PO approved): user story covers operational notes (AC6), which it didn't mention. No AC change.

Functionality Area: Event Information Management

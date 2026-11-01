<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-29. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-76 - View my registration status

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-11 - Attendee Registration |
| **Priority** | High |
| **Story points** | 1 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 2 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-76 |

---

**Superseded in part** (the criteria below are kept as accepted in Sprint 2):

* **AC1, superseded by SCRUM-162 AC7:** an event can book several venues, and each Approved venue is shown.
* **AC2, extended by SCRUM-85 AC8:** a registration for an event being re-planned shows "Details being updated – registration paused", never "Planning".

**User story:** As an Attendee, I want to see the events I'm registered for and the status of each, so that I know what I've committed to attending.

**Acceptance criteria**

1. I see a list of my own registrations with event name, date, time, venue and registration status.
2. Statuses shown are Registered, Withdrawn and Cancelled.
3. Given ConnectSphere cancels an event, then my registration for it shows as Cancelled.
4. Given an event's date, time or venue changed after I registered, then I see the current details, not the ones from when I registered.
5. The list contains only my registrations.

**Related:** registrations stay active when an event's details change (SCRUM-26); SCRUM-85 tells the Attendee; an event that returns to Planning is shown as "Details being updated" (SCRUM-85).

**Change log**

* 2026-10-01 (mid-sprint correction, no new scope): status names aligned with SCRUM-131.
* 2026-10-01 (audit): Waitlisted removed, because the waiting list (SCRUM-79) is beyond Release 1.
* 2026-10-07: the Related note points to SCRUM-85, which SCRUM-133 was merged into.
* 2026-10-29 (SCRUM-239, PO approval pending): removed the Related note's sentence that the My Registrations page still names SCRUM-42; SCRUM-146 fixed that. Marked AC1 as superseded in part by SCRUM-162 AC7 and AC2 as extended by SCRUM-85 AC8. Criteria unchanged; story stays Done.
* 2026-10-29 (SCRUM-239, PO approval pending): the Superseded in part note lists one change per bullet, to be easier to read; what it says is unchanged. Criteria unchanged.

Functionality Area: Attendee Registration

<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-09. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-120 - Event calendar: all events in one view

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-9 - Access Control |
| **Priority** | Low |
| **Story points** | 8 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-120 |

---

**Beyond Release 1** (label `beyond-release-1`): Event Calendar is on the Week 4 list of features not required for Release 1. In Release 1, SCRUM-141 gives Coordinators, Venue Staff and Technical Support a read-only list of every event, which keeps the customer's viewing rule without a calendar. Organisation-wide viewing for Organisers (AC6 to AC8) also needs client-organisation data, which Release 1 doesn't hold (Client Management is on the same list).

**User story:** As an Event Coordinator, Venue Staff or Technical Support Staff member, I want all events in one calendar, so that I can plan around them; and as an Event Organiser I want to see my organisation's events, so that I know what my colleagues have booked.

**Acceptance criteria**

1. Month and week views show events by start date, in Singapore time, filterable by status and venue. The default is the current month.
2. Each entry shows the event name, time, venues (every booked venue, or the preferred venues if none is booked yet; SCRUM-127, SCRUM-162), status and assigned Coordinator.
3. Opening an entry shows the event's details read-only, unless the user is allowed to edit that event.
4. Coordinators, the Lead, Venue Staff and Technical Support see all events except Drafts, including Submitted events with no Coordinator.
5. Only the assigned Coordinator can edit an event. Previous Coordinators and other internal users see it read-only.
6. Organisers see events from their own client organisation. Events submitted by other Organisers in the same organisation are read-only, appear only in the calendar, and never in My Event Requests (SCRUM-84).
7. Events from other organisations are refused, and the refusal looks the same as if the event didn't exist. Drafts are visible only to their creator. Attendees have no access to the calendar.
8. Each Organiser account belongs to exactly one client organisation, supplied with the seeded account data (accounts come from an outside integration).

**If built, this supersedes:** SCRUM-17's rule that only Coordinators and the event's own Organiser can view details, and SCRUM-68's individual-account boundary, for read-only viewing; editing and My Event Requests still follow SCRUM-68. It also replaces the list in SCRUM-141.

**Customer basis:** "The event calendar should have all the events under a single view and should be available to the event co-ordinator and the technical/Venue approval person for planning purpose." "Currently they can only view the event calendar which have all the events belong to their organisation." "Coordinator can view other events for planning purpose but should not be able to edit events not assigned to them." "Calendar view allows viewing of the event. Previous co-ordinator cannot edit the info."

**Change log**

* 2026-10-01: added calendar behaviour (views, entries, filters), which the story lacked; stated what it supersedes in Sprint 1 stories (Done stories are not reopened); added the organisation data source. Re-estimated from 6 (not on the scale) to 8.
* 2026-10-01 (audit): beyond Release 1 (label `beyond-release-1`), following the Week 4 not-required list; SCRUM-141 covers the planning view in Release 1. The supersedes note now applies only if this story is built. Group headings removed.
* 2026-10-07 (Week 7 changes 3 and 5): AC2 shows every booked venue (SCRUM-162); AC4 adds the Lead (SCRUM-164).

Functionality Area: User Authorisation and Authentication, Event Status Management

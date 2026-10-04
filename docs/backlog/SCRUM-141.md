<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-04. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-141 - See every event read-only for planning

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-9 - Access Control |
| **Priority** | Medium |
| **Story points** | 3 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-141 |

---

**User story:** As an Event Coordinator, Venue Staff or Technical Support Staff member, I want to see every event in one read-only list, so that I can plan around events that aren't assigned to me.

**Acceptance criteria**

1. Given I'm a Coordinator, Venue Staff or Technical Support Staff member, when I open All events, then I see every event except Drafts, including Submitted events with no Coordinator, with its name, date and time in SGT, status, venue (the booked venue, or "Not booked") and assigned Coordinator.
2. The list is sorted by start date and can be filtered by status and by date range.
3. Given I open an event from this list that isn't assigned to me, then I see its details read-only; only its assigned Coordinator can edit it (SCRUM-67).
4. Given I handed an event over to another Coordinator (SCRUM-21), then I can still open it here read-only.
5. Organisers and Attendees can't open this list (SCRUM-67). Organisers keep their own list (SCRUM-84, SCRUM-68).
6. Given no events match the filters, then a "No events match" message is shown rather than an empty list.

**Customer basis:** "Multiple roles possible. Coordinator can view other events for planning purpose but should not be able to edit events not assigned to them." "Calendar view allows viewing of the event. Previous co-ordinator cannot edit the info." "The event calendar should have all the events under a single view and should be available to the event co-ordinator and the technical/Venue approval person for planning purpose."

**Why this is a new story:** the customer wants Coordinators, Venue Staff and Technical Support to see all events for planning, and previous Coordinators to keep read-only access. The event calendar that covered this (SCRUM-120) is on the Week 4 list of features not required for Release 1, so it is beyond Release 1; this plain list keeps the access rule without the calendar. For these roles it supersedes SCRUM-17's viewing rule (Sprint 1, Done), read-only.

**Change log**

* 2026-10-01 (audit): created to replace SCRUM-120 in Release 1.

Functionality Area: User Authorisation and Authentication, Event Status Management

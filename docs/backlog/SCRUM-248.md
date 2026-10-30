<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-30. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-248 - Bug: Attendees see a "My work" menu heading, and the event progress steps overlap on a phone

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-248 |

---

Two UI defects in the shared layout, both found by running the seeded app locally.

**1. Attendees see "My work".** SCRUM-210 groups the menu for staff users. Its "work" group is headed "My work" (`lib/nav.ts`, `GROUP_HEADING`). An Attendee's two links, Browse Events and My Registrations, both fall in that group, so their menu reads "My work | Browse Events | My Registrations". Attendees aren't staff. On a phone, the bottom bar also shrinks their menu to a single briefcase icon.

**2. The event progress steps overlap on a phone.** At phone width, the Request → Review → Planning → Confirmed → Completed steps (`app/(app)/events/[id]/event-progress.tsx`) squash together. The labels run into each other and the connector lines cross them. SCRUM-132 AC1 requires the event detail page to be usable at 360 px.

**Acceptance criteria**

1. An Attendee's menu has no "My work" heading. Browse Events and My Registrations show as their own links, including on the phone bar. Staff menus are unchanged, also for a user who holds a staff role as well.
2. At 360 px wide, every step on the event progress is readable and no line crosses a label.

**Change log**

* 2026-10-30: created in Sprint 4 from a code and UI review of the Event Request Lifecycle and Attendee Registration epics, confirmed against the seeded app running locally.
* 2026-10-30: criteria cut to the two defects. The width is now 360 px, to match SCRUM-132 AC1.

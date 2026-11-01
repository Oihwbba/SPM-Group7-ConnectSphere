<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-29. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-241 - Bug: The venue availability calendar shows closed hours as available

| | |
|---|---|
| **Type** | Task |
| **Epic** | SCRUM-7 - Venue Management |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | In Progress |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-241 |

---

The availability calendar shows every hour of every day as available, including hours when the venue is closed and days marked Closed. A booking at those times is refused (SCRUM-34 AC7), so the calendar shows times as bookable when they aren't. That goes against SCRUM-36 AC1, which says the calendar shows the venue's available and unavailable periods.

**Cause:** the calendar doesn't read the venue's opening hours.

**Acceptance criteria**

1. Times outside the venue's opening hours, and days marked Closed, show as unavailable on the calendar.
2. Closed hours look different from bookings and from recorded unavailability.
3. Opening and closing times are boundaries: a slot that starts exactly at opening or ends exactly at closing shows as available.
4. A venue with no opening hours recorded still shows as available all day, as it does today.

**Change log**

* 2026-10-29: created in Sprint 4 from a teammate's report during the SCRUM-7 epic check (SCRUM-214).

**Links:** relates to SCRUM-36.

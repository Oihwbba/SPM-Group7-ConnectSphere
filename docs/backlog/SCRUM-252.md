<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-31. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-252 - Bug: My Registrations shows "Venue to be confirmed" for a cancelled event, and orders a re-planned event by a date it doesn't show

| | |
|---|---|
| **Type** | Task |
| **Epic** | SCRUM-11 - Attendee Registration |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | In Review |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-252 |

---

Two defects in the Attendee's My Registrations list (SCRUM-76, `app/(app)/registrations/`).

**1. A cancelled event loses its venue.** SCRUM-76 AC1 says each registration shows its event's venue. The list takes the venue from the event's Approved bookings. Cancelling releases every booking (SCRUM-82 AC3), so a cancelled event reads "Venue to be confirmed", which suggests it is still being planned. Every event an Attendee can register for was Confirmed, so its last confirmed venues are saved in `Event.confirmedVenues` (SCRUM-85), and cancelling doesn't clear them.

**2. A re-planned event is out of order.** The list is ordered soonest event first by `Event.startAt` (`registrations/queries.ts`). While an event is being re-planned, its row shows the last confirmed date (`confirmedStartAt`, SCRUM-85 AC8), so it is ordered by a date the Attendee can't see, and the list can look unsorted.

**Acceptance criteria**

1. Given an event I registered for is cancelled, then its row shows the venues it was last confirmed with, not "Venue to be confirmed".
2. My registrations are listed by the date each row shows: the last confirmed date for an event being re-planned, and the event's date otherwise. Soonest first, as today.

**Change log**

* 2026-10-30: created in Sprint 4 from a code review of the Event Request Lifecycle and Attendee Registration epics. Not yet reproduced in the running app. No change to any Done story's criteria.

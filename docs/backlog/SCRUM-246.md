<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-30. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-246 - Bug: The event request form shows equipment stock as "available" and doesn't show venues' opening hours

| | |
|---|---|
| **Type** | Task |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | High |
| **Story points** | - |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-246 |

---

The Organiser's event request form (SCRUM-13, SCRUM-207 AC9) misleads the Organiser when they choose equipment and venues.

**1. Equipment "N available" is the total stock.** The equipment list shows "Projector 10 available", "Lectern 4 available" and so on. The number is `Equipment.totalQuantity`: it ignores the event's date, reservations and unavailability, so it isn't what is available. (`app/(app)/events/create-event-dialog.tsx:874`.)

**2. Venues' opening hours aren't shown.** The venue list shows only each venue's name and capacity. An Organiser can't tell that Seminar Room 2.1 and the Executive Boardroom are closed at weekends, or when any venue closes. Booking refuses periods outside opening hours (SCRUM-34 AC7), so a request for a closed venue fails later, in Planning.

**Cause:** `getFormCatalogues` (`app/(app)/events/actions.ts:472`) doesn't return opening hours, and the equipment label calls total stock "available".

**Acceptance criteria**

1. Each equipment option shows its total as "N in stock", not "N available".
2. Each venue option shows its capacity and its opening hours for every day, with Closed days shown as Closed. It uses `describeDay` from `lib/venue-hours.ts`, so the hours read the same as on the venue catalogue. A venue with no opening hours recorded shows its capacity only.
3. Nothing else changes: no warning, nothing is refused, and the answers are saved as free text as before (SCRUM-207 AC9).

**Change log**

* 2026-10-30: created in Sprint 4 from a code and UI review of the Event Request Lifecycle and Attendee Registration epics, confirmed against the seeded app running locally.
* 2026-10-30: scope cut to showing information. Dropped date-based equipment availability, the closed-venue and too-small-venue warnings, and the venue-rename note.

<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-12. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-160 - Identify bookings that clash once setup and turnaround apply

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-7 - Venue Management |
| **Priority** | Highest |
| **Story points** | 3 |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-160 |

---

**User story:** As Venue Staff, I want to see which existing bookings clash once a venue's setup or turnaround time is set or lengthened, so that they are dealt with rather than silently removed.

**Acceptance criteria**

1. Given I lengthen a venue's setup or turnaround time, when I save, then I'm first shown every Approved or Held booking at that venue that hasn't started and whose occupied period would now overlap another booking's occupied period or recorded unavailability, and the change is saved only when I confirm.
2. Given I confirm, then for each clash between two bookings, the one approved or held later is flagged Needs Reconsideration (SCRUM-26) with the reason "Setup or turnaround time changed". A booking that now overlaps recorded unavailability is flagged the same way. No booking is cancelled, moved or changed in status.
3. The flagged booking's Coordinator and Venue Staff are notified (SCRUM-124).
4. Seeded setup and turnaround times create no clash between seeded bookings, because seeding doesn't run the check in AC1.
5. Venue Staff can list the bookings currently flagged for this reason, with the venue, the event, its Coordinator, and the booking or unavailability it clashes with.
6. Shortening a time, or lengthening it without creating a clash, flags nothing. Flags already raised stay until the Coordinator resolves them (SCRUM-26).
7. Saving the same times again flags nothing new, and a booking is never flagged twice for the same clash.

**Customer basis:** Week 7 change 1: "Existing bookings that become problematic under the new rule should be identified rather than silently removed."

**Why this is a new story:** no story finds the bookings that a change to a venue's times makes clash. Flags and their resolution are SCRUM-26.

**Change log**

* 2026-10-07 (Week 7 change 1): created.
* 2026-10-09 (PO review): AC4 no longer covers loading times for many venues at once, because there is no bulk load and existing venues start at 0 minutes (SCRUM-159 AC1); Venue Staff edit venues one at a time, which AC1 checks. AC4 now requires the seed data not to create clashes between seeded bookings.

Functionality Area: Setup and Turnaround Time, Booking Conflict Detection

<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-08. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-161 - Mark a venue unavailable over existing bookings and find a replacement venue

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-7 - Venue Management |
| **Priority** | Highest |
| **Story points** | 5 |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-161 |

---

**User story:** As Venue Staff, I want to mark a venue unavailable even when events are booked there, so that the affected Coordinators can arrange another venue while their events stay intact.

**Acceptance criteria**

1. Given I record unavailability for a venue with a start, an end, a reason (Maintenance, Equipment failure, Renovation, Safety concern or Other) and an optional note, then it can be saved even when it overlaps future bookings, holds or pending requests. The end must be after the start. Unavailability that overlaps unavailability already recorded is still refused (SCRUM-37).
2. Given the period overlaps bookings, when I save, then I'm first shown each affected booking (event, Coordinator, status), and when I confirm, the unavailability is recorded.
3. Every Pending, Held or Approved booking whose occupied period overlaps the unavailability is flagged Needs Reconsideration (SCRUM-26) with the reason and period. Its status doesn't change, the event isn't cancelled, and the event's details don't change. A booking whose occupied period only touches the unavailability isn't flagged.
4. Each affected event's assigned Coordinator is notified that alternative arrangements are required, with the venue, reason and period (SCRUM-124).
5. Given a flagged booking, when its Coordinator chooses Find a replacement venue, then venue search (SCRUM-38) opens pre-filled from that booking and leaves out the unavailable venue, and the Coordinator can request a replacement (SCRUM-50, SCRUM-162) while the original booking stays visible and flagged.
6. While the unavailability overlaps it, the original booking can't be approved, held, confirmed or kept as Still stands. The Coordinator cancels it (SCRUM-26), which leaves the event's other bookings unchanged.
7. Given an approval and an unavailability for overlapping periods are saved at the same moment, then the unavailability is saved, and the booking ends up either refused or Approved and flagged, never Approved without a flag.
8. Recording the same unavailability twice saves it once and flags nothing new.

**Supersedes:** SCRUM-37 AC1 (reason list), AC3 (refused over an Approved booking), the booking half of AC4, and its Related note (managing unavailability beyond Release 1).

**Customer basis:** Week 7 change 2: "ConnectSphere needs Venue Staff to be able to mark a venue temporarily unavailable because of maintenance, equipment failure, renovation, safety concerns, or other operational reasons. This may occur even when future events have already been booked at the venue. When this happens, the existing event itself should not automatically be cancelled. Instead, affected bookings should be identified and the relevant Event Coordinators informed that alternative arrangements are required. The system should preserve the original event information while allowing the coordinator to search for and request a replacement venue."

**Why this is a new story:** SCRUM-37 (Sprint 2, Done) refuses unavailability that overlaps an Approved booking. "Venue Unavailability Management" was on the Week 4 not-required list; Week 7 makes it required in this form.

**Change log**

* 2026-10-07 (Week 7 change 2): created.

Functionality Area: Venue Unavailability Management, Booking Conflict Detection

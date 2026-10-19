<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-18. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-162 - Book several venues for one event

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-7 - Venue Management |
| **Priority** | Highest |
| **Story points** | 5 |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-162 |

---

**User story:** As an Event Coordinator, I want to book more than one venue for the same event, so that a large event can use a main hall and breakout rooms at the same time.

**Acceptance criteria**

1. Given I'm the event's assigned Coordinator, when I request a venue for an event that already has bookings at other venues, then a new booking request is created for that venue, linked to the same event.
2. Given the event already has a Pending, Held or Approved booking at a venue, when I request that venue again, then no request is created and I'm shown the existing one. A Rejected, Expired or Cancelled booking doesn't stop a new request for that venue.
3. Each request is checked on its own: suitability (SCRUM-40) against the attendance and needs entered for that venue, and availability and conflicts (SCRUM-159). Venue Staff decide each one separately (SCRUM-53, SCRUM-163).
4. Given I request a venue, then its period is pre-filled from the event and must cover the event's whole period (a shorter period is refused), and its attendance defaults to the event's expected attendance and must be a whole number from 1 to that figure.
5. Given one booking is rejected, withdrawn (SCRUM-142), flagged or cancelled, then the event's other bookings don't change. Only cancelling the event (SCRUM-82) or rejecting it (SCRUM-117) releases all its bookings, holds and pending requests, in one operation.
6. Given two requests for the same venue and event are submitted at the same moment, then only one is created.
7. The event page lists every booking with its venue, attendance and status. Once the event is Confirmed, the Organiser sees every Approved venue (SCRUM-81), and Attendees see the name and location of every Approved venue (SCRUM-72).
8. The readiness checklist's Venue item (SCRUM-110) lists each booking and is complete only when at least one booking is Approved, none is Pending or Held, every Approved booking covers the event's period, and none is flagged.
9. Each request records, for that venue, the attendance, required facilities, accessibility features and layout, entered by the Coordinator.

**Supersedes:** SCRUM-50 AC1 (attendance fixed to the event's) and AC8 (one venue per event), SCRUM-72 AC2, SCRUM-81 AC6, SCRUM-110 AC1–AC2, and SCRUM-117 AC3 (one booking released).

**Customer basis:** Week 7 change 3: "The system must therefore allow a single event to have more than one venue booking. Each venue should be checked independently for suitability, availability, and conflicts, while still remaining associated with the same event. Changes or cancellation of one venue arrangement should not automatically remove the other venue bookings unless this is explicitly required."

**Why this is a new story:** SCRUM-50 (Sprint 2, Done) allows one venue per event and fixes the booking's attendance to the event's, and SCRUM-72, SCRUM-81, SCRUM-110 and SCRUM-117 (Done) assume one venue. Tasks SCRUM-143 and SCRUM-149, which would have enforced those rules, are closed.

**Change log**

* 2026-10-07 (Week 7 change 3): created.
* 2026-10-16 (W9 clarifications, `PO approved`): AC9 added. Each venue request records its own attendance, required facilities, accessibility features and layout, so a replacement room keeps needs such as wheelchair access (accessibility counts for suitability per G4, and the safety check shows it per venue, SCRUM-166 AC2). A separate capacity refusal isn't needed; SCRUM-50 AC6 already covers it.

Functionality Area: Venue Booking Request, Venue Suitability Checking, Booking Conflict Detection

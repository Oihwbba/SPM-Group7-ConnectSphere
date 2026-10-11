<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-11. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-124 - Staff and arrangement notifications

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-8 - Event Change & Notifications |
| **Priority** | Highest |
| **Story points** | 5 |
| **Status in Jira** | In Progress |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-124 |

---

**User story:** As Venue Staff, Technical Support Staff, an Event Coordinator, an Event Coordinator Lead or a Safety Officer, I want to be notified when an arrangement or request I'm responsible for is requested, decided, put at risk or waiting for me, so that I can act without checking manually.

**Acceptance criteria**

1. Given a venue booking is requested (SCRUM-50, SCRUM-162), then all Venue Staff are notified.
2. Given an equipment request is submitted (SCRUM-27) or its lines are changed (SCRUM-142), then all Technical Support Staff are notified.
3. Given a pending venue request or a whole equipment request is withdrawn (SCRUM-142), then all Venue Staff, or all Technical Support Staff, are notified.
4. Given a venue booking is approved, held or rejected (SCRUM-53, SCRUM-163), then the event's assigned Coordinator is notified, with the deadline and note if it was held, or the reason if it was rejected.
5. Given a hold is placed, then a reminder for 24 hours before its expiry (or straight away if less time remains) and an expiry notice are written for the assigned Coordinator with show-from times (SCRUM-48), so they arrive on time without a scheduled job. Both are withdrawn if the hold is confirmed, released or rejected first (SCRUM-163).
6. Given the Coordinator confirms or releases a hold (SCRUM-163), then all Venue Staff are notified.
7. Given an Organiser raises a change request (SCRUM-41), then the event's assigned Coordinator is notified.
8. Given a venue booking or an equipment reservation is flagged Needs Reconsideration (SCRUM-26, SCRUM-32, SCRUM-34, SCRUM-160, SCRUM-161, SCRUM-166), then the assigned Coordinator is notified with the reason, and so are all Venue Staff for a booking or all Technical Support Staff for a reservation. When the flag comes from venue unavailability (SCRUM-161), the Coordinator's notice says alternative arrangements are required and gives the venue, reason and period.
9. Given a flag is resolved (SCRUM-26), then all Venue Staff are notified for a booking, or all Technical Support Staff for a reservation.
10. Given a request is submitted (SCRUM-14), then every Lead is notified that it is waiting in the Unassigned queue (SCRUM-165).
11. Given a Coordinator requests a safety check, then every Safety Officer is notified. Given an outcome is recorded, then the assigned Coordinator is notified with the note (SCRUM-166).
12. Each notification names the event and the arrangement, says what happened, and links to it.
13. Venues and equipment have no named owner in Release 1, so staff notifications go to everyone with that role. This is an intentional Release 1 trade-off; the current model can therefore notify a large staff population rather than a named owner. Leads and Safety Officers are notified the same way.
14. Each trigger creates exactly one notification per recipient; retries create no duplicates.
15. Notifications appear in the same list as all others (SCRUM-48).

**Related:** the Coordinator's notification when Technical Support reviews an equipment request is already sent by SCRUM-28, so it isn't repeated here. Assignment and reassignment notices to the Coordinator and Organiser are SCRUM-45.

**Customer basis:** "Changes trigger notifications to staff." Briefing §6 examples: "A venue booking is requested, approved, rejected, or changed." "Requested equipment is confirmed or found to be unavailable." "The Event Organiser requests a significant change." Week 7 change 2: "the relevant Event Coordinators informed that alternative arrangements are required." Week 7 change 4: "The Event Coordinator should be informed before or when the hold expires." Week 7 change 5: "Relevant users should be notified when assignments or reassignments occur."

**Change log**

* 2026-10-01: rewritten as a trigger table; recipients defined (all staff in the role, since venues have no owners); added flag resolution; moved from the Equipment epic to Event Change & Notifications. SCRUM-51 has been closed as merged.
* 2026-10-01 (audit): the table is now one numbered criterion per trigger. The equipment criteria match the built model: a request is reviewed as a whole (SCRUM-28 already notifies the Coordinator) and flags sit on reservations. Added line changes and venue-request withdrawal from SCRUM-142. Flag sources trimmed to Release 1 stories: SCRUM-37 refuses unavailability over an approved booking rather than flagging it, and SCRUM-119 is beyond Release 1. The briefing examples are quoted separately rather than joined.
* 2026-10-07 (Week 7 changes 1, 2, 4, 5 and 6): new triggers for holds (AC4 to AC6, SCRUM-163); flags from setup or turnaround changes, venue unavailability and safety outcomes (AC8: SCRUM-160, SCRUM-161, SCRUM-167); new requests for Leads (AC10, SCRUM-165); and safety checks (AC11, SCRUM-166). AC3 adds withdrawing a whole equipment request (SCRUM-142), an audit edit that didn't save on 1 Oct. The user story now includes Leads and Safety Officers. Re-estimated from 3 to 5 points.
* 2026-10-07 (backlog refinement): AC8 points to SCRUM-166, which SCRUM-167 was merged into.

Functionality Area: Notification System

<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-04. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-124 - Staff and arrangement notifications

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-8 - Event Change & Notifications |
| **Priority** | High |
| **Story points** | 3 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-124 |

---

**User story:** As Venue Staff, Technical Support Staff or an Event Coordinator, I want to be notified when an arrangement I'm responsible for is requested, decided or put at risk, so that I can act without checking manually.

**Acceptance criteria**

1. Given a venue booking is requested (SCRUM-50), then all Venue Staff are notified.
2. Given an equipment request is submitted (SCRUM-27) or its lines are changed (SCRUM-142), then all Technical Support Staff are notified.
3. Given a pending venue request is withdrawn (SCRUM-142), then all Venue Staff are notified.
4. Given a venue booking is approved or rejected (SCRUM-53), then the event's assigned Coordinator is notified, with the reason if it was rejected.
5. Given an Organiser raises a change request (SCRUM-41), then the event's assigned Coordinator is notified.
6. Given a venue booking or an equipment reservation is flagged Needs Reconsideration (SCRUM-26, SCRUM-32, SCRUM-34), then the assigned Coordinator is notified, and so are all Venue Staff for a booking or all Technical Support Staff for a reservation.
7. Given a flag is resolved (SCRUM-26), then all Venue Staff are notified for a booking, or all Technical Support Staff for a reservation.
8. Each notification names the event and the arrangement, says what happened, and links to it.
9. Venues and equipment have no named owner in Release 1, so staff notifications go to everyone with that role. This is an intentional Release 1 trade-off; the current model can therefore notify a large staff population rather than a named owner.
10. Each trigger creates exactly one notification per recipient; retries create no duplicates.
11. Notifications appear in the same list as all others (SCRUM-48).

**Related:** the Coordinator's notification when Technical Support reviews an equipment request is already sent by SCRUM-28, so it isn't repeated here.

**Customer basis:** "Changes trigger notifications to staff." Briefing §6 examples: "A venue booking is requested, approved, rejected, or changed." "Requested equipment is confirmed or found to be unavailable." "The Event Organiser requests a significant change."

**Change log**

* 2026-10-01: rewritten as a trigger table; recipients defined (all staff in the role, since venues have no owners); added flag resolution; moved from the Equipment epic to Event Change & Notifications. SCRUM-51 has been closed as merged.
* 2026-10-01 (audit): the table is now one numbered criterion per trigger. The equipment criteria match the built model: a request is reviewed as a whole (SCRUM-28 already notifies the Coordinator) and flags sit on reservations. Added line changes and venue-request withdrawal from SCRUM-142. Flag sources trimmed to Release 1 stories: SCRUM-37 refuses unavailability over an approved booking rather than flagging it, and SCRUM-119 is beyond Release 1. The briefing examples are quoted separately rather than joined.

Functionality Area: Notification System

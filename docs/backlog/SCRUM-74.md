<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-13. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-74 - Be prevented from registering for a full event

| | |
|---|---|
| **Epic** | SCRUM-11 - Attendee Registration |
| **Priority** | High |
| **Story points** | 3 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-74 |

---

**As an Attendee**, I want to be told clearly when an event is full rather than having my registration silently fail, so that I know to look elsewhere.

**Acceptance Criteria:**

* Given an event has remaining capacity, when an Attendee registers, then the registration is accepted and remaining capacity decreases by exactly one.
* Given an event with remaining capacity of one, when two Attendees register at the same moment, then exactly one succeeds and the other is told the event is full.
* Given a full event, when an Attendee opens it, then the register action is unavailable and the event is shown as full.
* Given a full event, when a registration request is submitted directly, then it is refused and no registration is created.
* Given a full event, when an existing Attendee withdraws, then remaining capacity increases by one and registration reopens.
* Given a registration capacity of zero or a negative number, when it is set on an event, then it is rejected as invalid - capacity must be a positive whole number.
* Registration capacity is stated per event and is not silently assumed to equal the venue's maximum capacity.

**Note:** the concurrency case in the second criterion is the one that matters. The project rubric's Excellent descriptor for working software names "conflict, change, and failure scenarios" specifically, and this is the registration epic's conflict scenario - the direct counterpart of double-booking in Venue Management. Test it with two simultaneous requests, not two sequential ones.

**Open question for the customer:** is registration capacity a separate number set per event, or always the venue's capacity? This changes the story materially.

**Note (2026-09-07):** the accepted-side criterion and the capacity-validity rule were added following the Week 2 assignment feedback, which asked for observable behaviour on both sides of a limit and for the valid range of a capacity value to be stated. The simultaneous-registration criterion this story already had is the pattern that feedback singled out as strong.

**INVEST:** Independent (needs "Register for an event"); Negotiable (whether a full event is hidden or shown as full, and where capacity comes from, are both open); Valuable (an event oversubscribed past its venue's capacity is a real-world failure on the day); Estimable and Small (one boundary check, one concurrency guard); Testable (boundary at capacity-1, capacity, capacity+1, plus the simultaneous case).

Functionality Area: Attendee Registration

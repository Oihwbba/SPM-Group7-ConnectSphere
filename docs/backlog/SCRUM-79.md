<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-04. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-79 - Join a waiting list when an event is full

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-11 - Attendee Registration |
| **Priority** | Low |
| **Story points** | 3 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-79 |

---

**Beyond Release 1** (label `beyond-release-1`): Waiting List is on the Week 4 list of features not required for Release 1, and the team's 13 Sep customer Q&A register records "Keep it out". The customer's answer below says how it should work when it is built. Building it later also adds the waiting-list count to SCRUM-70, the Waitlisted status to SCRUM-131 and the waiting-list notifications to SCRUM-85; the Release 1 versions of those stories leave them out.

**User story:** As an Attendee, I want to join a waiting list when an event is full, so that I'm offered a place if someone withdraws.

**Acceptance criteria**

1. Given a Confirmed event is full and registration is open, I can join its waiting list instead of registering, and I see my position.
2. Waiting-list entries don't count toward capacity. I can't be Registered and Waitlisted for the same event at the same time.
3. Given a place opens while registration is open (a withdrawal, SCRUM-77, or a higher expected attendance once the event is Confirmed again after SCRUM-128), then the first person on the list is offered it and notified. The place is held for them for 24 hours or until registration closes, whichever comes first.
4. Given I accept within the hold, then my entry becomes Registered and remaining places drop by one.
5. Given I decline or the hold expires, then I leave the list and the next person is offered the place.
6. Only one offer can exist for each open place, even if two places open at the same moment.
7. I can leave the list at any time.
8. Given registration closes or the event starts, then remaining entries become Cancelled and their holders are notified.
9. Given the event is cancelled, then entries become Cancelled and their holders are notified.
10. The Organiser and Coordinator see the waiting-list count and order in the registration list (SCRUM-70).

**Customer basis:** "Registration period can be extended; waiting list supported." Earlier clarification: "Waiting list operates on a first-come, first-served priority, where eligible attendees are notified when a slot opens up to apply. Organisers have discretion over registration/withdrawal conditions." The 24-hour hold is a team proposal; confirm with the customer before building.

**Change log**

* 2026-10-01: brought into Release 1. The previous note said waitlists were not among the core features, but the customer's answer above sits inside core feature #18. Acceptance criteria rewritten to match the customer's first-come, first-served rule.
* 2026-10-01 (verification pass): AC3 now offers places only while registration is open, because an approved impactful change pauses registration until the event is Confirmed again (SCRUM-128 AC5).
* 2026-10-01 (audit): beyond Release 1 again (label `beyond-release-1`). The Week 4 instructions name Waiting List as not required for Release 1, which outweighs reading it into core feature #18, and the team decided to keep it out on 13 Sep. SCRUM-70, 77, 82, 85 and 131 no longer mention waiting-list entries.

Functionality Area: Attendee Registration

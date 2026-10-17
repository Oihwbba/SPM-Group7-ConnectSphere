<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-15. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-75 - Control and enforce the registration period

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-11 - Attendee Registration |
| **Priority** | Medium |
| **Story points** | 2 |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-75 |

---

**User story:** As an Event Organiser, I want to close and reopen registration for my event, and as an Attendee I want the registration period enforced, so that nobody registers outside the permitted period.

**Acceptance criteria**

1. Removed (2026-10-08): setting a registration window is beyond Release 1. Windows come only from the seed data.
2. Registration is open from the later of the opening time and the moment the event becomes Confirmed, up to but not including the closing time. It never opens before the event is Confirmed.
3. Removed (2026-10-08): there is no window entry to validate.
4. Given no window is set, then registration opens when the event is Confirmed (SCRUM-81) and closes at the event's start.
5. Removed (2026-10-08): extending the window is beyond Release 1.
6. Given my event needs registration (SCRUM-171) and registration is open, when I close it, then it closes immediately and the event stays listed to Attendees as closed (SCRUM-72). When I reopen it, it is open until the event's start. The assigned Coordinator can close or reopen it on my behalf.
7. Given the current time is before opening, then Attendees can't register and see the opening time. Given it is at or after closing, then Attendees see registration as closed. A direct registration request outside the window is refused.
8. Registration is never accepted at or after the event's start, whatever the window says.
9. Given the event returns to Planning (SCRUM-128, SCRUM-26), then registration pauses. When the event is Confirmed again, the same window applies; if its closing time has passed, registration stays closed until I reopen it, and it is then open until the event's start (AC6).
10. Registration times are shown in Singapore time (SCRUM-129).
11. Given a Confirmed event's Registration needed changes from No to Yes (SCRUM-171, SCRUM-128), then registration opens as in AC4.

**Customer basis:** Step 11: "Where registration is required, Attendees can register for the confirmed event during the permitted registration period and subject to the applicable capacity." G4 (Attendee Registration): "Registration is based on first come first serve and also based on Organiser discretion." AC6 (the Organiser closes and reopens registration) is a team decision based on "Organiser discretion".

**Change log**

* 2026-10-01: window can be set during Planning; start included, end excluded; behaviour after a return to Planning added.
* 2026-10-01 (audit): AC1 now depends on the Registration needed choice (SCRUM-127) instead of a flag nothing set. Closing manually is its own state, separate from an event that doesn't need registration, so a closed event stays listed (SCRUM-72). AC8 now carries the start-time cut-off for SCRUM-73, which the merged code doesn't check yet.
* 2026-10-07: the customer basis notes that the waiting list in the second answer is beyond Release 1 (SCRUM-79). No Week 7 change.
* 2026-10-07: AC1 points the Registration needed choice to SCRUM-171, which took it over when SCRUM-127 was split.
* 2026-10-08 (backlog refinement, PO approved): re-estimated from 3 to 2 points. Step 11 asks for a "permitted registration period" and our G4 answer for "Organiser discretion", but neither asks for the Organiser to set the opening and closing times, so setting and extending the window are removed (AC1, AC3, AC5; numbers kept because code and tests cite AC2, AC4, AC7 and AC8). AC4's default now applies to every new event. AC6 and AC9 reopen registration until the event's start. AC6 applies only to events that need registration (SCRUM-171). Customer basis replaced with our G4 answers; the earlier quotes were not from our section.
* 2026-10-14: AC11 added, moved from SCRUM-171 AC5, so registration-window behaviour stays in this story.

Functionality Area: Attendee Registration

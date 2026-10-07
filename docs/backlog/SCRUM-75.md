<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-07. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-75 - Control and enforce the registration period

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-11 - Attendee Registration |
| **Priority** | High |
| **Story points** | 3 |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-75 |

---

**User story:** As an Event Organiser, I want to control when registration opens and closes, and as an Attendee I want that window enforced, so that nobody registers outside the permitted period.

**Acceptance criteria**

1. Given my event needs registration (SCRUM-127) and is in Planning or Confirmed, I can set a registration opening and closing time. The assigned Coordinator can set it on my behalf.
2. Registration is open from the later of the opening time and the moment the event becomes Confirmed, up to but not including the closing time. It never opens before the event is Confirmed.
3. The closing time must be after the opening time and no later than the event's start.
4. Given no window is set, then registration opens when the event is Confirmed (SCRUM-81) and closes at the event's start.
5. Given registration is open, when I move the closing time to a later valid time, then registration stays open until the new closing time.
6. Given registration is open, when I close it manually, then it closes immediately and the event stays listed to Attendees as closed (SCRUM-72). It reopens only if I set a new valid window.
7. Given the current time is before opening, then Attendees can't register and see the opening time. Given it is at or after closing, then Attendees see registration as closed. A direct registration request outside the window is refused.
8. Registration is never accepted at or after the event's start, whatever the window says.
9. Given the event returns to Planning (SCRUM-128, SCRUM-26), then registration pauses. When the event is Confirmed again, the same window applies; if its closing time has passed, registration stays closed until I set a new window.
10. Times are entered and shown in Singapore time (SCRUM-129).

**Customer basis:** "Registration may opens once event is confirmed; organiser control timing." "Registration period can be extended; waiting list supported. At the moment closure is based on Organiser discretion and manually close the registration." The waiting list in the second answer is beyond Release 1 (SCRUM-79).

**Change log**

* 2026-10-01: window can be set during Planning; start included, end excluded; behaviour after a return to Planning added.
* 2026-10-01 (audit): AC1 now depends on the Registration needed choice (SCRUM-127) instead of a flag nothing set. Closing manually is its own state, separate from an event that doesn't need registration, so a closed event stays listed (SCRUM-72). AC8 now carries the start-time cut-off for SCRUM-73, which the merged code doesn't check yet.
* 2026-10-07: the customer basis notes that the waiting list in the second answer is beyond Release 1 (SCRUM-79). No Week 7 change.

Functionality Area: Attendee Registration

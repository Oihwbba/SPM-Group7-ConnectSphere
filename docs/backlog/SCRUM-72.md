<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-04. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-72 - View an event I could attend

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-11 - Attendee Registration |
| **Priority** | Highest |
| **Story points** | 2 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 2 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-72 |

---

**User story:** As an Attendee, I want to browse confirmed events and see whether registration is available, so that I can decide whether to attend.

**Acceptance criteria**

1. I can browse a list of Confirmed events.
2. Each event shows its name, description, date, time, venue name and location.
3. Each event shows its registration period, if one is set, and its remaining places.
4. Given registration hasn't opened yet, has been closed manually, or has ended, then the event is still listed, but the register action is unavailable and the current registration state is shown.
5. Given no registration period is set, then the default in SCRUM-73 applies.
6. Given the event is full, then it stays listed and is shown as Full.
7. Cancelled events, and events that are not Confirmed, are not listed.
8. Opening an event directly by its URL follows the same rules as the list.

**Boundary:** this story owns the list and the Attendee event view. Hiding events that don't need registration is SCRUM-127; when registration opens is SCRUM-73, SCRUM-75 and SCRUM-81; registration privacy is SCRUM-70; an Attendee whose event returns to Planning is covered by SCRUM-133.

**Change log**

* 2026-10-01 (mid-sprint correction): AC1 hid events with registration turned off (withdrawn below).
* 2026-10-01 (audit): AC1 restored to the built behaviour: every Confirmed event is listed. The code has one registration flag, so hiding "registration turned off" events contradicted AC4 (manually closed events stay listed). Hiding events that don't need registration moved to SCRUM-127, which adds the Registration needed choice.

Functionality Area: Attendee Registration

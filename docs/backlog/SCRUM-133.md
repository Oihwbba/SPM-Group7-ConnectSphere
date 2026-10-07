<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-08. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-133 - [MERGED INTO SCRUM-85] Attendees see a clear status while a registered event is being re-planned

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-11 - Attendee Registration |
| **Priority** | Medium |
| **Story points** | 0 |
| **Status in Jira** | Done |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-133 |

---

**Merged into SCRUM-85 on 2026-10-07 (backlog refinement).** This story's AC1–AC5 are SCRUM-85 AC8–AC12, in the same order. References to SCRUM-133 in other stories now mean SCRUM-85. The original text is kept below for history.



**User story:** As an Attendee, I want to see that an event I registered for is being updated, so that I'm not confused when it disappears from the event list or shows an internal status.

**Acceptance criteria**

1. Given an event I'm registered for returns to Planning (SCRUM-128 or SCRUM-26), when I view my registrations (SCRUM-76), then it shows "Details being updated – registration paused" and never the internal status "Planning".
2. Given the same event, when I open it from my registrations or from a notification (SCRUM-48), then I see the Attendee view: name, description and the last confirmed date, time and venues, with no internal planning information.
3. The event is not listed in the browse list (SCRUM-72) until it is Confirmed again, and my registration stays Registered.
4. Given it becomes Confirmed again, then the normal Attendee view returns, and I'm notified if the date, time or venue changed (SCRUM-85).
5. Given it is cancelled instead (SCRUM-82), then my registration shows Cancelled and I'm notified (SCRUM-85).

**Customer basis:** Requirement 8b: "an Attendee should not be able to view internal planning information."

**Why this is a new story:** SCRUM-23 (Sprint 1, Done) shows the raw event status, and SCRUM-72 lists only Confirmed events. A registered Attendee could therefore see "Planning" or follow a notification link to a page they cannot open.

**Change log**

* 2026-10-07 (Week 7 change 3): AC2 shows every last confirmed venue, because an event can now have several (SCRUM-162).

Functionality Area: Attendee Registration

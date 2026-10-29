<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-29. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-129 - Show and store all event times in Singapore time

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Medium |
| **Story points** | 1 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 2 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-129 |

---

**User story:** As an Event Organiser, I want event times entered and shown in Singapore time, so that the times I see match the venue's opening hours and what Attendees see.

**Acceptance criteria**

1. New event requests use Asia/Singapore (UTC+8) as the event timezone. The timezone selector from SCRUM-13 is removed from the request form.
2. Existing events saved with another timezone keep their stored instants and are displayed in Singapore time.
3. Every displayed time (event pages, the venue calendar in SCRUM-36, the all-events list in SCRUM-141, notifications, registration windows) is labelled "SGT".
4. Stored instants remain UTC, as in SCRUM-13 AC6.
5. Time periods everywhere follow one convention: a period includes its start instant and excludes its end instant, so periods that only touch do not overlap.

**Supersedes:** SCRUM-13 AC1, AC4 and AC6 (the Organiser chooses the event's timezone, which is mandatory and used to display its times).

**Customer basis:** ConnectSphere "operates and owns several event facilities within Singapore" (briefing §1). Team decision; confirm at the next customer Q&A.

**Why this is a new story:** SCRUM-13 (Sprint 1, Done) lets the Organiser pick any timezone. Venue opening hours (SCRUM-34) are in Singapore time, so an event entered in another timezone shows its times and the venue's hours on different clocks.

**Change log**

* 2026-10-01 (audit): AC3 names the all-events list (SCRUM-141) instead of the event calendar (SCRUM-120, beyond Release 1). Opening hours are owned by SCRUM-34.
* 2026-10-29 (SCRUM-243, PO approval pending): added the Supersedes line for SCRUM-13 AC1, AC4 and AC6, which AC1 already changed; SCRUM-13 now carries a matching note. Criteria unchanged.

Functionality Area: Event Request Creation

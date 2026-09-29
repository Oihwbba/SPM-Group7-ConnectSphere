<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-30. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-40 - Flag venue suitability, with the reason

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-7 - Venue Management |
| **Priority** | Medium |
| **Story points** | 2 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-40 |

---

Merged story (29 Sep 2026): absorbs SCRUM-49 (Show Reason for Unsuitability). Any reference to SCRUM-49 elsewhere now means this story. SCRUM-35 is now part of SCRUM-34.

As an Event Coordinator, I want to see whether a venue appears suitable for my event based on attendance, capacity, required facilities, accessibility and layout, so that I don't pursue unsuitable venues.

Acceptance Criteria

* Given expected attendance is strictly greater than the venue's capacity, when suitability is evaluated, then the venue is marked "not suitable".
* Given expected attendance is exactly equal to the venue's capacity, when suitability is evaluated, then the venue is marked suitable — the venue is only unsuitable once attendance exceeds capacity.
* Given a required facility is unavailable at the venue, when suitability is evaluated, then the venue is marked "not suitable" regardless of capacity.
* Given the event states an accessibility need the venue does not provide, when suitability is evaluated, then the venue is marked "not suitable".
* Given the event states a required room layout the venue does not support, when suitability is evaluated, then the venue is marked "not suitable".
* Given expected attendance is within capacity and every required facility, accessibility need and layout is met, when suitability is evaluated, then the venue is marked suitable.
* Suitability indicator is visible on search results and venue detail views.

Decision record (2026-09-13): Accessibility and layout mismatches count as suitability failures. Suitability therefore covers four dimensions: capacity, facilities, accessibility and supported layout.

Planning note: This story should be estimated based on all four dimensions. Event-side fields are defined in SCRUM-13 and venue-side attributes in SCRUM-34/35.

Functionality Area: Venue Management

---

Merged from SCRUM-49 — Show Reason for Unsuitability

User Story
As an Event Coordinator, I want to see the specific reason a venue is flagged unsuitable, so that I understand why before deciding whether to proceed.

Acceptance Criteria

* Reason(s) displayed, naming the mismatch and both values where relevant — e.g. "Capacity 100 < expected attendance 150", "Missing facility: AV equipment".
* Reasons cover all four suitability dimensions in SCRUM-40: capacity, required facilities, accessibility and supported layout — e.g. "No wheelchair access; event requires step-free entry", "Venue does not support banquet layout".
* Multiple reasons are all listed if more than one applies.
* Given a venue is suitable, when the Coordinator views it, then no unsuitability reasons are shown.

Note (2026-09-13): the accessibility and layout reasons follow from the customer's answer on SCRUM-40 — "Yes, accessibility/layout mismatches count and should be reflected by the co-ordinator on suitability." A venue can now be marked unsuitable for reasons this story previously had no vocabulary to explain. The suitable-side criterion was added so the story states behaviour on both sides of the flag.

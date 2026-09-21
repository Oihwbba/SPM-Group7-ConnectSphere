<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-21. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-40 - Flag Venue Suitability

| | |
|---|---|
| **Epic** | SCRUM-7 - Venue Management |
| **Priority** | Medium |
| **Story points** | 2 |
| **Status in Jira** | To Do|
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-40 |

---

**As an Event Coordinator**, I want to see whether a venue appears suitable for my event based on attendance, capacity, required facilities, accessibility and layout, so that I don't pursue unsuitable venues.

**Acceptance Criteria**

- Given expected attendance is strictly greater than the venue's capacity, when suitability is evaluated, then the venue is marked "not suitable".
- Given expected attendance is exactly equal to the venue's capacity, when suitability is evaluated, then the venue is marked suitable — the venue is only unsuitable once attendance exceeds capacity.
- Given a required facility is unavailable at the venue, when suitability is evaluated, then the venue is marked "not suitable" regardless of capacity.
- Given the event states an accessibility need the venue does not provide, when suitability is evaluated, then the venue is marked "not suitable".
- Given the event states a required room layout the venue does not support, when suitability is evaluated, then the venue is marked "not suitable".
- Given expected attendance is within capacity and every required facility, accessibility need and layout is met, when suitability is evaluated, then the venue is marked suitable.
- Suitability indicator is visible on search results and venue detail views.

**Decision record (2026-09-13):** Accessibility and layout mismatches count as suitability failures. Suitability therefore covers four dimensions: capacity, facilities, accessibility and supported layout.

**Planning note:** This story should be estimated based on all four dimensions. Event-side fields are defined in SCRUM-13 and venue-side attributes in SCRUM-34/35.

Functionality Area: Venue Management

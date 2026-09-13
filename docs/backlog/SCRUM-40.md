<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-13. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-40 - Flag Venue Suitability

| | |
|---|---|
| **Epic** | SCRUM-7 - Venue Management |
| **Priority** | Medium |
| **Story points** | 2 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-40 |

---

**User Story**
As an Event Coordinator, I want to see whether a venue appears suitable for my event based on attendance, capacity, required facilities, accessibility and layout, so that I don't pursue unsuitable venues.

**Acceptance Criteria**

* Given expected attendance is strictly greater than the venue's capacity, when suitability is evaluated, then the venue is marked "not suitable".
* Given expected attendance is exactly equal to the venue's capacity, when suitability is evaluated, then the venue is marked suitable — the venue is only unsuitable once attendance exceeds capacity.
* Given a required facility is unavailable at the venue, when suitability is evaluated, then the venue is marked "not suitable" regardless of capacity.
* **Given the event states an accessibility need the venue does not provide, when suitability is evaluated, then the venue is marked "not suitable".**
* **Given the event states a required room layout the venue does not support, when suitability is evaluated, then the venue is marked "not suitable".**
* Given expected attendance is within capacity and every required facility, accessibility need and layout is met, when suitability is evaluated, then the venue is marked suitable.
* Suitability indicator is visible on search results and venue detail views.

**Customer clarification (2026-09-13) — resolves the open question:** _"Yes, accessibility/layout mismatches count and should be reflected by the co-ordinator on suitability."_

The story previously said explicitly that whether an accessibility or layout mismatch should flag a venue unsuitable was an open customer question and was "deliberately not asserted here". It is now answered yes, and the two criteria above are new. This closes Q8 in the customer Q&A log.

**⚠ Re-estimate before continuing.** Sized at 2 points over capacity and facilities only. Suitability now spans four dimensions, and accessibility and layout must be captured on both the event (SCRUM-13) and the venue (SCRUM-34/35) for the comparison to be possible. Check those two stories carry the fields before starting this one.

**Note (2026-09-07):** the equal-to-capacity boundary and the suitable-side behaviour were added following the Week 2 assignment feedback — a threshold needs stated behaviour on both sides, and "exceeds capacity" left the equal case undefined.

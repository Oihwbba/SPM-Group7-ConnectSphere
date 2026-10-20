<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-20. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-40 - Flag venue suitability, with the reason

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-7 - Venue Management |
| **Priority** | Highest |
| **Story points** | 3 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-40 |

---

**User story:** As an Event Coordinator, I want to see whether a venue appears suitable for my event, with the reasons, and record my own judgement, so that I don't pursue unsuitable venues.

**Acceptance criteria**

1. Given the attendance for this venue is greater than the venue's capacity, then the venue is marked Not suitable. Given it equals capacity, it is not marked unsuitable on capacity. The attendance for a venue is the attendance on that venue's booking request (SCRUM-162 AC4); in search results, before a request exists, it is the attendance entered in the search (SCRUM-38).
2. Given the booking request, or the search before a request exists, requires a facility that the venue doesn't have, then the venue is marked Not suitable.
3. Given the booking request, or the search before a request exists, needs an accessibility feature that the venue doesn't provide, then the venue is marked Not suitable. 
4. Given the booking request, or the search before a request exists, requires a room layout the venue doesn't support, then the venue is marked Not suitable only in the search.
5. Given none of AC1–AC4 applies, then the venue is marked Suitable and no reasons are shown.
6. Every reason that applies is listed, naming the mismatch and both values where relevant, e.g. "Capacity 100 < attendance 150", "Missing facility: projector", "No wheelchair access; event needs wheelchair access", "Banquet layout not supported".
7. The indicator and reasons appear on the booking request form for the chosen venue (SCRUM-50, SCRUM-162) and in search results (SCRUM-38). They are not shown on the venue detail view (SCRUM-34), which is opened without an event to compare against.
8. The assigned Coordinator can record a judgement for this event and venue, Suitable or Not suitable, with a note. It is shown next to the automatic result and is the result that counts for this event.
9. The judgement is advisory: it never blocks a booking request (SCRUM-50, SCRUM-162) or confirmation (SCRUM-110). A booking whose attendance is above the venue's capacity is refused by SCRUM-50 AC6 whatever the judgement says. Whether the venues together suit the whole audience is judged in the safety check (SCRUM-166).
10. The judgement and note are shown to Venue Staff on the booking request they review (SCRUM-52).

**Customer basis:** "Yes, accessibility/layout mismatches count and should be reflected by the co-ordinator on suitability." Week 7 change 3: "Each venue should be checked independently for suitability, availability, and conflicts."

**Change log**

* 2026-10-01: rewritten in one format; the judgement is advisory and shown to Venue Staff.
* 2026-10-01 (audit): AC2 and AC3 read the facilities and accessibility features the Organiser ticks in the request form (SCRUM-127); the form stored them as free text, which can't be compared. AC9 states that the built capacity refusal in SCRUM-50 still applies. Group headings removed.
* 2026-10-07 (Week 7 change 3): AC1 compares capacity with the attendance for that venue, because an event can now book several venues (SCRUM-162). AC9 leaves the combined fit to the safety check (SCRUM-166).
* 2026-10-07 (backlog refinement): AC1 uses each booking's own attendance, which every booking has under SCRUM-162 AC4, not only when the event uses several venues, and the attendance in the search before a booking exists.
* 2026-10-08: AC2–AC4 compare against what the Coordinator entered on the booking request or in the search, because SCRUM-127 was dropped and the Organiser's answers are free text.
* 2026-10-09: Remove "and on the venue detail view (SCRUM-34)", and add a sentence saying why it isn't shown there.
* 2026-10-10: Change SCRUM-40 AC9 to point to SCRUM-162 instead of SCRUM-50
* 2026-10-14: AC9 reference corrected to SCRUM-50 AC6. SCRUM-162 has no AC9; the 2026-10-10 change pointed to a criterion that doesn't exist.
* 2026-10-14: AC7 shows the indicator and reasons on the booking request form for the chosen venue (SCRUM-50, SCRUM-162) as well as in search results (SCRUM-38).
* 2026-10-14: AC4 Search still shows “layout not supported”, while the form preventing the mistake of mismatch between layout and venue is better (“layout not supported” is not shown)

Functionality Area: Venue Suitability Checking

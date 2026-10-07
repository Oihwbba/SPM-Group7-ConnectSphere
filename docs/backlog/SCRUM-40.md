<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-07. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-40 - Flag venue suitability, with the reason

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-7 - Venue Management |
| **Priority** | Highest |
| **Story points** | 3 |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-40 |

---

**User story:** As an Event Coordinator, I want to see whether a venue appears suitable for my event, with the reasons, and record my own judgement, so that I don't pursue unsuitable venues.

**Acceptance criteria**

1. Given the attendance for this venue is greater than the venue's capacity, then the venue is marked Not suitable. Given it equals capacity, it is not marked unsuitable on capacity. The attendance for a venue is the event's expected attendance, or the attendance entered for that venue's booking when the event uses several venues (SCRUM-162).
2. Given the event requires a facility (SCRUM-127) that the venue doesn't have, then the venue is marked Not suitable.
3. Given the event needs an accessibility feature (SCRUM-127) that the venue doesn't provide, then the venue is marked Not suitable.
4. Given the event requires a room layout the venue doesn't support, then the venue is marked Not suitable.
5. Given none of AC1–AC4 applies, then the venue is marked Suitable and no reasons are shown.
6. Every reason that applies is listed, naming the mismatch and both values where relevant, e.g. "Capacity 100 < attendance 150", "Missing facility: projector", "No wheelchair access; event needs wheelchair access", "Banquet layout not supported".
7. The indicator and reasons appear in search results (SCRUM-38) and on the venue detail view (SCRUM-34).
8. The assigned Coordinator can record a judgement for this event and venue, Suitable or Not suitable, with a note. It is shown next to the automatic result and is the result that counts for this event.
9. The judgement is advisory: it never blocks a booking request (SCRUM-50) or confirmation (SCRUM-110). A booking's attendance above the venue's capacity is refused by SCRUM-50 whatever the judgement says. Whether the venues together suit the whole audience is judged in the safety check (SCRUM-166).
10. The judgement and note are shown to Venue Staff on the booking request they review (SCRUM-52).

**Customer basis:** "Currently it is based on human judgement, co-ordinator will update." "Yes, accessibility/layout mismatches count and should be reflected by the co-ordinator on suitability." Week 7 change 3: "Each venue should be checked independently for suitability, availability, and conflicts."

**Change log**

* 2026-10-01: rewritten in one format; the judgement is advisory and shown to Venue Staff.
* 2026-10-01 (audit): AC2 and AC3 read the facilities and accessibility features the Organiser ticks in the request form (SCRUM-127); the form stored them as free text, which can't be compared. AC9 states that the built capacity refusal in SCRUM-50 still applies. Group headings removed.
* 2026-10-07 (Week 7 change 3): AC1 compares capacity with the attendance for that venue, because an event can now book several venues (SCRUM-162). AC9 leaves the combined fit to the safety check (SCRUM-166).

Functionality Area: Venue Suitability Checking

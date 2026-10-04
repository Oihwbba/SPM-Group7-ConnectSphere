<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-04. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-26 - Flag and resolve arrangements affected by a change

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | High |
| **Story points** | 5 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-26 |

---

**User story:** As an Event Coordinator, I want arrangements affected by a change to be flagged until I decide what to do with them, so that nothing stays booked on outdated details and nothing is cancelled behind my back.

**Acceptance criteria**

1. Given an event in Planning that has a venue booking or an equipment reservation, when I change the event's date, time, expected attendance, venue requirement or equipment requirement (SCRUM-127) to a different value, then I see which arrangements will be flagged and must confirm before the edit is saved. There is no warning if the value is unchanged or nothing is booked or reserved.
2. Needs Reconsideration is a flag on a venue booking (Pending or Approved) or an equipment reservation. Its status doesn't change.
3. A flag is raised by my confirmed edit in AC1, an approved impactful change request (SCRUM-128), a change to a venue's attributes or its retirement (SCRUM-34), or Technical Support reporting that reserved equipment can't be provided (SCRUM-32).
4. A flagged Approved booking or reservation keeps blocking its venue period or stock until it is resolved.
5. A flagged Pending venue request cannot be approved until the flag is resolved.
6. Given the event's date or time changed, flagged arrangements keep their original period; they are never moved to the new period automatically.
7. Only the assigned Coordinator can resolve a flag, by choosing Still stands or Cancel arrangement. Either choice records who and when.
8. Still stands is allowed only while the arrangement still covers the event's whole period, the venue (for a venue booking) is still active with no recorded unavailability over that period, and the reserved quantity still remains sufficient for the equipment reservation. Otherwise it is refused with the reason, and the Coordinator cancels the arrangement and requests again.
9. Cancel arrangement sets the booking or reservation to Cancelled and releases the venue period or stock exactly once.
10. Given the event is Confirmed and I cancel a flagged arrangement, then the event returns to Planning (SCRUM-135).
11. The system never cancels a booking or reservation just because it was flagged.
12. Given any booking or reservation for the event is flagged, then the readiness checklist (SCRUM-110) shows it as incomplete, so the event cannot be Confirmed until every flag is resolved.
13. Attendee registrations are never flagged; they stay Registered. Attendees learn about date, time or venue changes through SCRUM-85.
14. Changing the lines of an equipment request is covered by SCRUM-142; this story covers changes to the event's own fields.

**Notifications:** the assigned Coordinator, and Venue Staff for a booking or Technical Support for a reservation, are notified when a flag is raised or resolved (SCRUM-124).

**Customer basis:** "Changes require arrangements to be reviewed again; staff decide offline and coordinator update the system on the decision whether to cancel." "Adjustments must be handled manually by staff rather than through automatic un-booking." "If venue attributes change after booking… System can flag and it is up to the co-ordinator to decide on follow up action."

**Change log**

* 2026-10-01: "Needs Reconsideration" defined as a flag on top of a status; every flag source in one list; period freeze; flagged Pending requests can't be approved; readiness rule; change-request application moved to SCRUM-128; notification owner corrected to SCRUM-124.
* 2026-10-01 (audit): equipment flags now sit on reservations, matching the built equipment model (requests are reviewed, stock is held by reservations, SCRUM-31). Recorded venue unavailability (SCRUM-37) and equipment stock changes (SCRUM-119) are no longer flag sources: SCRUM-37 refuses an overlap with an approved booking, and SCRUM-119 is beyond Release 1. Still stands now also requires the arrangement to cover the event's period and the venue to be usable. Group headings removed.

Functionality Area: Event Information Management, Event Change Requests

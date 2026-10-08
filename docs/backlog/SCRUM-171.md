<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-09. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-171 - Record whether an event needs registration

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | High |
| **Story points** | 3 |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-171 |

---

**User story:** As an Event Organiser, I want to say whether my event needs registration, so that Attendees can only register for events that take registrations.

**Acceptance criteria**

1. On the request form (SCRUM-13), I choose Registration needed: Yes or No, and can add a note about registration.
2. Registration needed is required to submit (SCRUM-14); a draft can be saved without it (SCRUM-15).
3. Given a request was created before this story, then its free-text registration answer is kept and shown next to the new field.
4. Given Registration needed is No, then confirming the event (SCRUM-81) doesn't open registration, and the event isn't listed to Attendees or opened by its URL (SCRUM-72 AC8). An event that needs registration but whose registration is closed (SCRUM-75 AC6) is still listed.
5. Given the event has active registrations, Registration needed can't be changed to No, and the number of active registrations is shown. Given a Confirmed event's Registration needed changes to Yes (SCRUM-128), registration opens as in SCRUM-75 AC4.

**Related:** SCRUM-75 (registration window) applies only to events that need registration. The Event table already has a registrationRequired column that the form never sets.

**Customer basis:** "compulsory fields include name, description, purpose, dates/times, attendance, venue, accessibility, equipment, layout, registration etc." Step 11: "Where registration is required, Attendees can register for the confirmed event during the permitted registration period and subject to the applicable capacity."

**Why this is a new story:** SCRUM-13 (Sprint 1, Done) stores registration needs so nothing records whether an event needs registration. SCRUM-81 skips opening registration only for events marked as not needing it, and since the form never sets that, every Confirmed event opens registration and is listed (SCRUM-72).

**Change log**

* 2026-10-07 (backlog refinement): split from SCRUM-127, which was too big for one sprint. AC1 is SCRUM-127's former AC4; AC2 and AC3 are the registration parts of its former AC5 and AC6; AC4 is its former AC11.
* 2026-10-08 (backlog refinement, PO approved): re-estimated from 2 to 3 points. AC4 hides events by Registration needed, not by closed registration, because manually closed events stay listed (SCRUM-72 AC4, SCRUM-75 AC6). AC5 added for changing the answer after submission. "Why" corrected: confirming already respects the setting, but the form never sets it. SCRUM-127 was dropped; this story doesn't depend on it.

Functionality Area: Event Request Creation, Attendee Registration

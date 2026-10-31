<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-29. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-171 - Record whether an event needs registration

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | High |
| **Story points** | 3 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-171 |

---

**User story:** As an Event Organiser, I want to say whether my event needs registration, so that Attendees can only register for events that take registrations.

**Acceptance criteria**

1. On the request form (SCRUM-13), I choose Registration needed: Yes or No, and can add a note about registration.
2. Registration needed is required to submit (SCRUM-14); a draft can be saved without it (SCRUM-15).
3. Given a request was created before this story, then its free-text registration answer is kept and shown next to the new field.
4. Given Registration needed is No, then confirming the event (SCRUM-81) doesn't open registration, and the event isn't listed to Attendees or opened by its URL (SCRUM-72 AC8).
5. Given the event has active registrations, Registration needed can't be changed to No when it is edited directly (SCRUM-25), and the number of active registrations is shown. The same rule for a change request is applied by SCRUM-128 AC11.

**Related:** SCRUM-75 (registration window) applies only to events that need registration. The Event table already has a registrationRequired column that the form never sets.

**Supersedes:** SCRUM-72 AC1 and AC8 (every Confirmed event is listed and can be opened) and SCRUM-73 AC6 (registration opens when the event is Confirmed), for events whose Registration needed is No. SCRUM-13 AC1 and AC4's free-text registration needs (AC1 and AC2): the Organiser chooses Registration needed: Yes or No, which is required to submit, and the free text becomes an optional note.

**Customer basis:** "compulsory fields include name, description, purpose, dates/times, attendance, venue, accessibility, equipment, layout, registration etc." Step 11: "Where registration is required, Attendees can register for the confirmed event during the permitted registration period and subject to the applicable capacity."

**Why this is a new story:** SCRUM-13 (Sprint 1, Done) stores registration needs so nothing records whether an event needs registration. SCRUM-81 skips opening registration only for events marked as not needing it, and since the form never sets that, every Confirmed event opens registration and is listed (SCRUM-72).

**Change log**

* 2026-10-07 (backlog refinement): split from SCRUM-127, which was too big for one sprint. AC1 is SCRUM-127's former AC4; AC2 and AC3 are the registration parts of its former AC5 and AC6; AC4 is its former AC11.
* 2026-10-08 (backlog refinement, PO approved): re-estimated from 2 to 3 points. AC4 hides events by Registration needed, not by closed registration, because manually closed events stay listed (SCRUM-72 AC4, SCRUM-75 AC6). AC5 added for changing the answer after submission. "Why" corrected: confirming already respects the setting, but the form never sets it. SCRUM-127 was dropped; this story doesn't depend on it.
* 2026-10-10: Reword SCRUM-171 AC5 such that coordinator cannot edit the routine registration field (SCRUM-25) while registrations are active.
* 2026-10-14 (PO approved): AC4 drops the sentence about closed events staying listed (owned by SCRUM-75 AC6 and SCRUM-72 AC4). AC5's last sentence, opening registration when a Confirmed event changes to Yes, moved to SCRUM-75 AC11.
* 2026-10-17 (PO approved): AC5's change-request case moved to SCRUM-128 AC11, which applies change requests; this story keeps the rule for a direct edit (built in #209). No re-estimate: the rule and its message were built here and are reused by SCRUM-128.
* 2026-10-29 (SCRUM-239, PO approval pending): added the Supersedes line for SCRUM-72 AC1 and AC8 and SCRUM-73 AC6, which AC4 already changed; both stories now carry a matching note. Criteria unchanged.
* 2026-10-29 (SCRUM-243, PO approval pending): the Supersedes line also names SCRUM-13 AC1 and AC4's registration needs, which AC1 and AC2 already changed (decision by Felicia, 29 Oct); SCRUM-13 now carries a matching note. Criteria unchanged.

Functionality Area: Event Request Creation, Attendee Registration

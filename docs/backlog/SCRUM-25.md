<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-13. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-25 - Update routine event information during planning

| | |
|---|---|
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Medium |
| **Story points** | 3 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-25 |

---

**As an Event Coordinator**, I want to update an event's details during planning, so that the event record stays accurate as small details change.

**Acceptance Criteria:**

* Authorised users can edit permitted fields after submission. Authorised means the Coordinator assigned to the event and the Organiser who submitted it — each updating the information they own
* Routine edits do not change the event's status and do not trigger a reconsideration of existing bookings
* **"Routine" means any field other than date, time, expected attendance, venue and equipment.** Those five are impactful and are covered by SCRUM-26 instead
* Given an impactful field is edited, when the change is saved, then it follows SCRUM-26's flagging path rather than this story's silent-save path
* Operational notes about the event are stored here and are viewable by the users who took part in that event's workflow

**Customer clarification (2026-09-13) — confirms the working assumption:**

* _"Significant changes are those affecting arrangements (date/time, attendance, venue, equipment). Other edits are ordinary."_ The routine/impactful split the story previously carried as an unconfirmed assumption is now the customer's own wording. The "confirm this split with the customer" note is removed.
* _"Authorised users per role can update it's own info, typically the event co-ordinaor, and the organiser. Significant changes require review offline before changes are made on the system."_
* _"Event Information Management stores operational notes. Authorised users participated in the event workflow can view."_

Note the phrase **"review offline"**: for impactful changes the humans agree first and the system records the outcome. ConnectSphere is not expected to host the negotiation — the same pattern the customer described for coordinator handover and for resolving a "Needs Reconsideration" flag.

**INVEST:** Independent (a general edit capability, separable from the flagging logic in SCRUM-26); Negotiable (which specific non-impactful fields are editable by which of the two roles is still open); Valuable (planning is a multi-week process — the record must stay editable); Estimable/Small (a standard edit action); Testable (an edit persists and does not alter status; an impactful edit is routed to SCRUM-26).

Functionality Area: Event Information Management

<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-15. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-170 - Show the Organiser's requirements to the people planning the event

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | High |
| **Story points** | 3 |
| **Status in Jira** | In Progress |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-170 |

---

**User story:** User story: As an Event Coordinator, I want to see the Organiser's venue, accessibility and equipment answers while I request venues and equipment, and record when no equipment is needed, so that I book what was asked for and nothing requested is forgotten.

**Acceptance criteria**

1. Removed (2026-10-08): booked venues are shown by SCRUM-162 AC7.
2. Given I request a venue for the event (SCRUM-50, SCRUM-162), then the form shows the Organiser's Venue & Accessibility answers (venue requirements, preferred room layout, accessibility needs) read-only, and I enter the layout and facilities myself. Venue Staff see the same answers on the booking request they review (SCRUM-53).
3. Given I create an equipment request (SCRUM-27), then the form shows the Organiser's Equipment & Technical Support answer read-only, and I enter the equipment lines myself. Technical Support Staff see the same answer when they review the request (SCRUM-28).
4. The readiness checklist (SCRUM-110) always includes Equipment for an event in Planning. Until I create an equipment request or record No equipment needed, it shows Not decided and is incomplete. Recording No equipment needed keeps who and when. Given the event's equipment requirements change afterwards (SCRUM-128, SCRUM-26), then Equipment goes back to Not decided.
5. The event's details view shows the Organiser's form answers exactly as entered, the same for every event: under Venue & Accessibility Requirements, the venue requirements, preferred room layout and accessibility needs; under Equipment & Technical Support, the equipment requirements. It doesn't show Required Facilities. Facilities are entered by the Coordinator on each venue request (SCRUM-50, SCRUM-162) and shown there, not taken from the event.
6. Given I open venue search from my event or from one of its bookings (SCRUM-38, SCRUM-161), then the Organiser's Venue & Accessibility answers (venue requirements, preferred room layout, accessibility needs) are shown read-only beside the filters.

**Supersedes:** SCRUM-110 AC3 ("If there is no equipment request, the item isn't shown and doesn't block confirmation").

**Depends on:** SCRUM-162 for events with several venues.

**Related:** SCRUM-166 AC1 counts No equipment needed as a complete Equipment item.

**Customer basis:** "Essential arrangements depend on event needs (venue, equipment, etc.) but they must all be approved before an event can be confirmed." (Venue Booking Approval, Week 4 G4) "Event Coordinators can record equipment required for an event, including the equipment type, quantity, and relevant technical requirements." The briefing lists as problems: "Venue Staff may receive incomplete or outdated event requirements" and "Technical Support Staff may receive insufficient notice about upcoming equipment or support requirements."

**Why this is a new story:** SCRUM-50, SCRUM-27 and SCRUM-110 (Sprint 2, Done) don't show the Organiser's answers to the people planning, and the checklist can't tell whether equipment is needed. Required Facilities shows only on seeded events, because the request form has no facilities field.

**Change log**

* 2026-10-07 (backlog refinement): split from SCRUM-127, which was too big for one sprint. AC1–AC4 are SCRUM-127's former AC7–AC10, unchanged. SCRUM-127's former AC12 is now the Related note, because only SCRUM-38, SCRUM-40, SCRUM-26 and SCRUM-128 can test it.
* 2026-10-08 (backlog refinement, PO approved): SCRUM-127 dropped, so the Organiser's answers stay free text. They are shown, not pre-filled. AC1 removed (SCRUM-162 AC7 shows booked venues). AC2 and AC3 show the answers to the Coordinator, Venue Staff and Technical Support. AC4's second sentence removed (it repeated SCRUM-110 AC3); the first replaced with the Coordinator's No equipment needed decision, which resets if the equipment requirements change. AC5 added so every event's details view shows the same fields. Estimate stays at 3: removing the pre-fill is offset by the new decision and its reset.
* 2026-10-09: Added in AC6 so Coordinator knows what Organiser asked for.
* 2026-10-14 (PO approved): user story covers recording No equipment needed (AC4), which it didn't mention. No AC change.

Functionality Area: Venue Booking Request, Equipment Request Management

<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-21. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-186 - One active equipment request per event; more equipment is added by changing its lines

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-10 - Equipment Management |
| **Priority** | Medium |
| **Story points** | 2 |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-186 |

---

**User story:** As an Event Coordinator, I want my event to have one active equipment request that I change as needs change, so that Technical Support and the readiness checklist see exactly what the event needs, never two requests for the same equipment.

**Acceptance criteria**

1. Given the event already has an equipment request that is Pending Review, In Review or Approved, when I create another, then no second request is created and I am shown the existing one, with a pointer to change its lines (SCRUM-142). This extends SCRUM-27 AC7, which only blocked a second request while the first was Pending Review or In Review.
2. Given the event's only requests are Rejected or Cancelled, then I can create a new request (SCRUM-27, SCRUM-142 AC3).
3. Given I need more or different equipment for an event with an active request, then I add or change lines on that request (SCRUM-142 AC1), which returns it to Technical Support for re-check.
4. A direct attempt to create a second active request is refused on the server and writes nothing, including when two requests are submitted at the same moment.
5. Given an event that already has two active requests from before this change, then nothing is removed or cancelled automatically. Each request keeps counting towards the readiness checklist (SCRUM-110), and each can still be reserved line by line, because a line counts as reserved only by reservations made for that request (SCRUM-156 AC5, per-line rule).
6. SCRUM-156 AC5 no longer offers "a second approved request for an event that already has reservations" as a normal case; it keeps covering a request whose lines are only partly reserved. Legacy second requests are reserved under AC5 above.

**Customer basis:** "Can Coordinator add/remove equipment line items anytime before confirmation? Yes, changes allowed; Technical Support Staff re-check suitability." (Week 4 G4). Line changes on one request satisfy this; a second request isn't needed.

**Why this is a new story:** SCRUM-27 and SCRUM-156 (Sprint 2, Done) delivered what their criteria said, so nothing was missed (Week 7 Guide, scenario 2, not 1). SCRUM-156 AC5 allowed a second approved request on 5 Oct because there was then no other way to add equipment; SCRUM-142 (Sprint 3) now provides line changes. Found in testing (Felicia, 16 Oct): a second request made by mistake doubled what the readiness checklist required.

**Related:** SCRUM-27 (create a request), SCRUM-142 (change lines), SCRUM-156 (reserve an approved request), SCRUM-110 (readiness checklist).

**Change log**

* 2026-10-16 (PO decision): created. Backlog until the team confirms capacity for Sprint 3.
* 2026-10-21 (for the PO to confirm, no new scope): AC5 states how legacy second requests are counted and reserved instead of citing the SCRUM-156 AC5 case that AC6 withdraws; AC6 points to AC5 for legacy requests.

Functionality Area: Equipment Request Management

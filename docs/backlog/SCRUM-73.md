<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-13. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-73 - Register for an event

| | |
|---|---|
| **Epic** | SCRUM-11 - Attendee Registration |
| **Priority** | Highest |
| **Story points** | 2 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-73 |

---

**As an Attendee**, I want to register for an event, so that my place is recorded and the organisers know to expect me.

**Acceptance Criteria:**

* Registering creates a registration linked to the Attendee and the event
* The registration is immediately visible to the Attendee with a status of registered
* **Places are allocated first come, first served** — there is no approval queue and no Organiser decision on individual registrations
* The same Attendee cannot hold two active registrations for the same event
* Registering reduces the event's remaining capacity by one
* Registration is refused for any event that is not confirmed with registration enabled

**Customer clarification (2026-09-13):** _"Attendees can register, view status, withdraw. Registration is based on first come first serve and also based on Organiser discretion."_

Read together with the answer on timing — _"Registration may opens once event is confirmed; organiser control timing"_ — the two halves mean different things and it is worth being precise, because they could otherwise be read as contradictory:

* **First come, first served** governs individual registrations. Places go in the order they are claimed; nobody approves an Attendee.
* **Organiser discretion** governs the _window_, not the person — the Organiser decides when registration opens and when it closes (SCRUM-75). It is not a per-Attendee veto.

If the customer meant that an Organiser can accept or reject individual Attendees, this story is wrong and needs a new approval step. Worth confirming, but the FCFS wording makes the reading above the more likely one.

**Note:** capacity and registration-period boundaries are handled in SCRUM-74 and SCRUM-75 rather than here. This story covers the path where registration is permitted; those two cover where it is not, which is where the interesting failures live.

**INVEST:** Independent (needs "View an event I could attend"); Negotiable (what an Attendee must supply at registration — dietary needs, accessibility requirements — needs customer confirmation); Valuable (the epic's core outcome); Estimable and Small (one record, one counter); Testable (register, assert record created, status correct, capacity decremented, duplicate refused).

Functionality Area: Attendee Registration

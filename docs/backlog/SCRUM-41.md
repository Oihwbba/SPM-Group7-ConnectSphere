<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-30. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-41 - Formal change request: submit, review, and approve or reject

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-8 - Event Change & Notifications |
| **Priority** | High |
| **Story points** | 5 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-41 |

---

Merged story (29 Sep 2026): absorbs SCRUM-42 (Coordinator reviews a change request) and SCRUM-43 (Coordinator approves or rejects a change request). Any reference to SCRUM-42 or SCRUM-43 elsewhere now means this story. SCRUM-44 is now part of SCRUM-26; SCRUM-47 is now part of SCRUM-45.

As an Event Organiser, I want to submit a formal change request for an impactful event change, so that material changes are reviewed before they are applied.

Acceptance Criteria:

* A formal change request may be created for an event in Submitted, Under Review, Approved, Planning or Confirmed state, except where an open clarification response path or another pending change request already governs the requested edit.
* Draft events use SCRUM-15. Rejected events use SCRUM-108. Cancelled and Completed events cannot be changed.
* Routine non-impactful edits during Planning use SCRUM-25 and do not create a change request.
* The formal change-request fields are exactly date, time, expected attendance, venue and equipment.
* The Organiser selects the impactful field(s) and requested values and submits the change request.
* A submitted change request is recorded with status Pending Review.
* The requested values are not treated as the event's final values until the change request is approved.
* The Organiser can see the current status of the change request.
* Coordinator review and decision are owned by SCRUM-42 and SCRUM-43.
* After an approved impactful change is applied, SCRUM-44 owns dependent-arrangement reconsideration.

---

Merged from SCRUM-42 — Event Coordinator reviews a submitted change request

As an Event Coordinator, I want to review a submitted change request, so that I can assess its impact before deciding.

Acceptance Criteria:

* Given a change request with status "Pending Review," when a Coordinator opens it, then both the old value and new requested value are displayed for each changed field.
* Given a change affects date, time, attendance, venue, or equipment, when the Coordinator views the request, then any related bookings/equipment reservations are listed as "potentially affected."

---

Merged from SCRUM-43 — Event Coordinator approves or rejects a change request

As an Event Coordinator, I want to approve or reject a change request, so that the Event Organiser knows the outcome and the event remains internally consistent.

Acceptance Criteria:

* Given a change request is Pending Review, when the Coordinator approves it, then the requested event details become the event's actual details and the change request status becomes Approved as one atomic business operation.
* If the change request cannot be fully applied, neither the event details nor the change-request decision is committed.
* Given a change request is Pending Review, when the Coordinator rejects it, then the event's actual details remain unchanged and the change request status becomes Rejected.
* A rejection reason is required and cannot be blank.
* When an approved change affects an impactful field, SCRUM-44 handles dependent venue bookings and equipment reservations.
* For a Confirmed event, approval of an impactful change also moves the event to Planning so that the revised arrangements can be re-established before the event can become Confirmed again.
* For an Approved or Planning event, approving a change request does not otherwise alter lifecycle status.
* The Organiser's outcome notification is owned by SCRUM-47.
* The event's lifecycle transition behaviour follows SCRUM-24; this story owns the specific Confirmed → Planning transition caused by an approved impactful change.

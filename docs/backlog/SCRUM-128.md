<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-21. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-128 - Decide a change request and apply it in one step

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-8 - Event Change & Notifications |
| **Priority** | Highest |
| **Story points** | 5 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-128 |

---

**User story:** As an Event Coordinator, I want to approve or reject a change request and have an approved change applied in one step, so that the event never shows a half-applied change.

**Acceptance criteria**

1. Given a Submitted change request (SCRUM-41), when I open it, then each changed field shows the current and the requested value, and every venue booking, hold, pending venue request, equipment request and equipment reservation the change could affect is listed as potentially affected.
2. Given I approve it, then the requested values become the event's values and the change request becomes Approved in one atomic operation. If any part fails, neither is saved.
3. Given I reject it, then a non-blank reason is required, the event is unchanged and the change request becomes Rejected.
4. Given the approved change touches date, time, expected attendance, venue or equipment, then the affected arrangements are flagged as described in SCRUM-26, and a safety check that was approved or awaiting review becomes Outdated (SCRUM-166).
5. Given the event is Confirmed and the approved change is impactful, then the event returns to Planning in the same operation. New registrations pause until it is Confirmed again (SCRUM-75); existing registrations stay Registered.
6. Given the event is Under Review or in Planning, or the change is not impactful, then the event status does not change.
7. Given the requested expected attendance is lower than the number of active registrations, when I approve, then approval is refused and the number of active registrations is shown.
8. Given the change request asks for cancellation, when I approve it, then the event is cancelled as described in SCRUM-82, using the Organiser's reason.
9. Only the event's assigned Coordinator can decide a change request.
10. The decision is recorded with who and when. The Organiser is notified of the outcome (SCRUM-45). Attendees are told of approved date, time or venue changes when the event is Confirmed again (SCRUM-85).
11. Given the change request changes Registration needed (SCRUM-171): a change to No is refused while the event has active registrations, and the number of active registrations is shown; given the event is Confirmed and it changes from No to Yes, then registration opens as in SCRUM-75 AC4.

**Customer basis:** "Change requests may cover several field and the Coordinator will review and processes updates." G4: "Significant changes are those affecting arrangements (date/time, attendance, venue, equipment). Other edits are ordinary." G4: "Approval = sufficient info for planning. Confirmation = essential arrangements completed."

**Why this is a new story:** split from SCRUM-41 at the 2026-10-01 backlog refinement. SCRUM-41 had grown to 8 points (raise, review, atomic apply, status revert and cancellation requests), too big to finish in one sprint. SCRUM-41 now covers raising and tracking; this story covers deciding and applying. AC7 is new: lowering attendance below active registrations would otherwise overbook the event, because registration capacity equals expected attendance (SCRUM-74).

**Change log**

* 2026-10-01 (audit): AC1 lists equipment requests and reservations, matching the built equipment model. AC5 points to SCRUM-75, which owns the pause. AC10 no longer depends on SCRUM-71 (beyond Release 1; recording who and when is a Definition of Done rule) and says Attendees are told once the event is Confirmed again, as SCRUM-85 does.
* 2026-10-07 (Week 7 changes 3, 4 and 6): AC1 lists holds and every venue booking (SCRUM-162, SCRUM-163). AC4 puts an approved or awaiting safety check out of date (SCRUM-167). AC6 covers Under Review, where change requests can also be raised (SCRUM-41); this audit edit didn't save on 1 Oct.
* 2026-10-07 (backlog refinement): AC4 points to SCRUM-166, which SCRUM-167 was merged into.
* 2026-10-08 (PO review): replaced a G3 clarification in the Customer basis with the G4 definition of confirmation.
* 2026-10-09 (PO review): removed two quotes from the Customer basis that aren't in any customer document, and added the G4 definition of significant changes, which is what "impactful" means in AC4–AC6.
* 2026-10-17 (PO approved): AC11 added. Applying a change to Registration needed through a change request moved here from SCRUM-171 AC5 and SCRUM-75 AC11, because this story applies change requests; the rules are SCRUM-171's and SCRUM-75's (SCRUM-171's registrationStillNeededMessage is reused). Agreed with the story owner. SCRUM-41 AC1 already lets a change request cover Registration needed.

Functionality Area: Event Change Requests

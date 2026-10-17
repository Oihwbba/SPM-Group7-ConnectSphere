# ADR 0018 — The safety check is a checklist item with its own rows, not an event status

## Context

Week 7 change 6 adds an Operational Safety Check: once the venue and
technical arrangements are in place, a Safety Officer approves the event,
rejects the safety arrangement or requests changes, and the event can't go
ahead until it is approved. SCRUM-166 makes Confirm (SCRUM-81) the gate in
Release 1, because preparation (SCRUM-123) is beyond it.

SCRUM-172 already added the `SafetyCheck` table: one row per check, its
outcome, note, who and when, at most one awaiting review per event
(`safety_check_one_awaiting_per_event`), and CHECKs that Changes requested
and Rejected have a note and every outcome records who and when.

## Decision

1. **A step within Planning, not a tenth status** (AC15). The event stays in
   Planning. The checklist (SCRUM-110) gains a **Safety check** item read from
   the event's latest check, and only Approved completes it, so the existing
   rule "Confirm only when every item is complete" blocks confirmation with no
   change to `confirmEvent` (AC9).
2. **Requesting is offered from the checklist** once every other item is
   complete (AC1). The request locks the event row, as confirming does, so two
   requests take turns and the second finds the first (AC7); the partial unique
   index backs that up.
3. **Recording an outcome is a conditional update** on the check still awaiting
   review. A second recording, a second officer at the same moment (AC8), or
   approving an Outdated check (AC13) updates nothing, and the officer is told
   the outcome that stands.
4. **Outcomes reuse SCRUM-26's flags.** Changes requested flags the picked
   arrangements, kept as `SafetyCheckArrangement` rows (AC10); Rejected flags
   all of them (AC11). Flagged arrangements make their checklist items
   incomplete, so a new check can't be requested until the Coordinator
   resolves them (AC12).
5. **One helper makes a check Outdated**, `outdateSafetyChecks`, called in the
   same transaction as each change: approving a booking, reserving equipment
   and cancelling a flagged arrangement. A pending request doesn't, because it
   isn't an arrangement until it is approved.
6. **Who reviews:** a new `safety-check:review` permission for Safety Officers,
   whose relationship rule refuses an event they organise or coordinate (AC6,
   SCRUM-121 AC5); and `safety-check:request` for the assigned Coordinator.
7. **Notifications are written as rows** of the existing types
   `SAFETY_CHECK_REQUESTED` and `SAFETY_CHECK_OUTCOME`, as SCRUM-117 does for
   its notice, so they appear once the notification list (SCRUM-48) lands.

## Alternatives rejected

- **A `SAFETY_REVIEW` event status.** AC15 and SCRUM-135 forbid it, and every
  screen and rule that reads Planning would need a second value.
- **A boolean "safety approved" on the event.** It loses the history AC5 asks
  for and can't tell Outdated from never requested.
- **Outdating with database triggers.** It would catch every write, but the
  changes that outdate a check are a handful of application actions, and a
  trigger on bookings would also fire on flag-only updates, which aren't
  changes to the arrangement.

## Consequences

- Every event confirmed from now on has an approved safety check. Tests and
  demos that confirm an event create one first.
- SCRUM-25 and SCRUM-128, which edit the event's date, time, attendance,
  layout and accessibility needs, and SCRUM-163's holds must call
  `outdateSafetyChecks`.
- The seed adds `safety@test.local` so the journey can be demonstrated.

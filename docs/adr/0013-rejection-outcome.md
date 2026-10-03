# ADR 0013 — The Coordinator chooses a rejection's outcome; a new request starts as a copied Draft

SCRUM-126. It builds on the rejection of SCRUM-19 and the status gate of
ADR 0006.

## Context

The customer: "Only edits via Coordinator and the co-ordinator also decide
whether it calls for a new submission." Sprint 1 recorded a rejection with a
reason only, and offered **Amend & Resubmit** on every rejected request.
SCRUM-126 asks that the Coordinator choose, with every rejection, between
**Amend and resubmit** and **Submit as a new request**; that a request marked
for a new submission stays Rejected and read-only; that its Organiser can
start a new Draft from it, with no link to its arrangements or history; and
that rejections recorded earlier count as Amend and resubmit. SCRUM-108 (the
amend journey) and SCRUM-117 (rejecting a Planning event) read the same choice.

## Decision

1. **A column on `Event`, not a history lookup.** `rejectionOutcome` is a
   nullable `RejectionOutcome` enum set in the same conditional update as the
   status and reason, and cleared on resubmission and approval, as the reason
   is. The screens and the resubmit action read it directly.
2. **The database refuses a rejection without one.** The CHECK
   `event_rejection_has_outcome` mirrors `event_rejection_has_reason`, so
   SCRUM-117's second way of rejecting cannot forget it either. The action
   still refuses it first, with a field error for the dialog.
3. **Older rejections are migrated, not special-cased.** The migration sets
   every existing Rejected event to `AMEND_AND_RESUBMIT` (AC 7), so the code
   never has to treat "no outcome" as a third case.
4. **"Read-only" is enforced where the event is written.** `submitEventRequest`
   only finds a draft or a rejection marked for amendment; a rejection marked
   for a new request is "not found" there, whatever the page shows.
5. **A new request is a copy, made by the server.**
   `startRequestFromRejected` copies the request's own fields (the SCRUM-13
   form fields, equipment types and registration need) into a new Draft owned
   by the same Organiser. It copies no coordinator, submission, decision,
   bookings, equipment requests, reservations or history, so the two events
   share nothing but their text. The Draft then goes through the normal
   draft-and-submit flow (SCRUM-15, SCRUM-14).
6. **The outcome has its own history entry** (`fieldName: rejectionOutcome`),
   by the rejecting Coordinator, next to the status change, so it is recorded
   with who and when (AC 6).

## Alternatives considered

- **Derive the outcome from the audit log.** Every screen and the resubmit
  action would have to find the latest rejection entry; a column is one read.
- **Treat a missing outcome as Amend in code.** Every reader would need the
  same fallback, and a forgotten one would be a bug; migrating once removes
  the case.
- **Copy on the client** by opening the create form pre-filled. The copy would
  only exist if the Organiser saved it, and the "which fields" rule would live
  in a component. The server action keeps it in one place and testable.
- **Link the new Draft to the rejected event.** AC 4 asks for no link, and
  nothing reads one.

## Consequences

- SCRUM-108 builds the amend journey on top: Amend and Resubmit is already
  hidden for a new-request rejection, and the server already refuses it.
- SCRUM-117 must send an outcome when it rejects a Planning event; the
  database refuses it otherwise.
- Starting a new request twice makes two Drafts. Each is an ordinary Draft
  the Organiser can discard (SCRUM-130); the button is disabled while the
  first request is in flight.

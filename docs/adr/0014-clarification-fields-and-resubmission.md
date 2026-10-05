# ADR 0014 — A clarification names the fields its answer may change; a resubmission returns to the same Coordinator

SCRUM-108. It builds on the clarification of SCRUM-18, the rejection outcome
of SCRUM-126 (ADR 0013) and the automatic assignment of SCRUM-20.

## Context

The customer: "Organiser cannot directly edit after submission; must request
via Coordinator." Sprint 1's clarification was a free-text question and a
free-text answer, and resubmitting a rejected request ran automatic assignment
again, so it could land with a different Coordinator. SCRUM-108 asks that the
Coordinator can name which request-form fields the answer may change, that the
Organiser can change only those (anything else goes through a change request),
that saving the same answer twice changes nothing, and that an amended request
goes back to the Coordinator who reviewed it. On 4 Oct the PO added to AC 11
that rejecting a request nobody was assigned to makes the rejecting
Coordinator its coordinator (raised by Hann Qian: such rejections otherwise
stayed in every Coordinator's list).

## Decision

1. **The named fields are a list on the clarification.**
   `ClarificationRequest.editableFields` holds keys of `CLARIFIABLE_FIELDS`
   (`lib/schemas/clarification.ts`); empty means a text answer only. The
   migration adds it with an empty default, so existing clarifications stay
   text-only and code that doesn't know the column keeps working.
2. **Date and time are one field.** `schedule` covers the start and the end,
   since one is rarely changed without the other; the answer must give both.
3. **The server enforces the list.** `respondToClarification` refuses any
   change to a field the clarification didn't name, and validates the named
   ones with the request form's rules, so an answer can't leave the request in
   a state it couldn't have been submitted in. Only values that differ are
   written.
4. **The same answer twice is a no-op.** A repeat of the stored answer returns
   success without writing; a different answer to an answered clarification is
   refused, as before.
5. **History records the answer and each change.** One `CLARIFICATION_ANSWERED`
   entry, and one `UPDATED` entry per changed field with old and new values,
   in the same transaction as the answer.
6. **A resubmission returns to the same Coordinator.** `submitEventRequest`
   keeps the previous Coordinator if they still hold the role, moves the event
   to Under Review, notifies them and records both steps; automatic assignment
   runs only if there was none or they no longer hold the role. If it then finds no Coordinator, the request is left unassigned, like a first submission, so it is in every Coordinator's queue rather than tied to someone who can no longer review it (GLM review of PR #129).
7. **An amendment keeps the values it replaced.** Resubmitting overwrites the
   request's fields in place (AC 9: the same event), so `submitEventRequest`
   first compares the stored request with the amended one and writes one
   `UPDATED` entry per changed field, with old and new values, by the
   Organiser, as an answer does in decision 5. An empty optional field counts
   as unset. A resubmission with nothing changed writes no change entries (found by the GLM review of PR #129: an empty write would have failed it). The rejection's own entries,
   with its reason, are never touched, although the event row's
   `decisionReason` and `rejectionOutcome` are cleared on resubmission. Raised
   by the PO in review of PR #129: AC 9's "history is kept" and AC 14's
   "amendments are recorded" were only met for the status change.
8. **Whoever decides an unassigned request becomes its coordinator**, on
   rejection as on approval (SCRUM-81 AC 2), so the rejected request leaves
   other Coordinators' lists and comes back to them on resubmission.

## Alternatives considered

- **A separate table of editable fields per clarification.** One short list
  per request doesn't need its own table.
- **Let the answer change any field.** It would bypass the change-request
  process the customer asked for (SCRUM-41).
- **Keep a snapshot of the whole rejected request.** A copy of every field
  per resubmission repeats what didn't change; per-field entries match how
  answers and change requests are already recorded.
- **Always reassign on resubmission (Sprint 1).** The Coordinator who knows
  why it was rejected is best placed to review the amendment.

## Consequences

- The migration only adds a column with a default, so it can be applied to
  the shared database before this merges without affecting other code.
- SCRUM-150 (field-level clarification response) is the same work as AC 1–5
  and can be closed as a duplicate.
- Rejections recorded before AC 11's change may have no coordinator; the
  resubmission fallback (automatic assignment) still covers them.

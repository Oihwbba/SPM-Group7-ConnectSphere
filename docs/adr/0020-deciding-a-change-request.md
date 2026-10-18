# ADR 0020 — An approved change request is applied in the same transaction that approves it

## Context

SCRUM-41 lets the Organiser (or the Coordinator for them) raise a change
request: either new values for the event's fields, recorded one row per field
with the old and new value as text, or a request to cancel the event.
SCRUM-128 decides it. The customer's rule is that the event "never shows a
half-applied change" (AC2), and an approved change has knock-on effects owned
by other stories: flags on the arrangements (SCRUM-26), an out-of-date safety
check (SCRUM-166), a Confirmed event back in Planning (SCRUM-135 AC8), or the
whole cancellation (SCRUM-82).

## Decision

1. **One transaction, the event row locked first**, as raising a request
   does. Inside it: the request is re-read and must still be Submitted, the
   event must still be Under Review, in Planning or Confirmed, and the
   Coordinator must still be assigned. Then the values, the request's status,
   the history entries, the flags, the outdated check and the status change
   are all written, so a failure anywhere saves none of them (AC2). A second
   decision at the same moment waits, then finds the request decided (AC2).
2. **The recorded values are applied as recorded.** SCRUM-41 validated them
   with the request form's rules when they were raised; `eventUpdateFrom`
   only reads the text back as a date, a number or text. The database's own
   CHECKs still apply, and the integration test relies on one to prove a
   failed apply saves nothing.
3. **"Impactful" is SCRUM-41's `isMajor`** (date, time, attendance, venue,
   equipment: G4's "significant changes"). An impactful change flags every
   live arrangement and returns a Confirmed event to Planning. A safety check
   is outdated by an impactful change and also by a change to the layout or
   accessibility needs, which SCRUM-166 AC13 says the check reviewed.
4. **A cancellation request reuses SCRUM-82's `cancelInTransaction`**, so
   the two ways of cancelling release exactly the same things. The request is
   marked Approved first, because the cancellation rejects any change request
   still Submitted.
5. **Attendance below the active registrations is refused** (AC7), counted
   inside the transaction.

## Alternatives rejected

- **Re-validating the requested values with the form's schema at approval.**
  A start date valid when raised could be in the past by the time it's
  decided, and refusing it would leave the Coordinator unable to approve a
  change the Organiser made in good time. The database's CHECKs still refuse
  an impossible event.
- **Applying field by field with separate writes.** It is exactly the
  half-applied state AC2 forbids.

## Consequences

- SCRUM-135's status rulebook must allow Confirmed → Planning for an approved
  impactful change, as this story does.
- SCRUM-75 pauses registration by its own rule that only a Confirmed event
  takes registrations, so nothing here needs to close it.

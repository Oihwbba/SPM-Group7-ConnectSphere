# ADR 0006 — Use one guarded transition gate for coordinator event status changes

## Context

SCRUM-23 requires every event view to show its current status, while SCRUM-24
requires that status to have one source of truth and never become inconsistent
when users act at the same time.

SCRUM-24 does not own any transition itself — each one belongs to a story:
`submitted → under review` to SCRUM-20 (automatic coordinator assignment, with
**no manual claim step**), `→ approved / rejected` and `rejected → submitted`
to SCRUM-19. The coordinator's decision (approve, or reject with a reason) is
the first of those to be built. An Organiser amends and resubmits a rejected
request through the existing submission action.

Direct page-level updates would make it easy for different screens to apply
different rules or overwrite a newer status with a stale one.

## Decision

All coordinator decision controls call `transitionEventStatus` in
`app/(app)/events/actions.ts`. The action:

- checks the `event:review` role **before** reading the event, then treats an
  event the coordinator has no relationship to exactly like a missing one, so
  it cannot reveal which event ids exist (SCRUM-68);
- accepts only `APPROVED` or `REJECTED`, and only from `SUBMITTED` or
  `UNDER_REVIEW`; a rejection must carry a non-blank reason;
- uses a conditional `updateMany` on the event id **and** the status and
  coordinator it observed, so of two simultaneous decisions only one can win;
- writes the status change and its audit entry in the same transaction; and
- revalidates the event views, which render `Event.status` directly through
  `StatusBadge`.

It deliberately does **not** accept `UNDER_REVIEW`: moving a request into
review is SCRUM-20's automatic assignment, not something a coordinator claims.

The `Event.status` enum remains the sole persisted lifecycle state. We do not
copy it into per-screen fields or client-side caches.

## Alternatives rejected

- **Client-side status changes.** They are not authoritative and can become
  stale or be bypassed.
- **Separate status columns per role or screen.** They create reconciliation
  work and violate SCRUM-24's single-source requirement.
- **An unconditional update.** A stale coordinator action could overwrite a
  status another coordinator just changed.
- **A manual "Start review" claim.** Contradicts SCRUM-20, which the customer
  clarified (2026-09-13) must assign automatically with no claim step.

## Consequences

- The review UI always reflects the one database status value required by
  SCRUM-23/24.
- A concurrent loser receives a refresh-and-retry message instead of silently
  overwriting the winner.
- Future lifecycle stories (SCRUM-20, 81, 82, 83) must add their own authorised
  transition to this gate (or an equivalent guarded action), rather than
  writing `Event.status` directly.

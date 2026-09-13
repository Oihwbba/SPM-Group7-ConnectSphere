# ADR 0006 — Use one guarded transition gate for coordinator event status changes

## Context

SCRUM-23 requires every event view to show its current status, while SCRUM-24
requires that status to have one source of truth and never become inconsistent
when users act at the same time. The coordinator UI owns the implemented
review actions: `SUBMITTED → UNDER_REVIEW`, then `UNDER_REVIEW → APPROVED` or
`REJECTED`. Rejection also carries a reason, and an Organiser may later amend
and resubmit the request through the existing submission action.

Direct page-level updates would make it easy for different screens to apply
different rules or overwrite a newer status with a stale one.

## Decision

All coordinator review controls call `transitionEventStatus` in
`app/(app)/events/actions.ts`. The action:

- checks the central `event:review` permission and the event relationship;
- accepts only the permitted next status for the event's observed current
  status;
- uses a conditional `updateMany` on both event id and current status, so only
  one concurrent action can win;
- writes the status change and its audit entry in the same transaction; and
- revalidates the event views, which render `Event.status` directly through
  `StatusBadge`.

The `Event.status` enum remains the sole persisted lifecycle state. We do not
copy it into per-screen fields or client-side caches.

## Alternatives rejected

- **Client-side status changes.** They are not authoritative and can become
  stale or be bypassed.
- **Separate status columns per role or screen.** They create reconciliation
  work and violate SCRUM-24's single-source requirement.
- **An unconditional update.** A stale coordinator action could overwrite a
  status another coordinator just changed.

## Consequences

- The review UI always reflects the one database status value required by
  SCRUM-23/24.
- A concurrent loser receives a refresh-and-retry message instead of silently
  overwriting the winner.
- Future lifecycle stories must add their own authorised transition to this
  gate (or an equivalent guarded action), rather than writing `Event.status`
  directly.

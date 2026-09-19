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

---

## Addendum (2026-09-19) — Periodic router revalidation for concurrent status views (SCRUM-24)

### Context

SCRUM-24 acceptance criterion 4 mandates:
> *"Two users viewing the same event at the same time never see conflicting statuses"*

When two users view an event simultaneously (e.g. an Organiser on "My Events" and a Coordinator reviewing "Submitted Event Requests"), a status decision (approve or reject) by the coordinator wrote the status change to PostgreSQL and revalidated the coordinator's path, but the organiser's browser tab remained stale until an explicit manual page reload.

### Decision

1. **Visibility-gated periodic revalidation (`router.refresh()`).** `EventsClient` mounts an interval timer that executes `router.refresh()` every 4 seconds whenever `document.visibilityState === "visible"` and no mutation transition is in flight (`!isPending`). Pausing during active transitions prevents network contention during user form submissions, and halting when the tab is backgrounded or minimized eliminates unnecessary network traffic.
2. **Reactive detail view synchronization.** The event details modal derives its active event from `events.find(e => e.id === viewingEventId)` rather than keeping a detached, static object in `useState`. When `router.refresh()` updates the server-rendered `events` prop, both the table row status badge and any open `EventDetailsModal` immediately update their rendered status in lockstep.
3. **Multi-browser test verification.** Playwright end-to-end tests (`e2e/events.spec.ts`) simulate two distinct browser sessions (one Organiser with the detail modal open, and one Coordinator). When the Coordinator approves the event, the test verifies that the open modal's status badge automatically flips to `APPROVED` within the 4-second convergence window without page reload.
4. **No new runtime dependencies or infrastructure.** The mechanism uses native Next.js App Router server component revalidation.

### Alternatives rejected

- **WebSockets / Socket.io / Pusher.** Violates the project's strict "no new dependencies without an ADR" and "favour boring, obvious code" principles (CONTRIBUTING.md). Would require stateful server infrastructure or external third-party subscriptions incompatible with serverless deployment.
- **Server-Sent Events (SSE).** Introduces long-lived HTTP connection management on edge/serverless runtimes and custom reconnect/buffering logic for a straightforward status display.
- **Client-side polling via custom fetch API endpoint with duplicate state cache.** Storing event status in client state or SWR/React Query caches violates ADR 0006's explicit rule: *"The `Event.status` enum remains the sole persisted lifecycle state. We do not copy it into per-screen fields or client-side caches."* Using `router.refresh()` maintains Next.js Server Components as the single source of truth.

### Consequences

- Two concurrent browser sessions observing the same event synchronize within 4 seconds of any status mutation without requiring manual user refreshes.
- Criterion 4 is demonstrably satisfied in multi-browser live evaluation and Playwright concurrent context testing.
- The implementation is ~15 lines, requires zero dependencies, and pauses automatically when tabs are inactive.

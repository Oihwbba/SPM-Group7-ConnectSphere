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
2. **Reactive detail view synchronization and dropped-event resilience.** The event details modal derives its active event from `events.find(e => e.id === viewingEvent.id)` while maintaining the latest known snapshot in `viewingEvent`. When `router.refresh()` updates the server-rendered `events` prop, both the table row status badge and any open `EventDetailsModal` immediately update their rendered status in lockstep. If a background revalidation drops an event from the user's scoped query (such as when an unassigned request is assigned to a different coordinator mid-view), the modal does not unmount silently; instead, it remains mounted and renders a clear warning banner (`isNoLongerAvailable`) indicating that the event has been reassigned or removed from their review queue.
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

---

## Addendum (2026-09-30) — Approval leads to Planning, and confirming joins the gate (SCRUM-81)

`transitionEventStatus` still accepts only `APPROVED` or `REJECTED`, but an
approval is now saved as **Planning**, with history entries for the approval
and the automatic move. A second action, `confirmEvent`, moves a Planning event
to **Confirmed** when its readiness checklist is complete. It lives beside
`transitionEventStatus`, is allowed only for the event's assigned Coordinator,
and records the change and its history entry in one transaction, keeping this
ADR's rules: one place per transition, authorisation before the read, and no
duplicate change when two requests race. The details are in ADR 0012.

## Addendum (2026-10-11) — Corrections from the docs audit (SCRUM-173)

The 2026-09-19 addendum says the two-browser e2e test checks that the badge
flips to `APPROVED`. Since the 2026-09-30 addendum, approval moves the event
straight to Planning, and `e2e/events.spec.ts` checks for `PLANNING`.

---

## Addendum (2026-10-14) — One lifecycle table, and only assigned requests are decided (SCRUM-135)

### Context

By Sprint 3, seven actions change an event's status: submit, approve or
reject, reject from Planning (SCRUM-117), confirm, return to Planning
(SCRUM-128, SCRUM-26), cancel (SCRUM-82) and complete. Each checked the
current status its own way, with its own wording, and none listed which moves
the lifecycle allows overall. SCRUM-135 needs one list and a refusal that
names the current status. Week 7 change 5 also lets Coordinators manage only
events assigned to them, so a Coordinator can no longer decide a Submitted
request nobody was assigned to and become its Coordinator (which SCRUM-81 AC2
and SCRUM-108 AC11 had allowed).

### Decision

1. **One table, `lib/event-lifecycle.ts`.** It lists each status's allowed
   next statuses, plus the one conditional move (Rejected → Submitted only
   for Amend and resubmit). Every action that changes a status asks
   `canTransition` after locking the event row, and refuses with
   `transitionRefusal`, e.g. "This event is Draft, so it can't be confirmed."
   The **Cancel event** button reads `CANCELLABLE` from the same table.
2. **Only Under Review is decided.** `transitionEventStatus` refuses a
   Submitted request, and the list no longer shows **Approve** or **Reject**
   on one. The self-assignment on deciding is removed. The Lead's assignment
   (SCRUM-165) is what moves a request to Under Review.
3. **Rules that aren't about status stay with their action.** Who may act,
   whether the checklist is complete (SCRUM-81), and whether a Planning event
   was ever Confirmed or has registrations (SCRUM-117, SCRUM-82 AC5) are still
   checked where they were. The table answers only "is this move allowed".
4. **Approved stays in the enum** as a history value (AC12). A row left
   Approved from before approval moved straight to Planning may still go on to
   Planning or be cancelled, so it isn't stranded.

### Alternatives rejected

- **A state-machine library.** Nine statuses and twelve moves fit a plain
  object; CONTRIBUTING.md asks for no new dependencies.
- **One action that performs every transition.** Each transition has its own
  side effects (releasing arrangements, notifications, readiness checks), so
  merging them would hide each story's rules. The table is shared; the actions
  stay separate.
- **A database trigger.** It would refuse with a database error the user
  can't read, and the refusal must name the status in plain words (AC11).

### Consequences

- A new transition is one line in the table, and a test that lists every
  allowed pair (TC-135-11) fails until the story's change is deliberate.
- Refusals read the same everywhere.
- A Submitted request no Coordinator was assigned to waits in the Lead's
  Unassigned queue (SCRUM-165).

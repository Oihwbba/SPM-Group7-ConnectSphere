# ADR 0004 — Centralise authorisation in `can()`

## Context

The customer requires two-dimensional access control. It is not enough to check
a user's role; the system must also check their **relationship** to the
specific thing they are acting on:

- a Venue Staff member may never approve an event request (role), and
- a Coordinator sees only the events assigned to them, an Organiser only their
  own, an Attendee only their own registrations (relationship).

With five developers each building features that touch permissions, the danger
is that everyone writes their own `if (session.user.role === "...")` checks
inline. Those drift, contradict each other, miss the relationship half, and are
impossible to audit or explain as a whole in the oral exam.

## Decision

All authorisation lives in one module, `lib/auth/can.ts`, which exports:

- `can(user, action, resource?)` — returns a boolean after checking **both**
  the role (against a single `ROLE_ACTIONS` table) and, when a resource is
  given, the relationship;
- `requirePermission(user, action, resource?)` — throws `PermissionError`, and
  is the **first statement of every server action**;
- the `Action` vocabulary and the `ROLE_ACTIONS` table itself, so the entire
  permission model can be read in one place.

An inline role check anywhere else is a **code-review rejection** (stated in
CONTRIBUTING.md). New capabilities are added by extending the `Action` union
and the table, not by writing a new conditional in a feature.

## Alternatives rejected

- **Inline checks per feature.** Fast to write, impossible to keep consistent
  across five developers, and hides the relationship requirement. Rejected.
- **Middleware-only authorisation.** Middleware can gate routes by
  authentication, but it runs on the Edge without database access, so it cannot
  check "is this the coordinator assigned to *this* event". Relationship checks
  must happen where the data is. Middleware still does the coarse
  "are you signed in" gate; `can()` does the fine-grained rest.
- **A policy library / RBAC framework.** More abstraction than a five-role
  system needs, and every developer would have to learn it. A plain function
  and a table are enough and are trivially explainable.

## Consequences

- One file answers "who can do what", which is exactly what an examiner asks.
- Adding a permission is a one-line edit to the table plus a new `Action`.
- Server actions have a uniform first line; reviewers can check it at a glance.
- The read side (Prisma `where` clauses scoped to the user) still has to agree
  with `can()`; the reference page shows the two working together.

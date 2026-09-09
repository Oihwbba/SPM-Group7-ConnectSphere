# ADR 0001 — Partition route folders by role

> **Status: superseded on 2026-09-09 by the addendum at the bottom of this
> file.** Routes are now partitioned by *domain*, not by role. The Context and
> Decision below record the original reasoning; read the addendum for what the
> repository actually does today.

## Context

Five developers build features on this codebase in parallel over four
sprints. The single largest source of friction in a small team on a shared
repo is merge conflicts — two people editing the same file in the same week.
The event-planning domain happens to divide cleanly along user roles: an Event
Organiser's screens, a Coordinator's screens, Venue Staff's screens and so on
rarely need to live in the same file.

## Decision

We lay the app out as one folder per role area under `app/(app)`, matching the
role boundaries in the brief:

```
organiser/events        coordinator/events   coordinator/venues
venue-staff/bookings    tech-support/equipment
attendee/events         attendee/registrations   notifications
```

Each developer owns one or more of these folders. A feature is (almost) always
a page, an `actions.ts`, some local components and a schema — all inside one
folder. Two developers working in different folders in the same sprint touch
disjoint files, so their branches merge cleanly.

We accept that this duplicates a little structure: both the organiser and the
coordinator have an "events" page, and they will each have their own table
markup rather than sharing one. That duplication is deliberate — see ADR 0004
and the "no shared `<DataTable>`" rule in CONTRIBUTING.

## Alternatives rejected

- **Layer-first layout** (`components/`, `services/`, `pages/` split by
  technical role). Every feature would then cut across many shared folders, so
  five people editing five features all edit the same handful of files. Maximum
  conflict, the opposite of the goal.
- **A single `events` area shared by organiser and coordinator.** Tempting
  because they share an entity, but their permissions, queries and screens
  differ, and it would put two developers in one folder. Rejected to keep
  ownership clean.

## Consequences

- Merge conflicts between developers are rare because ownership maps to
  folders.
- Some code (table markup, empty states) is written more than once. When a
  genuine, repeated pattern emerges in a later sprint we can extract it then —
  not pre-emptively.
- The folder tree doubles as a map of who owns what, which helps in the oral
  exam and in code review.

---

## Addendum (2026-09-09) — superseded by domain-first folders

### What changed

Route folders are now named for the **domain**, not the role:

```
events    venues    bookings    equipment    registrations    notifications
```

A route that several roles use is one folder with one page; that page
dispatches on `session.user.role` to decide which view to render.
`app/(app)/events/page.tsx` is the worked example: Organisers get their own
events table, Coordinators get the review queue, Attendees get the browse
view.

### Why

Two reasons, in order of weight:

1. **The role split fragmented single features.** "Event request lifecycle"
   (SCRUM-6) is one feature that spans Organiser, Coordinator and Attendee
   screens. Under role folders its status transitions, queries and markup were
   spread across three sibling folders with no single place to read the
   lifecycle — the thing the marker asks us to explain.
2. **The conflict-avoidance argument was weaker than it looked.** Ownership
   was already drifting away from folders, and the files five people actually
   contend over are the shared ones — `schema.prisma`, `lib/auth/can.ts`,
   `lib/nav.ts` — which role folders never protected.

This directly reverses the "single `events` area" option rejected above. That
rejection assumed sharing a folder means sharing a *page*; it does not. The
role dispatch keeps the permissions, queries and screens as separate as before
— they are separate components in one file, or separate files in one folder.

### What did NOT change

Authorisation. It never lived in the folder tree: `lib/auth/can.ts` is still
the single gate (ADR 0004), and every page still calls `requireSession()` and
checks the role before reading data. Moving folders changed URLs, not who can
see what.

### Consequences

- A feature is now readable end to end in one folder, which is how the
  backlog epics are written and how we have to explain them.
- Two developers working the same domain now share a folder, so they
  coordinate on one page file instead of merging cleanly in isolation. This is
  a real cost of the change, accepted deliberately.
- URLs shortened: `/organiser/events` → `/events`, `/venue-staff/bookings` →
  `/bookings`, and so on. Any external bookmark to an old URL 404s.

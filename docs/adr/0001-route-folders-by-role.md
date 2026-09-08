# ADR 0001 — Partition route folders by role

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

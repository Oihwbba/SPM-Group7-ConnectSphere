# Architecture Decision Records

Why the important things are built the way they are. Each record states the
problem, the decision, the alternatives we rejected and the consequences, so
it can be read aloud in the oral exam.

| ADR | Decision | Stories | Status |
|---|---|---|---|
| [0001](0001-route-folders-by-role.md) | Group route folders by domain; a route several roles use switches on the role | — | Superseded by its own addendum: started as one folder per role |
| [0002](0002-jwt-session-strategy.md) | Use JWT sessions, because the Credentials provider can't use database sessions | SCRUM-65 | Current |
| [0003](0003-denormalised-booking-times.md) | Bookings and reservations store their own times, so a moved event shows its arrangements out of date | SCRUM-26 | Current |
| [0004](0004-centralised-authorisation.md) | All authorisation goes through `can()`: role and relationship, in one table | SCRUM-66, 67, 68 | Current |
| [0005](0005-ephemeral-ci-database.md) | CI runs against a throwaway Postgres, migrated and seeded from nothing | — | Current |
| [0006](0006-single-event-status-transition-gate.md) | Every Coordinator status change goes through one gate that checks the current status | SCRUM-23, 24, 19, 20, 81 | Current, with addenda |
| [0007](0007-lock-equipment-pools-when-reserving.md) | Lock the equipment rows while reserving; lock the event, then the request, then equipment by id | SCRUM-31, 155, 156 | Amended 2026-10-05 |
| [0008](0008-advisory-ai-code-review.md) | An AI review on every pull request, now a required check on critical findings | SCRUM-88, 111, 112, 152, 157 | Amended: no longer advisory |
| [0009](0009-deploy-from-github-actions.md) | Deploy production from GitHub Actions, not Vercel's Git integration | — | Current |
| [0010](0010-database-prevents-venue-double-booking.md) | The database, not the application, prevents venue double-booking, over occupied periods and holds since Week 7 | SCRUM-53, 37, 159, 161, 162, 163, 172 | Amended 2026-10-08 |
| [0011](0011-event-readiness-checklist.md) | The readiness checklist is computed on demand, per viewer | SCRUM-110 | Amended 2026-10-04 |
| [0012](0012-confirming-an-event.md) | Approval moves an event to Planning; the assigned Coordinator confirms it | SCRUM-81 | Amended 2026-10-03 |
| [0013](0013-rejection-outcome.md) | The Coordinator chooses a rejection's outcome; a new request starts as a copied Draft | SCRUM-126 | Current |
| [0014](0014-clarification-fields-and-resubmission.md) | A clarification names the fields its answer may change; a resubmission returns to the same Coordinator | SCRUM-108 | Current |
| [0015](0015-rejecting-a-planning-event.md) | Rejecting a Planning event releases its arrangements in one transaction | SCRUM-117 | Current |
| [0016](0016-one-nextjs-app-on-vercel-and-supabase.md) | One Next.js app with Prisma on Supabase, deployed to Vercel: free, and one shared view of everyone's merged work | — | Current (written 2026-10-11, after the fact) |

## Writing one

Write an ADR when a decision is hard to reverse, surprising to a newcomer, or
likely to be questioned in the Q&A: a lock, a constraint, a modelling choice,
a new dependency.

- Take the next number, and name the file `NNNN-short-title.md`.
- Use the same four sections: **Context**, **Decision**, **Alternatives
  rejected**, **Consequences**. Name the stories it serves.
- **Don't rewrite an old decision.** Add a dated `## Addendum (YYYY-MM-DD)` at
  the bottom, and if it changes the decision, add a status line at the top
  (see 0001 and 0007).
- Add a row to the table above in the same pull request.

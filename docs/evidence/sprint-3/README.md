# Sprint 3 evidence

Captured on the day, from the running system and CI. Each item names the story
and criterion it evidences.

## SCRUM-132 — response times on the seed data

SCRUM-132 AC2: with the seed data, each operation responds within 2 seconds,
timed once per sprint. Each is timed from the user's action until its answer
is on screen, by `e2e/phone-and-speed.spec.ts`, against the production build
(`npm run build && npm run start`) and a local PostgreSQL 16 in Docker,
freshly seeded. CI attaches the same timings to every run's Playwright report,
and the test fails any over 2,000 ms.

| Operation | What is timed | Time (ms) | Limit (ms) |
|---|---|---|---|
| View an event | Opening "Planning — Freshman Orientation" until its readiness checklist shows | 227 | 2,000 |
| Search venues | Opening venue search for that event until the first result shows | 510 | 2,000 |
| Open a venue's availability | Opening Exhibition Hall's week until the calendar shows | 108 | 2,000 |
| Check equipment availability | Choosing Projector for a period until "_n_ of _m_ available" shows | 19 | 2,000 |
| Submit a registration | Registering for a Confirmed event until it shows as registered | 149 | 2,000 |

Captured 2026-10-19 on a developer laptop (Windows 11), from the branch
`SCRUM-132-phone-and-response-time` built on `main` at `02a3030`. The table is
the last of four runs that day; in every run each operation took under
600 ms (the slowest was a registration at 558 ms).

**Re-run after merging `main` at `4f7fdc97`** (SCRUM-25, SCRUM-38, SCRUM-75,
SCRUM-161 and SCRUM-171 had merged since `02a3030`), same laptop, production
build, local database seeded that day but changed by manual testing since:
view an event 210 ms, search venues 369 ms, open a venue's availability
138 ms, check equipment availability 25 ms, submit a registration 165 ms.
Each is still well under 2,000 ms. Re-run on a freshly seeded database for
the sprint review.

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

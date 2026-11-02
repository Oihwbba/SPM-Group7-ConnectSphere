# Sprint 4 evidence

Captured on the day, from the running system and CI. Each item names the story
and criterion it evidences.

## SCRUM-132 — response times on the seed data

SCRUM-132 AC2: with the seed data, each operation responds within 2 seconds,
timed once per sprint. Each is timed from the user's action until its answer
is on screen, by `e2e/phone-and-speed.spec.ts`, against the production build
and a PostgreSQL 16 service container in CI. The test fails any over 2,000 ms.

| Operation | What is timed | Time (ms) | Limit (ms) |
|---|---|---|---|
| View an event | Opening "Planning — Freshman Orientation" until its readiness checklist shows | 495 | 2,000 |
| Search venues | Opening venue search for that event until the first result shows | 167 | 2,000 |
| Open a venue's availability | Opening Exhibition Hall's week until the calendar shows | 199 | 2,000 |
| Check equipment availability | Choosing Projector for a period until "_n_ of _m_ available" shows | 171 | 2,000 |
| Submit a registration | Registering for a Confirmed event until it shows as registered | 164 | 2,000 |

Captured from [run 41333934564](https://github.com/Oihwbba/SPM-Group7-ConnectSphere/actions/runs/41333934564),
which started on 2026-11-02 at 01:55 SGT on `main` at `c704ac7e`. The run
passed, with all 336 end-to-end tests green. The database was seeded at the
start of the job, and the earlier specs in the run wrote to it before these
timings, so it was not a freshly seeded database.

These times are for the app, its database and the browser running together in
CI. They do not include the network or the deployed site.

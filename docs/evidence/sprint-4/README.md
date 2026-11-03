# Sprint 4 evidence

Captured on the day, from the running system and CI. Each item names the story
and criterion it evidences.

## SCRUM-132 — response times on the seed data

SCRUM-132 AC2: with the seed data, each operation responds within 2 seconds,
timed once per sprint. Each is timed from the user's action until its answer
is on screen, by `e2e/phone-and-speed.spec.ts`, against the production build
(`npm run build && npm run start`) and a local PostgreSQL 16 in Docker, freshly
seeded. The test fails any over 2,000 ms.

| Operation | What is timed | Run 1 (ms) | Run 2 (ms) | Run 3 (ms) | Limit (ms) |
|---|---|---|---|---|---|
| View an event | Opening "Planning — Freshman Orientation" until its readiness checklist shows | 323 | 268 | 254 | 2,000 |
| Search venues | Opening venue search for that event until the first result shows | 170 | 149 | 147 | 2,000 |
| Open a venue's availability | Opening Exhibition Hall's week until the calendar shows | 167 | 166 | 155 | 2,000 |
| Check equipment availability | Choosing Projector for a period until "_n_ of _m_ available" shows | 112 | 111 | 127 | 2,000 |
| Submit a registration | Registering for a Confirmed event until it shows as registered | 119 | 125 | 137 | 2,000 |

Captured 2026-11-02 at about 22:15 SGT on a developer laptop (Windows 11), on
`main` at `9ef483f0`, one build served for all three runs. Each run started
from a new, empty database, migrated and seeded, and passed its three AC2 tests.
The slowest operation in any run was viewing an event, at 323 ms. This replaces
the re-run the Sprint 3 file left to do.

The runs used Node 22, not the Node 24 in `.nvmrc`, and a port other than 3000,
which was in use. Neither changes what is timed.

**CI, the same day.** [Run 41333934564](https://github.com/Oihwbba/SPM-Group7-ConnectSphere/actions/runs/41333934564)
on `main` at `c704ac7e`, started 2026-11-02 at 01:55 SGT, passed with all 336
end-to-end tests green: view an event 495 ms, search venues 167 ms, open a
venue's availability 199 ms, check equipment availability 171 ms, submit a
registration 164 ms. That database was seeded at the start of the job and the
earlier specs had written to it, so it was not freshly seeded.

These times are for the app, its database and the browser on one machine. They
do not include the network or the deployed site.

# Sprint 2 evidence

Captured on the day, from the running system and CI. Each item names the story
and criterion it evidences.

## SCRUM-50 / SCRUM-53 — venue booking conflict detection

| File | What it shows | Captured |
|---|---|---|
| [SCRUM-50-venue-unavailable-refusal.png](SCRUM-50-venue-unavailable-refusal.png) | SCRUM-50 AC3 / SCRUM-53 AC3: after Venue Staff approved the Exhibition Hall for 10 Mar 2035 09:00–13:00, a Coordinator asking for 11:00–15:00 is refused and told the venue is unavailable for that period. No request is created. | 2026-09-27, by `e2e/bookings.spec.ts` › "SCRUM-50 AC2, SCRUM-52 AC1-3, SCRUM-53 AC1 & AC3 — …" run with `EVIDENCE_DIR=docs/evidence/sprint-2` against the local seeded app. CI attaches the same screenshot to every run's Playwright report. |
| [SCRUM-53-ci-concurrency-run.txt](SCRUM-53-ci-concurrency-run.txt) | SCRUM-53 AC4: the CI run where both "two staff approve at the same moment" tests passed against a real PostgreSQL 16 service container, including Postgres's own `23P01` refusal from `booking_no_double_booking`. It also shows the SCRUM-50/52/53 e2e journeys passing. Every line is verbatim from the job log. | 2026-09-27, [run 36318558404](https://github.com/Oihwbba/SPM-Group7-ConnectSphere/actions/runs/36318558404), commit `e15f446` |

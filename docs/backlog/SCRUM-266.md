<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-11-04. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-266 - Chore: Make every step of the demo script match the seed

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | 0 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-266 |

---

`docs/demo.md` is the script for the sprint review and the Q&A (SCRUM-198). SCRUM-233 reworked the seed and checked the demo only for the renamed events. Running it on 3 Nov on a freshly seeded database, and checking every step against `prisma/seed.ts`, found:

* **Section 2, step 5** shows setup and turnaround hatched on Seminar Room 2.1, which has none. Only the Black Box Studio has them, on "Confirmed: Change Pending — Open Mic Night".
* **Section 5, step 2** shows the full Wine Tasting Evening as `attendee@test.local`, who holds one of its places, so the full-event refusal never appears.
* **"After the demo"** says a re-seed leaves the change request Approved and the Grand Auditorium's turnaround changed. The seed resets both. It doesn't mention the unavailability section 7 records, which refuses a second run's Seminar Room request.

**Acceptance criteria**

1. Every step in `docs/demo.md` works on a freshly seeded database: the seeded events, accounts and values it names match `prisma/seed.ts`, and the wording it quotes matches the app.
2. "After the demo" says what a re-seed leaves behind.
3. Only Markdown changes.

**Related:** SCRUM-198 (the demo script), SCRUM-233 (the seed it must match).

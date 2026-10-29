# SCRUM-245 — Stop two integration tests failing when another test file runs at the same time: test cases

SCRUM-245 is a Chore task in Jira, found on 29 Oct running `npm run
test:coverage` against the local database. Vitest runs the integration files
in parallel against one database, and two tests read rows another file was
writing at the same moment. The tests they fix keep their stories' titles and
cases, [TC-21-02](SCRUM-21.md#tc-21-02) and
[TC-160-13](SCRUM-160.md#tc-160-13).

Format and conventions: [README.md](README.md).

**Shared pre-conditions:** a local PostgreSQL migrated with `npm run db:deploy`
and seeded with `npm run db:seed`, as in CI's `build-and-test`.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-245-01](#tc-245-01) | Positive | AC 1 | Integration |
| [TC-245-02](#tc-245-02) | Positive, Negative | AC 2 | Integration |
| [TC-245-03](#tc-245-03) | Positive | AC 3 | The whole suite, locally and in CI |

---

### TC-245-01

| Item | Content |
|---|---|
| Test Case ID | TC-245-01 |
| Test Scenario | [Positive] AC 1: the SCRUM-21 file's cleanup succeeds even when another file has notified its second Lead |
| Pre-conditions | `tests/integration/reassign.test.ts` has created its second Lead. |
| Test Steps | 1. While it exists, another file's action notifies every Lead about its own event. <br> 2. The file's cleanup runs. |
| Test Data | — |
| Expected Result | Every notification to the second Lead is deleted with the file's own, so the Lead is deleted and the file passes. Before the fix the delete failed on `Notification_userId_fkey`. |

**Automated by:** `tests/integration/reassign.test.ts` (its `afterAll`, which fails the file if it can't clean up)

### TC-245-02

| Item | Content |
|---|---|
| Test Case ID | TC-245-02 |
| Test Scenario | [Positive, Negative] AC 2: TC-160-13 counts only clashes between seeded rows |
| Pre-conditions | Seeded. |
| Test Steps | 1. Another file holds an approved booking and a maintenance block that clash on `ven_hall` while TC-160-13 runs. <br> 2. Separately, a maintenance block with a seeded-style id (`vun_…`) is put over a seeded `ven_hall` booking (`bkg_…`). |
| Test Data | `bkg_reg_closed`; a probe `vun_scrum245_probe` over 10:00–12:00 SGT on its day, removed afterwards |
| Expected Result | 1. TC-160-13 passes: neither row is seeded. 2. TC-160-13 fails and names the probe, so a clash between seeded rows is still caught. |

**Automated by:** `tests/integration/venue-time-clashes.test.ts` › "SCRUM-160 [AC4] TC-160-13: the seeded venues' times create no clash between seeded bookings". Step 2 was checked by hand on 29 Oct against the local database.

### TC-245-03

| Item | Content |
|---|---|
| Test Case ID | TC-245-03 |
| Test Scenario | [Positive] AC 3: nothing else in either test is weakened, and the suite passes |
| Pre-conditions | As above. |
| Test Steps | 1. Read the diff. <br> 2. Run `npm run test:coverage` against the local database, and let CI run. |
| Test Data | — |
| Expected Result | 1. Only the cleanup's notification filter and TC-160-13's filter to seeded rows change. 2. Both pass. |

**Automated by:** the whole suite, `npm run test:coverage` locally and CI's `build-and-test`.

# SCRUM-245 — Stop three integration tests failing when another test file runs at the same time: test cases

SCRUM-245 is a Chore task in Jira, found on 29 Oct running `npm run
test:coverage` against the local database. Vitest runs the integration files
in parallel against one database, and three tests read rows another file was
writing at the same moment. The tests they fix keep their stories' titles and
cases, [TC-21-02](SCRUM-21.md#tc-21-02), [TC-160-13](SCRUM-160.md#tc-160-13)
and [TC-50-09](SCRUM-50.md#tc-50-09).

Format and conventions: [README.md](README.md).

**Shared pre-conditions:** a local PostgreSQL migrated with `npm run db:deploy`
and seeded with `npm run db:seed`, as in CI's `build-and-test`.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-245-01](#tc-245-01) | Positive | AC 1 | Integration |
| [TC-245-02](#tc-245-02) | Positive, Negative | AC 2 | Integration |
| [TC-245-03](#tc-245-03) | Positive, Negative | AC 3 | Integration |
| [TC-245-04](#tc-245-04) | Positive | AC 4 | The whole suite, locally and in CI |

---

### TC-245-01

| Item | Content |
|---|---|
| Test Case ID | TC-245-01 |
| Test Scenario | [Positive] AC 1: the SCRUM-21 file creates and deletes no user, so its cleanup succeeds whatever another file sends the Leads |
| Pre-conditions | `tests/integration/reassign.test.ts` runs its concurrency test as the seeded Leads, `usr_coordinatorlead` and `usr_coordinatorlead_2` (`lead2@test.local`). |
| Test Steps | 1. While the file runs, another file's action notifies every Lead about its own event. <br> 2. The file's cleanup runs. |
| Test Data | — |
| Expected Result | The cleanup deletes only the file's own event and its notifications and history; no user is deleted, so no notification another file sent can fail it. Before the fix, deleting the file's throwaway Lead failed on `Notification_userId_fkey`. |

**Automated by:** `tests/integration/reassign.test.ts` (its `afterAll`, which fails the file if it can't clean up), with no `prisma.user` write in the file

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
| Test Scenario | [Positive, Negative] AC 3: TC-50-09 judges the events as the booking form's query returned them |
| Pre-conditions | Seeded. |
| Test Steps | 1. Another file confirms one of `usr_coordinator`'s Planning events while TC-50-09 runs. <br> 2. Separately, `BOOKABLE_EVENT_STATUSES` is made to offer Confirmed events too. |
| Test Data | `usr_coordinator`; `evt_approved`, `evt_planning` |
| Expected Result | 1. TC-50-09 passes: it checks each offered event's status, Organiser and Coordinator as read, so a later confirmation doesn't reach it. 2. TC-50-09 fails ("expected [ 'APPROVED', 'PLANNING' ] to include 'CONFIRMED'"), so an event the form shouldn't offer is still caught. |

**Automated by:** `tests/integration/bookings.test.ts` › "SCRUM-50 TC-50-09: the form offers only approved events the coordinator may act on, exactly as can() allows". Step 2 was checked by hand on 30 Oct and the list restored.

### TC-245-04

| Item | Content |
|---|---|
| Test Case ID | TC-245-04 |
| Test Scenario | [Positive] AC 4: nothing else in the three tests is weakened, and the suite passes |
| Pre-conditions | As above. |
| Test Steps | 1. Read the diff. <br> 2. Run `npm run test:coverage` against the local database, and let CI run. |
| Test Data | — |
| Expected Result | 1. Only the cleanup's notification filter, TC-160-13's filter to seeded rows and TC-50-09's single read change. 2. Both pass. |

**Automated by:** the whole suite, `npm run test:coverage` locally and CI's `build-and-test`.

# SCRUM-202 — A venue edit can deadlock with a simultaneous booking decision or event edit: test cases

SCRUM-202 is a Bug task in Jira, raised by the GLM review of #213 (SCRUM-124)
and the PO's review of #195 (SCRUM-160). Its acceptance criteria, as filed:

1. The venue edit and retirement actions retry once on a deadlock
   (`onceMoreOnDeadlock`, as the booking actions do), or take their locks in
   the same order as the booking and event actions.
2. An integration test runs a venue edit that flags a booking at the same
   moment as an approval (or a Coordinator's event edit) of that booking, and
   both end in a defined outcome with no unhandled error.
3. ADR 0007's lock order is updated if the order changes.

Format and conventions: [README.md](README.md).

**Why it failed:** the venue edit locks the venue and then flags bookings;
approving or holding a booking locks the booking and then the venue. The same
rows in opposite orders can deadlock, and Postgres aborts one (40P01). The
venue actions didn't retry, so Venue Staff got an unhandled error. The fix
retries once and keeps the order; why: [ADR 0007's 2026-10-25 addendum](../adr/0007-lock-equipment-pools-when-reserving.md).
AC 3: the order doesn't change, so the lock order itself stays as it was; the
addendum records the venue edit as the one exception, and why.

**Shared pre-conditions:** the unit cases mock the database. The integration
cases need a local PostgreSQL migrated with `npm run db:deploy` and seeded with
`npm run db:seed`; they make their own venue (capacity 100), a Planning event
and a Pending request for 40 at it, and remove them afterwards.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-202-01](#tc-202-01) | Negative | AC 1 | Unit |
| [TC-202-02](#tc-202-02) | Concurrency | AC 1, AC 2 | Integration |
| [TC-202-03](#tc-202-03) | Concurrency | AC 2 | Integration |

---

### TC-202-01

| Item | Content |
|---|---|
| Test Case ID | TC-202-01 |
| Test Scenario | [Negative] AC 1: an edit or retirement aborted as a deadlock is run once more; a second deadlock is thrown |
| Pre-conditions | Signed in as Venue Staff; the database aborts the first transaction as a deadlock |
| Test Steps | 1. Save a venue edit. <br> 2. Retire a venue. <br> 3. Repeat both with every attempt aborted. |
| Test Data | Error code `40P01`, "deadlock detected" |
| Expected Result | Steps 1 and 2: the second attempt is saved, and the venue is updated once. Step 3: each action runs twice, then the deadlock is thrown, not reported as a refusal. |

**Automated by:** `tests/unit/venue-catalogue.test.ts` › "SCRUM-202 [AC1] TC-202-01: an edit aborted as a deadlock is run once more and saved", "… a retirement aborted as a deadlock is run once more and saved", "… a second deadlock in a row is thrown, not retried again"

### TC-202-02

| Item | Content |
|---|---|
| Test Case ID | TC-202-02 |
| Test Scenario | [Concurrency] AC 1, AC 2: an edit caught in a deadlock with an approval's locks is run again and saved once |
| Pre-conditions | As above |
| Test Steps | 1. A transaction locks the booking, as an approval does first. <br> 2. Venue Staff lower the capacity to 30 and confirm the flag; the edit locks the venue and waits on the booking. <br> 3. The first transaction asks for the venue, as an approval does next. |
| Test Data | Capacity 100 → 30; booking for 40 |
| Expected Result | Postgres aborts the edit, which has waited longest; the first transaction finishes; the edit runs again and returns saved with 1 flagged. The venue's capacity is 30, the booking is still Pending and flagged "&lt;venue&gt; changed: Capacity 30 &lt; attendance 40", and the edit is recorded once. Without the retry, the edit throws "deadlock detected". |

**Automated by:** `tests/integration/venue-edit-deadlock.test.ts` › "SCRUM-202 [AC1, AC2] TC-202-02: an edit caught in a deadlock with an approval's locks is run again and saved once"

### TC-202-03

| Item | Content |
|---|---|
| Test Case ID | TC-202-03 |
| Test Scenario | [Concurrency] AC 2: an edit and an approval of the same booking at the same moment both end in a defined outcome |
| Pre-conditions | As above |
| Test Steps | 1. At the same moment, Venue Staff lower the capacity to 30 (confirming the flag) and approve the booking. |
| Test Data | As TC-202-02 |
| Expected Result | Neither throws. The edit is saved with 1 flagged, and the booking ends flagged: Approved and then flagged, or flagged first and the approval refused (SCRUM-26 AC5). |

**Automated by:** `tests/integration/venue-edit-deadlock.test.ts` › "SCRUM-202 [AC2] TC-202-03: an edit and an approval of the same booking at the same moment both end in a defined outcome"

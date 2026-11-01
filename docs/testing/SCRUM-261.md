# SCRUM-261 — Reserving equipment is refused when the earlier requests it waits for never run at the same time: test cases

SCRUM-261 is a Bug task in Jira under SCRUM-7, raised on 1 Nov from the
SCRUM-7 epic check's code review of SCRUM-134. Its acceptance criteria are in
[docs/backlog/SCRUM-261.md](../backlog/SCRUM-261.md).

Format and conventions: [README.md](README.md).

**Why it failed:** SCRUM-134 AC5 keeps stock for earlier open requests whose
events overlap the reservation. The check added up everything those requests
still needed and compared the total with what was free at the busiest moment,
so two earlier requests that never run at the same time were counted as if
they did. The fix, `firstComeShortfall` in
[lib/equipment/competing.ts](../../lib/equipment/competing.ts), weighs each
moment of the reservation's period the way `peakCommitted` weighs
availability: at each moment, what reserving would leave free (stock minus the
reservations and unavailability in use then, minus the quantity) must cover
what the earlier requests running then still need. The refusal names the
moment that falls furthest short, and the earliest-submitted request running
then.

**Shared pre-conditions:** signed in as Technical Support
(`techsupport@test.local` / `Password123!`). The request being reserved was
submitted after the earlier ones. The unit cases mock the database. The
integration cases need a local PostgreSQL migrated with `npm run db:deploy`
and seeded with `npm run db:seed`; they make their own events, a pool of 4 of
their own equipment type and Approved requests, and remove them afterwards.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-261-01](#tc-261-01) | Positive, Boundary | AC 1 | Unit, Integration |
| [TC-261-02](#tc-261-02) | Positive, Negative | AC 1 | Unit |
| [TC-261-03](#tc-261-03) | Negative, Boundary | AC 2 | Unit, Integration |

---

### TC-261-01

| Item | Content |
|---|---|
| Test Case ID | TC-261-01 |
| Test Scenario | [Positive, Boundary] AC 1: two earlier requests that never run at the same time are not added up, so the later request is reserved |
| Pre-conditions | A pool of 10, nothing reserved. Earlier request A runs 9–10am and needs 4; earlier request B runs 2–3pm and needs 4 (integration: a pool of 4; A 02:00–03:00 and B 05:00–06:00 need 1 each). |
| Test Steps | 1. Reserve 5 for request C, 9am–3pm. <br> 2. Reserve 6. <br> 3. Reserve 7. (Integration: reserve 3 for C, 02:00–06:00.) |
| Test Data | 1: 5 of 10. 2: 6 of 10, leaving A and B exactly their 4. 3: 7 of 10 (integration: 3 of 4) |
| Expected Result | 1 and 2: reserved, since at 9am and at 2pm what is left covers the one earlier request running then. 3: refused at 9am, where 3 would be left and A still needs 4. Integration: reserved, and one reservation is written. Before the fix, step 1 was refused because 4 and 4 were added to 8. |

**Automated by:** `tests/unit/first-come.test.ts` › "SCRUM-261 [AC1] TC-261-01: A (9–10, needs 4) and B (2–3pm, needs 4) never run together, so 5, and 6, can be reserved; 7 leaves A 3 of its 4" and "SCRUM-261 [AC1] TC-261-01: two earlier requests that never run together are not added up, so the later one is reserved"; `tests/integration/first-come.test.ts` › "SCRUM-261 [AC1] TC-261-01: two earlier requests that never run together are not added up, so the later one is reserved"

### TC-261-02

| Item | Content |
|---|---|
| Test Case ID | TC-261-02 |
| Test Scenario | [Positive, Negative] AC 1: stock in use only after an earlier request's event has ended isn't held against it; stock in use while it runs is |
| Pre-conditions | A pool of 10. Earlier request A runs 9–10am and needs 4. |
| Test Steps | 1. With 4 already reserved 2–3pm, reserve 5 for request C, 9am–3pm. <br> 2. With 4 already reserved 9:30–10am instead, reserve 5 for C. |
| Test Data | 5 of 10 |
| Expected Result | 1: allowed: at 9am 5 is left for A's 4, and at 2pm A's event is over. 2: refused at 9:30, where 1 would be left and A still needs 4. |

**Automated by:** `tests/unit/first-come.test.ts` › "SCRUM-261 [AC1] TC-261-02: stock in use only after the earlier request's event has ended isn't held against it"

### TC-261-03

| Item | Content |
|---|---|
| Test Case ID | TC-261-03 |
| Test Scenario | [Negative, Boundary] AC 2: where earlier requests run at the same time, what they still need then is added up: one too many is refused with nothing reserved, and exactly what is left is reserved |
| Pre-conditions | A pool of 10. Earlier request A runs 9–11am and needs 4; earlier request B runs 10am–3pm and needs 4 (integration: a pool of 4; A 02:00–04:00 and B 03:00–06:00 need 1 each). |
| Test Steps | 1. Reserve 3 for request C, 9am–3pm. <br> 2. Reserve 2. (Integration: reserve 3 for C, 02:00–06:00.) <br> 3. With A reserved in full, and B needing 6 with 1 reserved, reserve 5 for C, then 6. |
| Test Data | 1: 3 of 10. 2: 2 of 10. 3: 5, then 6, of 10 |
| Expected Result | 1: refused: at 10am A and B both run, 7 would be left and they still need 8; A, the earliest running then, is named. Integration: "Nothing was reserved: an earlier request comes first for the rows marked below." with 'Reserving 3 would leave 1 free, but an earlier request still needs 2: "[A's event]", …', and nothing is reserved. 2: allowed, since exactly the 8 is left. 3: 5 is allowed, since only what each still needs counts; 6 is refused at 2pm, where 4 would be left and B still needs 5, and B is named because A's event is over. |

**Automated by:** `tests/unit/first-come.test.ts` › "SCRUM-261 [AC2] TC-261-03: A (9–11) and B (10am–3pm) run together from 10, so their 4 and 4 add up then: 3 is one too many, 2 is exactly what is left", "SCRUM-261 [AC2] TC-261-03: only what the earlier requests still need counts, and the earliest running at that moment is named" and "SCRUM-261 [AC2] TC-261-03: where the two earlier requests do run together, what they need then is added up, and nothing is reserved"; `tests/integration/first-come.test.ts` › "SCRUM-261 [AC2] TC-261-03: where the earlier requests run together, what they need then is added up, and nothing is reserved"

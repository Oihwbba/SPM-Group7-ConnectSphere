# Test cases: SCRUM-259 - Chore: Patch the dependencies GitHub reports as vulnerable

**Story:** [docs/backlog/SCRUM-259.md](../backlog/SCRUM-259.md)

Done-when items 1 to 5 are versions and CI checks, proved by `package-lock.json`
and the pipeline, so only items 6 and 7 have test cases.

| ID | Type | Covers | Level |
|---|---|---|---|
| [TC-259-01](#tc-259-01) | Boundary | AC 7 | Unit |
| [TC-259-02](#tc-259-02) | Negative | AC 7 | Unit |
| [TC-259-03](#tc-259-03) | Boundary | AC 7 | Unit |
| [TC-259-04](#tc-259-04) | Positive | AC 7 | Unit |
| [TC-259-05](#tc-259-05) | Negative | AC 7 | Unit |
| [TC-259-06](#tc-259-06) | Negative | AC 6 | Unit |

---

### TC-259-01

| Item | Content |
|---|---|
| Test Case ID | TC-259-01 |
| Test Scenario | [Boundary] AC 7: every list in a request holds at most 500 entries |
| Pre-conditions | None: each schema is checked directly. |
| Test Steps | 1. Validate each list with 500 valid entries. <br> 2. Validate it with 501. |
| Test Data | Booking facilities and access features, clarification fields, draft and submitted event facilities, confirmed arrangements, unavailability and venue-update bookings, search facilities and access features, a venue's three tag lists. |
| Expected Result | 1 raises nothing against the list. 2 raises one issue against the list. |

**Automated by:** `tests/unit/list-limits.test.ts` › "SCRUM-259 [AC7] TC-259-01: the limit is 500 entries", "SCRUM-259 [AC7] TC-259-01: %s accepts 500 entries and refuses 501", "SCRUM-259 [AC7] TC-259-01: a venue's %s accepts 500 different tags and refuses 501"

### TC-259-02

| Item | Content |
|---|---|
| Test Case ID | TC-259-02 |
| Test Scenario | [Negative] AC 7: an oversized list is refused on its length, without its entries being read |
| Pre-conditions | None. |
| Test Steps | 1. Validate each list from TC-259-01 with 501 entries that are all invalid. |
| Test Data | 501 empty strings, numbers, unknown field names or over-long strings, by list. |
| Expected Result | One issue in total, not one for each entry. |

**Automated by:** `tests/unit/list-limits.test.ts` › "SCRUM-259 [AC7] TC-259-02: %s refuses 501 bad entries with one issue, without reading them"

### TC-259-03

| Item | Content |
|---|---|
| Test Case ID | TC-259-03 |
| Test Scenario | [Boundary] AC 7: the safety check's booking and reservation lists hold at most 500 entries |
| Pre-conditions | Signed in as a Safety Officer. |
| Test Steps | 1. Record an outcome naming 500 bookings. <br> 2. Record one naming 501. <br> 3. Repeat both with reservations. |
| Test Data | Check `chk_1`, outcome Approved. |
| Expected Result | 500 reach the check. 501 is refused before the check is read, and nothing is written. |

**Automated by:** `tests/unit/safety-check-outcome.test.ts` › "SCRUM-259 [AC7] TC-259-03: 500 %s reach the check, and 501 are refused before anything is read"

### TC-259-04

| Item | Content |
|---|---|
| Test Case ID | TC-259-04 |
| Test Scenario | [Positive] AC 7: a venue's tags behave as before |
| Pre-conditions | None. |
| Test Steps | 1. Validate facilities with a repeated tag in two spellings and a blank. <br> 2. Validate the same as comma-separated text. <br> 3. Validate 600 copies of one tag. |
| Test Data | "Sound System", "sound-system", " ", "Projector". |
| Expected Result | 1 and 2 give `sound-system`, `projector`, in that order. 3 is accepted as one tag. |

**Automated by:** `tests/unit/list-limits.test.ts` › "SCRUM-259 [AC7] TC-259-04: tags are still normalised and repeats dropped, in order, and repeats don't count towards the limit"

### TC-259-05

| Item | Content |
|---|---|
| Test Case ID | TC-259-05 |
| Test Scenario | [Negative] AC 7: removing repeats from a huge tag list doesn't compare every tag with every other |
| Pre-conditions | None. |
| Test Steps | 1. Validate 200,000 different facilities. |
| Test Data | `tag-0` to `tag-199999`. |
| Expected Result | One issue, inside the test's time limit. |

**Automated by:** `tests/unit/list-limits.test.ts` › "SCRUM-259 [AC7] TC-259-05: 200,000 different tags are refused promptly, not compared with each other"

### TC-259-06

| Item | Content |
|---|---|
| Test Case ID | TC-259-06 |
| Test Scenario | [Negative] AC 6: the Zod 4 upgrade keeps the messages people see |
| Pre-conditions | As each cited test. |
| Test Steps | 1. Submit an event without choosing Registration needed. <br> 2. Record a judgement without a note. <br> 3. Save a venue with no capacity. |
| Test Data | — |
| Expected Result | 1 "Choose whether the event needs registration." 2 "Add a note explaining your judgement." 3 "Capacity must be a whole number greater than 0." |

**Automated by:** `tests/unit/events.test.ts` › "SCRUM-171 [AC2] TC-171-02: submitting without choosing Registration needed is refused, and nothing is created"; `tests/unit/suitability-judgement.test.ts` › "SCRUM-40 [AC8] TC-40-09: a judgement without a note (undefined) is refused against the note and nothing is written"; `tests/unit/venue-catalogue.test.ts` › "SCRUM-34 [AC3] TC-34-04: a venue with no capacity is refused against it, and nothing is written"

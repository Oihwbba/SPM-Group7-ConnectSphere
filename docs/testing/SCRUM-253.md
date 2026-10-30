# SCRUM-253 — Every venue has opening hours: test cases

SCRUM-253 is a Chore task in Jira. Creating or editing a venue already
requires hours for all seven days (SCRUM-34 AC3), but the SCRUM-34 migration
left venues whose free-text hours it couldn't read with none, and booking,
search, the setup and turnaround warning, the venue page and the venue form
each treated such a venue as a special case.

Format and conventions: [README.md](README.md).

**Shared pre-conditions:** a local PostgreSQL migrated with `npm run db:deploy`
and seeded with `npm run db:seed`, as in CI's `build-and-test`. TC-253-01,
TC-253-04 and TC-253-05 build their own scratch database instead.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-253-01](#tc-253-01) | Positive | AC 1 | Integration |
| [TC-253-02](#tc-253-02) | Boundary | AC 1 | Unit |
| [TC-253-03](#tc-253-03) | Positive | AC 1 | Unit |
| [TC-253-04](#tc-253-04) | Negative | AC 2 | Integration |
| [TC-253-05](#tc-253-05) | Positive | AC 2, AC 5 | Integration, and the whole suite in CI |
| [TC-253-06](#tc-253-06) | Positive | AC 3 | Unit |
| [TC-253-07](#tc-253-07) | Positive | AC 4 | Unit |
| [TC-253-08](#tc-253-08) | Positive | AC 3, AC 5 | Manual (the venue screens, and a document check) |

---

### TC-253-01

| Item | Content |
|---|---|
| Test Case ID | TC-253-01 |
| Test Scenario | [Positive] AC 1: venues without hours get 00:00–23:59 when the migration runs, and the others keep theirs |
| Pre-conditions | A database with every migration before `20261030120000_every_venue_has_hours`, and three venues: one with no hours rows, one with its week (Monday to Friday 09:00–18:00, Closed at weekends), and one with rows for Monday to Wednesday only (10:00–20:00). |
| Test Steps | 1. Run the migration. <br> 2. Read each venue's hours. |
| Test Data | — |
| Expected Result | The venue with no rows opens 00:00–23:59 on all seven days. The venue with its week is unchanged. The venue with three days keeps them, and Thursday to Sunday are Closed, as a missing day already read. |

**Automated by:** `tests/integration/every-venue-has-hours.test.ts` › "SCRUM-253 [AC1] TC-253-01: …" (3 tests)

### TC-253-02

| Item | Content |
|---|---|
| Test Case ID | TC-253-02 |
| Test Scenario | [Boundary] AC 1: 00:00–23:59 every day refuses no period an event can have |
| Pre-conditions | A venue open 00:00–23:59 on every day. |
| Test Steps | 1. Check a Saturday 03:00–05:00, a Saturday 00:00–23:59 and a Tuesday 19:00–23:59 against its hours. <br> 2. Check a Saturday, a Sunday and a Tuesday searched without times. <br> 3. Check a Saturday 23:00 to Sunday 00:00, and 23:00 to 01:00. |
| Test Data | — |
| Expected Result | 1. None is refused: an event ends on its start date, by 23:59 (SCRUM-190). <br> 2. The venue is closed on none of them. <br> 3. Both are outside, naming Saturday 00:00–23:59: a period ending at midnight is one minute past what an event can reach (SCRUM-34 AC7). |

**Automated by:** `tests/unit/venue-hours.test.ts` › "SCRUM-253 [AC1] TC-253-02: …" (6 tests)

### TC-253-03

| Item | Content |
|---|---|
| Test Case ID | TC-253-03 |
| Test Scenario | [Positive] AC 1: real hours Venue Staff set on a venue given 00:00–23:59 count against its bookings |
| Pre-conditions | A venue open 00:00–23:59, with a booking on Tuesday 10:00–14:00 (SCRUM-34 AC10). |
| Test Steps | 1. Change its hours to 12:00–18:00 every day. |
| Test Data | — |
| Expected Result | The booking is listed as affected: "Outside opening hours (Tuesday 12:00–18:00)". |

**Automated by:** `tests/unit/venue-changes.test.ts` › "SCRUM-253 [AC1] TC-253-03: real hours set on an old venue given 00:00–23:59 count against a booking outside them"

### TC-253-04

| Item | Content |
|---|---|
| Test Case ID | TC-253-04 |
| Test Scenario | [Negative] AC 2: the database refuses a venue without a row for each day |
| Pre-conditions | The migrated scratch database of TC-253-01. |
| Test Steps | 1. Insert a venue with no hours. <br> 2. In one transaction, insert a venue and six days of hours. <br> 3. Delete Sunday's row of a venue that has its week. |
| Test Data | — |
| Expected Result | Each is refused when its transaction commits, with SQLSTATE 23514 and the constraint `venue_has_week_of_hours`. Nothing is written: neither venue exists, and the third venue still has seven rows. |

**Automated by:** `tests/integration/every-venue-has-hours.test.ts` › "SCRUM-253 [AC2] TC-253-04: …" (3 tests)

### TC-253-05

| Item | Content |
|---|---|
| Test Case ID | TC-253-05 |
| Test Scenario | [Positive] AC 2, AC 5: a venue saved with its week is kept, and its hours can still be changed |
| Pre-conditions | The migrated scratch database of TC-253-01. |
| Test Steps | 1. In one transaction, insert a venue and its seven days. <br> 2. Change Monday's opening time; in one transaction, replace Saturday's row with a new one. <br> 3. Delete the venue. <br> 4. Seed a fresh database, and run the whole suite, whose test venues are created with their week (`tests/venue-hours-fixture.ts`). |
| Test Data | — |
| Expected Result | 1. The venue is kept, with seven rows. 2. Both are saved: Monday opens at 10:00 and Saturday is 10:00–15:00. 3. The venue and its hours are gone. 4. The seed finishes, and every test that creates a venue runs, as venue creation (SCRUM-34 AC3) and editing (AC10) already write all seven days. |

**Automated by:** `tests/integration/every-venue-has-hours.test.ts` › "SCRUM-253 [AC2] TC-253-05: …" (3 tests); step 4 by CI's `build-and-test`, which seeds before testing

### TC-253-06

| Item | Content |
|---|---|
| Test Case ID | TC-253-06 |
| Test Scenario | [Positive] AC 3: nothing reads a venue as having no hours |
| Pre-conditions | — |
| Test Steps | 1. Check a Saturday booking period, and a Saturday searched without times, against no rows at all. <br> 2. Check a booking 01:00–22:59 and one 01:00–23:00, each with 60 minutes' setup and turnaround, at a venue open 00:00–23:59. |
| Test Data | — |
| Expected Result | 1. Both read Saturday as Closed: "Annex is closed on Saturdays, so it can't be booked then." No special case lets a venue with no rows refuse nothing. <br> 2. The first warns of nothing; the second's turnaround to 00:00 is warned of, as at any venue (SCRUM-159 AC9): "The turnaround time (60 minutes, until 00:00) falls outside Annex's opening hours, 00:00–23:59 on Tuesdays. You can still hold or approve it." |

**Automated by:** `tests/unit/venue-hours.test.ts` › "SCRUM-253 [AC3] TC-253-06: …" (3 tests)

### TC-253-07

| Item | Content |
|---|---|
| Test Case ID | TC-253-07 |
| Test Scenario | [Positive] AC 4: the old free-text hours are no longer read or written |
| Pre-conditions | The Prisma client generated from `prisma/schema.prisma`. |
| Test Steps | 1. List the Venue fields the client reads and writes. |
| Test Data | — |
| Expected Result | `operatingHours` is not among them (the schema marks it `@ignore`); `name` is. The column itself stays until a later migration drops it. |

**Automated by:** `tests/unit/venue-free-text-hours.test.ts` › "SCRUM-253 [AC4] TC-253-07: the database client has no Venue.operatingHours to read or write"

### TC-253-08

| Item | Content |
|---|---|
| Test Case ID | TC-253-08 |
| Test Scenario | [Positive] AC 3, AC 5: the venue screens and the test cases describe no venue without hours |
| Pre-conditions | Signed in as Venue Staff; seeded. |
| Test Steps | 1. Open each seeded venue, then Edit venue. <br> 2. Read SCRUM-34's, SCRUM-38's and SCRUM-159's test cases. |
| Test Data | `venuestaff@test.local` / `Password123!` |
| Expected Result | 1. Each venue page lists all seven days, and the form shows each day's hours or Closed; neither has a "not recorded" message. <br> 2. TC-34-08, TC-34-17, TC-38-15 and TC-159-19 no longer describe a venue with no hours, and TC-34-20 is marked superseded by this chore. |

**Automated by:** Manual

# SCRUM-246 — The event request form shows equipment stock as "available" and doesn't show venues' opening hours: test cases

SCRUM-246 is a Bug task in Jira under SCRUM-6, raised on 30 Oct from a code
and UI review of the Event Request Lifecycle and Attendee Registration epics.
Its acceptance criteria are in [docs/backlog/SCRUM-246.md](../backlog/SCRUM-246.md).

Format and conventions: [README.md](README.md).

**Why it failed:** the equipment label printed `Equipment.totalQuantity` as
"N available", though it ignores the event's date and every reservation, and
`getFormCatalogues` didn't return opening hours, so the venue list showed a
name and a capacity only. The fix says "N in stock", and returns each venue's
week as `describeWeek` in `lib/venue-hours.ts` reads it: `describeDay` for
every day, Monday first, a day with no row Closed (as `closedOn` reads one).

**Shared pre-conditions:** signed in as `organiser@test.local` /
`Password123!` on the seeded database (`prisma/seed.ts`): 10 Projectors;
Seminar Room 2.1 (capacity 60) open 08:00–20:00 on weekdays and closed at
weekends; the Grand Auditorium (capacity 500) open 07:00–23:00 every day. The
unit cases mock the database.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-246-01](#tc-246-01) | Positive | AC 1 | E2E |
| [TC-246-02](#tc-246-02) | Positive | AC 2 | Unit, E2E |

---

### TC-246-01

| Item | Content |
|---|---|
| Test Case ID | TC-246-01 |
| Test Scenario | [Positive] AC 1: each equipment option shows its total as "N in stock", not "N available" |
| Pre-conditions | Shared pre-conditions |
| Test Steps | 1. Open Create Event Request. <br> 2. Go to step 4 - Equipment. <br> 3. Open Equipment & Technical Support Requirements. |
| Test Data | Projector, 10 in stock (seed) |
| Expected Result | The Projector option reads "Projector 10 in stock". No option in the list says "available". |

**Automated by:** `e2e/request-form-catalogue.spec.ts` › "SCRUM-246 [AC1] TC-246-01: equipment shows its total as in stock, never as available"

### TC-246-02

| Item | Content |
|---|---|
| Test Case ID | TC-246-02 |
| Test Scenario | [Positive] AC 2: each venue option shows its capacity and its opening hours for every day, with Closed days as Closed, in the venue catalogue's words |
| Pre-conditions | Shared pre-conditions |
| Test Steps | 1. Open Create Event Request. <br> 2. Go to step 3 - Venue. <br> 3. Open Venue Requirements. |
| Test Data | Seminar Room 2.1; Grand Auditorium; for the unit cases, the Executive Boardroom's hours (weekdays 09:00–18:00, closed at weekends), then three of its rows in a different order |
| Expected Result | Seminar Room 2.1 shows capacity 60 and, in order, "Monday 08:00–20:00" to "Friday 08:00–20:00", "Saturday Closed", "Sunday Closed". The Grand Auditorium shows 07:00–23:00 on all seven days. Rows in any order read Monday first, and a day with no row reads Closed, as `closedOn` treats it. |

**Automated by:** `tests/unit/venue-hours.test.ts` › "SCRUM-246 [AC2] TC-246-02: every day is listed, Monday first, with Closed days as Closed", "SCRUM-246 [AC2] TC-246-02: rows in any order read the same, and a day with no row is Closed"; `tests/unit/events.test.ts` › "SCRUM-246 [AC2] TC-246-02: each venue comes with its capacity and every day's opening hours, a Closed day as Closed"; `e2e/request-form-catalogue.spec.ts` › "SCRUM-246 [AC2] TC-246-02: each venue shows its capacity and every day's hours, Closed days as Closed"


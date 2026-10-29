# SCRUM-233 — Bring the seed in line with the event lifecycle: test cases

SCRUM-233 is a Chore task in Jira. The seed (`prisma/seed.ts`) showed what the
stories rule out: an event resting in Approved, Confirmed events that could
never have been confirmed, a rejection by nobody's Coordinator, an event
cancelled by its Organiser, and history entries the actions never write.

Format and conventions: [README.md](README.md).

**Shared pre-conditions:** a local PostgreSQL migrated with `npm run db:deploy`
and seeded with `npm run db:seed`, as in CI's `build-and-test`. The
integration cases read only rows with the seed's fixed ids (`evt_`, `aud_`,
`eqr_`, …), so suites writing alongside them don't change the result.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-233-01](#tc-233-01) | Positive, Negative | AC 1 | Integration |
| [TC-233-02](#tc-233-02) | Boundary | AC 2 | Integration |
| [TC-233-03](#tc-233-03) | Positive, Negative | AC 3 | Unit, e2e |
| [TC-233-04](#tc-233-04) | Positive | AC 4 | Integration |
| [TC-233-05](#tc-233-05) | Positive | AC 5 | Integration |
| [TC-233-06](#tc-233-06) | Positive | AC 6 | Integration |
| [TC-233-07](#tc-233-07) | Positive | AC 7 | Integration |
| [TC-233-08](#tc-233-08) | Positive | AC 8 | Integration |
| [TC-233-09](#tc-233-09) | Positive | AC 9 | Manual (a document check) |
| [TC-233-10](#tc-233-10) | Positive | AC 10 | The whole suite, on a freshly reset local database and in CI |
| [TC-233-11](#tc-233-11) | Positive | AC 11 | Manual (the shared database, after the merge) |
| [TC-233-12](#tc-233-12) | Negative | AC 12 | Unit |

---

### TC-233-01

| Item | Content |
|---|---|
| Test Case ID | TC-233-01 |
| Test Scenario | [Positive, Negative] AC 1: no seeded event is Approved; `evt_approved` keeps its id as "Planning — Research Symposium", with ADR 0012's two history entries |
| Pre-conditions | Freshly seeded. |
| Test Steps | 1. Count seeded events in Approved. <br> 2. Read `evt_approved`. <br> 3. Read its seeded history, oldest first. |
| Test Data | `evt_approved` |
| Expected Result | 1. None. 2. Named "Planning — Research Symposium", status Planning, approved by `usr_coordinator`. 3. Under Review → Approved by `usr_coordinator`, then Approved → Planning with no actor and the summary "Moved to Planning on approval (SCRUM-81)". |

**Automated by:** `tests/integration/seed-lifecycle.test.ts` › "SCRUM-233 [AC1] TC-233-01: no seeded event is Approved; the Research Symposium is Planning, with its approval and its move to Planning in its history"

### TC-233-02

| Item | Content |
|---|---|
| Test Case ID | TC-233-02 |
| Test Scenario | [Boundary] AC 2: every seeded event with a period starts and ends on the same Singapore day (SCRUM-190) |
| Pre-conditions | Freshly seeded. |
| Test Steps | 1. For every seeded event with a start and an end, apply SCRUM-190's rule (`eventPeriodError`). |
| Test Data | Includes `evt_completed` "Completed — Hackathon" |
| Expected Result | No event is refused. `evt_completed` runs 09:00–18:00 Singapore time on one day. |

**Automated by:** `tests/integration/seed-lifecycle.test.ts` › "SCRUM-233 [AC2] TC-233-02: every seeded event with a period starts and ends on the same Singapore day, the Hackathon included"

### TC-233-03

| Item | Content |
|---|---|
| Test Case ID | TC-233-03 |
| Test Scenario | [Positive, Negative] AC 3: neither status filter offers Approved; both still offer Planning |
| Pre-conditions | Freshly seeded. |
| Test Steps | 1. As `organiser@test.local`, open **My Events** and open **Filter by status**. <br> 2. As `coordinator@test.local`, open **All Events** and open **Status**. <br> 3. Open `/all-events?status=APPROVED`. |
| Test Data | `Password123!` |
| Expected Result | 1, 2. Planning is offered; Approved is not. 3. The filter is ignored, as for any malformed value. A history entry still shows "Approved", since the label stays. |

**Automated by:** `tests/unit/all-events.test.ts` › "SCRUM-233 [AC3] TC-233-03: offers every status an event can rest in, and not Approved, which approval never leaves an event in"; `e2e/seed-lifecycle.spec.ts` › "SCRUM-233 [AC3] TC-233-03: My Events and All Events don't offer Approved, and still offer Planning"; `e2e/status-names.spec.ts` › "SCRUM-131 [AC1] TC-131-01: the Organiser's tab of every request that isn't a draft reads Sent, and the status filter offers the agreed names an event can rest in"

### TC-233-04

| Item | Content |
|---|---|
| Test Case ID | TC-233-04 |
| Test Scenario | [Positive] AC 4: every seeded Confirmed event passes the readiness checklist's items, with its submission and approval recorded |
| Pre-conditions | Freshly seeded. |
| Test Steps | 1. List the seeded Confirmed events. <br> 2. For each, run `getReadinessChecklist` and read `submittedAt`, `decidedAt`, `decidedById` and `confirmedVenues`. |
| Test Data | `evt_confirmed`, `evt_full`, `evt_last_seat`, `evt_reg_not_open`, `evt_reg_closed`, and SCRUM-238's `evt_cancellation_requested` and `evt_no_registration` |
| Expected Result | Exactly those seven. Each has Venue booking Approved, Equipment Reserved or No equipment needed, and Safety check Approved; each was submitted and approved by `usr_coordinator`; each shows Attendees at least one venue. |

**Automated by:** `tests/integration/seed-lifecycle.test.ts` › "SCRUM-233 [AC4] TC-233-04: every seeded Confirmed event has a covering approved venue, its equipment settled, an Approved safety check, and its submission and approval recorded"

### TC-233-05

| Item | Content |
|---|---|
| Test Case ID | TC-233-05 |
| Test Scenario | [Positive] AC 5: a seeded rejection was made by the Coordinator assigned to the request (SCRUM-135 AC 4) |
| Pre-conditions | Freshly seeded. |
| Test Steps | 1. For each seeded Rejected event, compare `coordinatorId` with `decidedById`. |
| Test Data | `evt_rejected`, and SCRUM-238's `evt_rejected_new_request` |
| Expected Result | Each has a Coordinator, and it is the one who rejected it. |

**Automated by:** `tests/integration/seed-lifecycle.test.ts` › "SCRUM-233 [AC5] TC-233-05: a seeded rejection was made by the Coordinator assigned to the request"

### TC-233-06

| Item | Content |
|---|---|
| Test Case ID | TC-233-06 |
| Test Scenario | [Positive] AC 6: the cancelled event could have reached its state: confirmed with registration open, cancelled by its Coordinator, on a weekday, its reservation from an approved request |
| Pre-conditions | Freshly seeded. |
| Test Steps | 1. Read `evt_cancelled`, its registration, booking, reservation and the reservation's request history. <br> 2. Read its seeded history. |
| Test Data | `evt_cancelled` "Cancelled — Winter Workshop" |
| Expected Result | 1. Cancelled by its Coordinator; approved by `usr_coordinator`; registration enabled and the registration made after it opened; the event and its Seminar Room booking start on a Singapore weekday; the booking was decided by Venue Staff; the reservation's request was Approved (and then cancelled with the event). 2. Confirmed → Cancelled by `usr_coordinator`. |

**Automated by:** `tests/integration/seed-lifecycle.test.ts` › "SCRUM-233 [AC6] TC-233-06: the cancelled event was confirmed with registration open, cancelled by its Coordinator, on a weekday, and its reservation came from an approved request"

### TC-233-07

| Item | Content |
|---|---|
| Test Case ID | TC-233-07 |
| Test Scenario | [Positive] AC 7: the seeded history matches what the actions write (ADR 0012, SCRUM-21) |
| Pre-conditions | Freshly seeded. |
| Test Steps | 1. Read the seeded event history entries (`aud_`). |
| Test Data | — |
| Expected Result | Every Approved → Planning entry has no actor and follows the Coordinator's approval of the same event; every → Confirmed entry names the event's assigned Coordinator; every reassignment is by a user holding the Lead role. |

**Automated by:** `tests/integration/seed-lifecycle.test.ts` › "SCRUM-233 [AC7] TC-233-07: seeded history matches the actions: the system moves an event to Planning, the assigned Coordinator confirms it, and a Lead reassigns it"

### TC-233-08

| Item | Content |
|---|---|
| Test Case ID | TC-233-08 |
| Test Scenario | [Positive] AC 8: the clarification names the event's layout; submitted events have Venue Requirements; the rejection notice has the reason and next step |
| Pre-conditions | Freshly seeded. |
| Test Steps | 1. Read `clr_career_fair` and its event's preferred layout. <br> 2. List seeded non-draft events without Venue Requirements. <br> 3. Read `ntf_3` and `evt_rejected`'s reason. |
| Test Data | — |
| Expected Result | 1. The layout is theatre, and the question says "theatre layout", not classroom. 2. None. 3. The notice contains the reason and "What you can do next: Amend and resubmit.", as `transitionEventStatus` words it (SCRUM-45 AC 3). |

**Automated by:** `tests/integration/seed-lifecycle.test.ts` › "SCRUM-233 [AC8] TC-233-08: the clarification names the event's own layout, every submitted event has Venue Requirements, and the rejection notice gives the reason and the next step"

### TC-233-09

| Item | Content |
|---|---|
| Test Case ID | TC-233-09 |
| Test Scenario | [Positive] AC 9: the docs describe the seed as it now is |
| Pre-conditions | — |
| Test Steps | 1. Read the README's seed section and its SCRUM-155 demo note. <br> 2. Read `docs/product-context.md`'s status paragraph, ADR 0012's 2026-10-29 addendum and the reviewer memory's Approved lesson. <br> 3. Read `docs/testing/SCRUM-27.md`, `SCRUM-31.md` and `SCRUM-186.md`. <br> 4. Search `docs/demo.md` for the changed events. |
| Test Data | — |
| Expected Result | 1–3. None calls `evt_approved` Approved or says every status has a seeded event; each says why Approved has none. 4. It names no changed detail of a changed event, so it needs no edit. |

**Automated by:** Manual (a document check).

### TC-233-10

| Item | Content |
|---|---|
| Test Case ID | TC-233-10 |
| Test Scenario | [Positive] AC 10: the suites that count or use seeded rows still pass with the new safety checks, bookings and equipment rows |
| Pre-conditions | A local database reset with `npm run db:reset`. |
| Test Steps | 1. Run `npm run test:coverage`. <br> 2. Run `npm run test:e2e`. |
| Test Data | — |
| Expected Result | Both pass, including SCRUM-166's, SCRUM-27's, SCRUM-186's, SCRUM-110's and SCRUM-238's suites. |

**Automated by:** the whole suite, run on a freshly reset local database and by CI's `build-and-test`.

### TC-233-11

| Item | Content |
|---|---|
| Test Case ID | TC-233-11 |
| Test Scenario | [Positive] AC 11: after the merge, the shared database follows the lifecycle |
| Pre-conditions | Merged. A backup of the shared database taken first (see the pull request). |
| Test Steps | 1. Run `npm run db:seed` on the shared database. <br> 2. Run read-only queries for every Approved event, seeded or not, events spanning two Singapore days, and each Confirmed event's readiness. |
| Test Data | — |
| Expected Result | No seeded event is Approved, none spans two days, and every seeded Confirmed event passes readiness. The seed removes no row, so nothing needs deleting by hand. Rows created through the app are reported, not changed: in particular, any event left Approved from before approval saved Planning (#120) is counted and listed for the PO, since it can no longer take an equipment request or reservation or be found by a status filter; it can still be cancelled (SCRUM-135 AC 9). |

**Automated by:** Manual (the shared database, after the merge).

### TC-233-12

| Item | Content |
|---|---|
| Test Case ID | TC-233-12 |
| Test Scenario | [Negative] AC 12: equipment can't be requested, or offered, for an event left in Approved (SCRUM-27 AC 1) |
| Pre-conditions | Signed in as the event's Coordinator. |
| Test Steps | 1. Read `REQUESTABLE_EVENT_STATUSES`. <br> 2. Submit a request for an event stored as Approved. <br> 3. Open the Equipment section of an Approved event's page. |
| Test Data | An event with status APPROVED |
| Expected Result | 1. Planning only. 2. Refused with "Choose one of your approved events."; nothing is written. 3. Request equipment isn't offered. |

**Automated by:** `tests/unit/equipment-request-queries.test.ts` › "SCRUM-27 [AC1] TC-27-01: treats only planning events as ones equipment can be requested for"; `tests/unit/equipment-request.test.ts` › "SCRUM-27 [AC1] TC-27-02: refuses %s with the same message, and saves nothing" (an event left in Approved); `tests/unit/readiness-actions.test.ts` › "SCRUM-209 [AC2, AC4] TC-209-03: at $status, a new request offered is $offered (SCRUM-27's own rule)" (APPROVED, false)

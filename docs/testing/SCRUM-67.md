# SCRUM-67 — Be prevented from performing an action my role does not permit: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-67.md](../backlog/SCRUM-67.md).
Format and conventions: [README.md](README.md). Every Server Action checks the
caller through `can()` in [lib/auth/can.ts](../../lib/auth/can.ts): the role
first, then the caller's relationship to the event or record (ADR 0004).
Pages call `requireSession` in [lib/auth/guard.ts](../../lib/auth/guard.ts).

Written on 2026-10-12 from the acceptance criteria, then mapped to the tests
that already existed (SCRUM-176). The tests predate the `SCRUM-n [ACx] TC-n-xx`
title format, so each case names them by their current titles.

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. Every seeded account's password is `Password123!`.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-67-01](#tc-67-01) | Negative | AC 1 | Unit |
| [TC-67-02](#tc-67-02) | Negative | AC 1 | Unit |
| [TC-67-03](#tc-67-03) | Negative | AC 2 | Integration |
| [TC-67-04](#tc-67-04) | Negative | AC 3 | Unit, e2e |
| [TC-67-05](#tc-67-05) | Negative | AC 4 | Unit, e2e |
| [TC-67-06](#tc-67-06) | Negative | AC 5 | Unit |

---

### TC-67-01

| Item | Content |
|---|---|
| Test Case ID | TC-67-01 |
| Test Scenario | [Negative] AC 1: a role is refused an action it doesn't hold |
| Pre-conditions | None beyond the shared ones. |
| Test Steps | 1. As the Attendee, create an event request. <br> 2. As Venue Staff, review an event request. <br> 3. As the Organiser or the Attendee, open the venue catalogue. <br> 4. As the Coordinator, open the catalogue and raise an equipment request. |
| Test Data | The seeded accounts |
| Expected Result | Steps 1, 2 and 3 are refused. The Coordinator may open the catalogue and raise the equipment request. |

**Superseded in part** on 20 Oct 2026 by SCRUM-34 AC 2 ([TC-34-02](SCRUM-34.md#tc-34-02)): Venue Staff opening the catalogue was refused; every internal user, Venue Staff included, now reads it, and only the external roles are refused (`venue:read` in [lib/auth/can.ts](../../lib/auth/can.ts)). Step 3 checks that refusal instead.

**Automated by:** `tests/unit/auth.test.ts` › "does not let an attendee create events", "does not let a venue-staff member review events", "SCRUM-34 [AC2] TC-34-02: %s, an external user, doesn't read the venue catalogue", "lets a coordinator read the venue catalogue", "lets a coordinator create and list equipment requests"; the Venue Staff half by "SCRUM-34 [AC2] TC-34-02: %s, an internal user, reads the venue catalogue"

### TC-67-02

| Item | Content |
|---|---|
| Test Case ID | TC-67-02 |
| Test Scenario | [Negative] AC 1: holding the role isn't enough without the relationship to the record |
| Pre-conditions | A request by `organiser@test.local`, assigned to `coordinator@test.local`. |
| Test Steps | 1. As `organiser2@test.local`, read the request. <br> 2. As the other Coordinator, read it, and raise an equipment request for it. <br> 3. As an Attendee, read another Attendee's registration. |
| Test Data | The request; a registration |
| Expected Result | Each is refused. The request's own Organiser and its assigned Coordinator may read it. |

**Automated by:** `tests/unit/auth.test.ts` › "lets an organiser read their own event", "does not let a different organiser read someone else's event", "lets the assigned coordinator read the event", "does not let an unassigned coordinator read the event", "lets a coordinator request equipment only for an event they coordinate", "lets an attendee read only their own registration", "gives no event relationship to a role that holds an event action but isn't the organiser or coordinator"

### TC-67-03

| Item | Content |
|---|---|
| Test Case ID | TC-67-03 |
| Test Scenario | [Negative] AC 2: a refused action changes nothing in the database |
| Pre-conditions | A local database. |
| Test Steps | 1. As each role other than Organiser, call `createDraftEvent` directly. <br> 2. Count the events. <br> 3. As the Organiser, call it. |
| Test Data | A draft |
| Expected Result | Each refused call leaves the number of events unchanged. The Organiser's call creates the draft. |

**Automated by:** `tests/integration/permission-guard.test.ts` › "SCRUM-67 — createDraftEvent is guarded for every role", "still lets an ORGANISER create a draft (the permitted path works)"

### TC-67-04

| Item | Content |
|---|---|
| Test Case ID | TC-67-04 |
| Test Scenario | [Negative] AC 3: typing a page's address, or calling an action directly, doesn't get round the check |
| Pre-conditions | Signed in as the Organiser; then signed out. |
| Test Steps | 1. Type another role's page address. <br> 2. Open an event's own address with any id. <br> 3. Signed out, open a protected page. |
| Test Data | `/bookings`, `/equipment` |
| Expected Result | Step 1 is refused by the server. Step 2 returns "not found": no event has its own page. Step 3 sends the visitor to `/login`. |

**Automated by:** `tests/unit/auth-guard.test.ts` › "redirects to /login when there is no session (deny path)", "redirects to /login when the session has no user (deny path)", "returns the session and does not redirect when signed in (allow path)"; `e2e/access-control.spec.ts` › "SCRUM-67 — typing another role's URL directly is refused", "a per-event URL 404s from routing, for any id", "SCRUM-67 — signed-out access to a protected URL redirects to login"

### TC-67-05

| Item | Content |
|---|---|
| Test Case ID | TC-67-05 |
| Test Scenario | [Negative] AC 4: a refusal looks the same as a record that doesn't exist |
| Pre-conditions | A request assigned to `coordinator@test.local`. |
| Test Steps | 1. As the other Coordinator, decide the request, and ask for clarification on it. <br> 2. Send the same for an id that doesn't exist. |
| Test Data | The request's id; a made-up id |
| Expected Result | Both get the same "not found" answer, so the refusal reveals nothing about the request. |

**Automated by:** `tests/unit/event-status.test.ts` › "SCRUM-68: another coordinator's event is indistinguishable from a missing one"; `tests/unit/clarification.test.ts` › "[Negative] SCRUM-68: another coordinator's event is indistinguishable from a missing one"; `e2e/access-control.spec.ts` › "a per-event URL 404s from routing, for any id"

### TC-67-06

| Item | Content |
|---|---|
| Test Case ID | TC-67-06 |
| Test Scenario | [Negative] AC 5: a feature that checks a role on its own is flagged |
| Pre-conditions | A pull request whose page checks `session.user.role` against a list itself. |
| Test Steps | 1. Run the GLM review's scan of the branch. |
| Test Data | `const ALLOWED_ROLES: Role[] = ["TECH_SUPPORT"]` with a check on `session.user.role` |
| Expected Result | The scan reports the role check outside `can()`, so the reviewer can reject it (CONTRIBUTING.md). |

**Automated by:** `tests/unit/ai-review.test.ts` › "scans the branch for role checks outside can(), hard deletes and inline …"

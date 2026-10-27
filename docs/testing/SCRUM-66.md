# SCRUM-66 — See only the functions my role allows: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-66.md](../backlog/SCRUM-66.md).
Format and conventions: [README.md](README.md). The navigation is derived from
the permission table in [lib/nav.ts](../../lib/nav.ts), through `roleAllows`
in [lib/auth/can.ts](../../lib/auth/can.ts), so granting a role an action
updates its menu with no second edit (ADR 0004).

Written on 2026-10-12 from the acceptance criteria, then mapped to the tests
that already existed (SCRUM-176). The tests predate the `SCRUM-n [ACx] TC-n-xx`
title format, so each case names them by their current titles.

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. Every seeded account's password is `Password123!`.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-66-01](#tc-66-01) | Positive | AC 1, AC 2, AC 3 | Unit, e2e |
| [TC-66-02](#tc-66-02) | Negative | AC 3 | Unit, e2e |
| [TC-66-03](#tc-66-03) | Negative | AC 4 | e2e |
| [TC-66-04](#tc-66-04) | Positive | AC 5 | Unit |

---

### TC-66-01

| Item | Content |
|---|---|
| Test Case ID | TC-66-01 |
| Test Scenario | [Positive] AC 1, AC 2, AC 3: each role's navigation shows its own work, derived from the permission table |
| Pre-conditions | Signed out. |
| Test Steps | 1. Sign in as each seeded role in turn. <br> 2. Read the navigation and the landing page. |
| Test Data | `organiser@`, `coordinator@`, `venuestaff@`, `techsupport@` and `attendee@test.local` |
| Expected Result | Of the main pages, Organiser: `/events`. Coordinator: `/events`, `/venues`, `/venues/search`, `/bookings/new` and `/venues/availability`. Venue Staff: `/bookings`, `/venues/availability` and `/venues`. Tech Support: `/equipment` and `/venues`. Attendee: `/events` and `/registrations`. No other main page is linked. Every role reaches its notifications from the bell in the header, not the navigation (SCRUM-207, TC-207-15). Each lands on a page in its own navigation, and the header names its role. |

**Automated by:** `tests/unit/nav.test.ts` › "lands every role on a page that is in its own nav", "shows each internal role its own work", "gives every role a human-readable label for the header", "shows a link only to a role that holds the action behind it"; `e2e/access-control.spec.ts` › "SCRUM-65 [AC1, AC3] TC-65-01, SCRUM-66 [AC1, AC2, AC3] TC-66-01: Organiser sees only /events", "SCRUM-65 [AC1, AC3] TC-65-01, SCRUM-66 [AC1, AC2, AC3] TC-66-01: Coordinator sees only /events, /venues, /venues/search, /bookings/new, /venues/availability", "SCRUM-65 [AC1, AC3] TC-65-01, SCRUM-66 [AC1, AC2, AC3] TC-66-01: Venue Staff sees only /bookings, /venues/availability, /venues", "SCRUM-65 [AC1, AC3] TC-65-01, SCRUM-66 [AC1, AC2, AC3] TC-66-01: Tech Support sees only /equipment, /venues" and "SCRUM-65 [AC1, AC3] TC-65-01, SCRUM-66 [AC1, AC2, AC3] TC-66-01: Attendee sees only /events, /registrations"

### TC-66-02

| Item | Content |
|---|---|
| Test Case ID | TC-66-02 |
| Test Scenario | [Negative] AC 3: a role sees no link or control for work that isn't its own |
| Pre-conditions | Signed in as the Organiser, then the Coordinator. |
| Test Steps | 1. As the Organiser, open **Events** and a submitted request. <br> 2. As the Coordinator, open the same request. <br> 3. Compare the Coordinator's and Tech Support's equipment links. |
| Test Data | A submitted request |
| Expected Result | The Organiser has no venue, equipment or booking links and no decision buttons. The Coordinator sees the decision buttons. The Coordinator sees equipment requests but not the equipment pool. |

**Automated by:** `tests/unit/nav.test.ts` › "keeps venue, equipment and booking work out of an organiser's nav", "shows a coordinator equipment requests but not the equipment pool", "shows Technical Support the equipment pool and the requests to review", "gives an attendee only their events and registrations", "never shows a link a role has no action for"; `e2e/access-control.spec.ts` › "SCRUM-66 [AC3] TC-66-02: an organiser sees no coordinator decision controls on /events", "SCRUM-66 [AC3] TC-66-02: a coordinator sees the decision controls on a request under review"

### TC-66-03

| Item | Content |
|---|---|
| Test Case ID | TC-66-03 |
| Test Scenario | [Negative] AC 4: hiding a link isn't the protection; typing its address is refused too |
| Pre-conditions | Signed in as the Organiser. |
| Test Steps | 1. Type another role's page address, such as `/bookings`, into the address bar. |
| Test Data | `/bookings`, `/equipment` |
| Expected Result | The server refuses the page; nothing of it is shown. The enforcement is SCRUM-67's. |

**Automated by:** `e2e/access-control.spec.ts` › "SCRUM-67 — typing another role's URL directly is refused"

### TC-66-04

| Item | Content |
|---|---|
| Test Case ID | TC-66-04 |
| Test Scenario | [Positive] AC 5: granting a role an action updates its navigation with no other change |
| Pre-conditions | A role is granted an action in `ROLE_ACTIONS` (a test change). |
| Test Steps | 1. Read that role's navigation. <br> 2. Take every action away from a role and read its navigation. |
| Test Data | The test change |
| Expected Result | The newly granted page appears in the role's navigation. A role with no links lands on its notifications, which every role holds and reaches from the bell. |

**Automated by:** `tests/unit/nav.test.ts` › "shows a newly granted route to a role that has no label of its own for it", "lands a role with no links on its notifications", "SCRUM-207 TC-207-15: gives every role its notifications from the bell, not from the menu", "lands each role on the first link it is allowed to see"

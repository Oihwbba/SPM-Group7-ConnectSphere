# SCRUM-121 — Accounts can hold multiple roles: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-121.md](../backlog/SCRUM-121.md).
Format and conventions: [README.md](README.md).

An account keeps its primary `role` and may hold more in
`User.additionalRoles`; both travel on the session (ADR 0002). `can()` in
[lib/auth/can.ts](../../lib/auth/can.ts) allows an action when any role held
allows it, checking the relationship as that role (`rolesOf`). The navigation
is `navForRoles` in [lib/nav.ts](../../lib/nav.ts). A venue booking, an
equipment request or a reservation is checked against its event as an
`arrangement`: no one who organises or coordinates that event may decide it.

**Shared pre-conditions for every case:** the database is migrated and
seeded. `multirole@test.local` (`Password123!`) is Venue Staff, with
Technical Support, Coordinator and Organiser as additional roles. Every other
seeded account holds one role.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-121-01](#tc-121-01) | Positive | AC 1 | Unit, integration, e2e |
| [TC-121-02](#tc-121-02) | Positive | AC 2 | Unit, integration, e2e |
| [TC-121-03](#tc-121-03) | Negative | AC 3 | Unit, e2e |
| [TC-121-04](#tc-121-04) | Negative | AC 4 | Unit, integration |
| [TC-121-05](#tc-121-05) | Negative | AC 5 | Unit, integration, e2e |

---

### TC-121-01

| Item | Content |
|---|---|
| Test Case ID | TC-121-01 |
| Test Scenario | [Positive] AC 1: an account holds more than one role, and an account with one role is unchanged |
| Pre-conditions | — |
| Test Steps | 1. Sign in as `multirole@test.local`. <br> 2. Read the top bar, then open the user menu. <br> 3. Sign in as `coordinator@test.local`. |
| Test Data | `multirole@test.local`, `coordinator@test.local` |
| Expected Result | Step 2: the top bar reads "Venue Staff +3"; the menu lists "Venue Staff · Technical Support · Event Coordinator · Event Organiser". Step 3: "Event Coordinator" alone. Every account seeded before this story holds no additional role, and a session token issued before it signs in with none. |

**Automated by:** `tests/unit/auth-config.test.ts` › "SCRUM-121 [AC1] TC-121-01: an account's additional roles are kept on the token and the session", "SCRUM-121 [AC1] TC-121-01: a value that isn't a role is dropped from the additional roles, and a token without them gives none" and "SCRUM-121 [AC1] TC-121-01: a token written before this change, with no additional roles, signs in with none"; `tests/unit/multiple-roles.test.ts` › "SCRUM-121 [AC1] TC-121-01: every role the account holds, the primary one first, each once", "SCRUM-121 [AC1] TC-121-01: the user menu names every role held, the primary first" and "SCRUM-121 [AC1] TC-121-01: the top bar names the primary role and how many more, and a single role alone"; `tests/integration/multiple-roles.test.ts` › "SCRUM-121 [AC1] TC-121-01: an account holds its additional roles, and every existing account starts with none"; `e2e/multiple-roles.spec.ts` › "SCRUM-121 [AC1, AC2] TC-121-01, TC-121-02: the navigation has every role's pages once, and the user menu names every role"

### TC-121-02

| Item | Content |
|---|---|
| Test Case ID | TC-121-02 |
| Test Scenario | [Positive] AC 2: the permissions and the navigation are the union of the roles |
| Pre-conditions | A Planning event `multirole@test.local` coordinates, and one it organises. |
| Test Steps | 1. Sign in as `multirole@test.local`. <br> 2. Read the navigation. <br> 3. Open **Events**, then choose **Event Organiser** under "View events as". <br> 4. Open **Equipment Requests**, then choose **My requests**. <br> 5. A notice goes to every member of Venue Staff, and one to every member of Technical Support; open **Notifications**. |
| Test Data | — |
| Expected Result | Step 1 lands on **Bookings**, the primary role's first page. Step 2: Bookings, Equipment, Equipment Requests, Request Venue, Events and Notifications, each once, with the events page named "Events" as the Coordinator names it, and no Attendee pages. Step 3: the Coordinator view opens first and lists the coordinated event; the Organiser view lists the organised one. Step 4: Technical Support's review queue opens first; **My requests** shows the Coordinator's own requests. Step 5: both notices are listed. A single-role account's permissions and navigation are exactly its role's. |

**Automated by:** `tests/unit/multiple-roles.test.ts` › "SCRUM-121 [AC2] TC-121-02: permissions are the union of the roles", "SCRUM-121 [AC2] TC-121-02: a single role is unchanged: each action is allowed exactly as the role table says", "SCRUM-121 [AC2] TC-121-02: the navigation shows the links of every role held, each page once", "SCRUM-121 [AC2] TC-121-02: a page two roles reach is named as the primary role names it" and "SCRUM-121 [AC2] TC-121-02: with one role, the navigation is exactly that role's"; `tests/integration/multiple-roles.test.ts` › "SCRUM-121 [AC2] TC-121-02: a notice for a role reaches someone who holds it as an additional role, once" and "SCRUM-48 [AC6] TC-48-10, SCRUM-121 [AC2] TC-121-02: an account that is Venue Staff and Technical Support sees the notices of both in one list"; `e2e/multiple-roles.spec.ts` › "SCRUM-121 [AC1, AC2] TC-121-01, TC-121-02: the navigation has every role's pages once, and the user menu names every role" and "SCRUM-121 [AC2, AC3] TC-121-02, TC-121-03: the events page shows the event it coordinates as Coordinator and the event it organises as Organiser" and "SCRUM-121 [AC2] TC-121-02: equipment requests switch between Technical Support's review queue and the Coordinator's own requests"

### TC-121-03

| Item | Content |
|---|---|
| Test Case ID | TC-121-03 |
| Test Scenario | [Negative] AC 3: relationship checks still apply per role |
| Pre-conditions | An account that is a Coordinator and an Organiser; an event assigned to another Coordinator. |
| Test Steps | 1. Edit the event assigned to someone else. <br> 2. Read an event the account organises, and one it coordinates. <br> 3. Confirm the event it only organises. <br> 4. Open `/events?as=ATTENDEE`. |
| Test Data | — |
| Expected Result | Step 1 is refused. Step 2: both can be read, each through its own role. Step 3 is refused: being its Organiser doesn't lend it the Coordinator's actions. Step 4 opens the Coordinator view: only a view of a role held can be asked for. |

**Automated by:** `tests/unit/multiple-roles.test.ts` › "SCRUM-121 [AC3] TC-121-03: relationship checks still apply per role: a Coordinator who also organises can't edit an event assigned to someone else" and "SCRUM-121 [AC3] TC-121-03: each role reaches what its own relationship allows: their own organised event as Organiser, their assigned one as Coordinator"; `e2e/multiple-roles.spec.ts` › "SCRUM-121 [AC2, AC3] TC-121-02, TC-121-03: the events page shows the event it coordinates as Coordinator and the event it organises as Organiser" (step 4)

### TC-121-04

| Item | Content |
|---|---|
| Test Case ID | TC-121-04 |
| Test Scenario | [Negative] AC 4: the Lead can't assign or reassign an event to a Coordinator who is its Organiser |
| Pre-conditions | Signed in as `lead@test.local`. A Submitted request organised by `multirole@test.local`, which is also a Coordinator, and one organised by someone else. A Planning event organised by that account, and one organised by someone else, each with a Coordinator. |
| Test Steps | 1. Open the request it organises in the Unassigned Queue, and assign it to that account. <br> 2. Open the other request, and assign it to that account. <br> 3. Reassign the Planning event it organises to that account (SCRUM-21). <br> 4. Reassign the other one to it. |
| Test Data | — |
| Expected Result | Step 1: the account isn't offered, and assigning it anyway is refused with "The event's own Organiser can't be its Coordinator."; the request stays Submitted with no Coordinator, and nothing is recorded. Step 2: it is offered, as a Coordinator held besides other roles (AC 2), and is assigned. Step 3: refused with the same message; its Coordinator is unchanged and nothing is recorded. Step 4: reassigned to it. |

**Automated by:** `tests/integration/multiple-roles.test.ts` › "SCRUM-121 [AC4] TC-121-04: the Lead isn't offered an account that is the event's Organiser, and can't assign it, even though it also coordinates" and "SCRUM-121 [AC2, AC4] TC-121-02, TC-121-04: for anyone else's request, the account's Coordinator role is offered and can be assigned"; SCRUM-165's `tests/unit/lead-queue.test.ts` › "SCRUM-165 [AC7] TC-165-09: [Negative] the event's own Organiser is never offered, even if they also coordinate" and "SCRUM-165 [AC7] TC-165-09: [Negative] the event's own Organiser can't be its Coordinator".; `tests/integration/multiple-roles.test.ts` › "SCRUM-121 [AC4] TC-121-04: the Lead can't reassign an event to an account that is its Organiser, even though it also coordinates" and "SCRUM-121 [AC2, AC4] TC-121-02, TC-121-04: anyone else's event can be reassigned to the account's Coordinator role" (steps 3 and 4).

### TC-121-05

| Item | Content |
|---|---|
| Test Case ID | TC-121-05 |
| Test Scenario | [Negative] AC 5: no decision on an arrangement for an event you organise or coordinate |
| Pre-conditions | Pending venue bookings for an event `multirole@test.local` coordinates, one it organises, and one it does neither for. An equipment request for an event a Technical Support member organises or coordinates. A safety check awaiting review for an event a Safety Officer coordinates or organises (SCRUM-166). |
| Test Steps | 1. On **Bookings**, approve the booking of the event it coordinates. <br> 2. Reject the one it organises, or hold it. <br> 3. As Technical Support, review or reserve the equipment request. <br> 4. Approve the booking of the event it does neither for. <br> 5. As the Safety Officer, record the check's outcome. |
| Test Data | — |
| Expected Result | Steps 1 to 3: "You do not have permission to do that."; each stays as it was, and nothing is written. Step 4 is approved. Step 5: "Safety check not found." (SCRUM-166 answers a check you may not review as missing), and nothing is written, whichever of the roles is primary. A member of staff with one role decides as before. |

**Automated by:** `tests/unit/multiple-roles.test.ts` › "SCRUM-121 [AC5] TC-121-05: a Venue Staff member can't decide a booking for an event they coordinate or organise", "SCRUM-121 [AC5] TC-121-05: Technical Support can't review or reserve equipment for an event they organise or coordinate" and "SCRUM-121 [AC5] TC-121-05: for anyone else's event they still decide, and a single-role member of staff always does"; `tests/unit/multiple-roles-actions.test.ts` › every "SCRUM-121 [AC5] TC-121-05: …" test; `tests/integration/multiple-roles.test.ts` › "SCRUM-121 [AC5] TC-121-05: a member of Venue Staff who coordinates the event can't decide its booking, and it stays pending with nothing recorded", "SCRUM-121 [AC5] TC-121-05: nor a booking for an event it organises, which stays pending with nothing recorded" and "SCRUM-121 [AC2, AC5] TC-121-05: the same account decides a booking for an event it neither organises nor coordinates"; `e2e/multiple-roles.spec.ts` › "SCRUM-121 [AC5] TC-121-05: approving the venue booking of an event it coordinates is refused, and the request stays pending"; `tests/unit/multiple-roles.test.ts` › "SCRUM-121 [AC5] TC-121-05: a Safety Officer can't review the safety check of an event they coordinate or organise, whichever role is primary" and `tests/unit/multiple-roles-actions.test.ts` › "SCRUM-121 [AC5] TC-121-05: a Safety Officer who coordinates or organises the event can't record its outcome, and nothing is written". SCRUM-166's own rule for a Safety Officer already excludes their own events; checked role by role, it holds with several roles.

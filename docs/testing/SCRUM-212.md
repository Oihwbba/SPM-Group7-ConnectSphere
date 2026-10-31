# SCRUM-212 — Attendee pages show registration state at a glance: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-212.md](../backlog/SCRUM-212.md).
Format and conventions: [README.md](README.md).

**Shared pre-conditions for every case:** the database is migrated and seeded
(`npm run db:deploy && npm run db:seed`), the app is running, and every seeded
account signs in with `Password123!`. `attendee4@test.local` holds no
registrations; `attendee@test.local` holds places at **Confirmed — Charity
Gala**, **Full — Wine Tasting Evening** and **One Place Left — Studio
Masterclass**, and a cancelled one at **Cancelled — Winter Workshop**.

The story is presentation only. The registration rules (SCRUM-73, 74, 75, 77),
the actions, the permissions and the schema are unchanged: each state below
comes from `computeRegistrationState()`, and Withdraw is offered exactly where
`canWithdrawNow()` lets the server accept it.

## The state mapping

Agreed with the Product Owner. One badge and one short line, the same on
**Browse Events** and the event's page (`lib/registration-summary.ts`). The
first row that applies wins.

| When | Badge | Line |
|---|---|---|
| I hold an active registration | **You're registered** | "You can withdraw until the event starts." (once it has started: "The event has started.") |
| `OPEN` | **Open** | "12 places left" ("1 place left") |
| `FULL` | **Full** | "No places left" |
| `NOT_YET_OPEN` | **Not open yet** | "Opens 3 Nov 2026, 9:00 am SGT", through `formatDateTime` (SCRUM-129) |
| `CLOSED` (closed by hand) or `EXPIRED` (closing time or start passed) | **Closed** | "Registration is closed" |
| The event is being re-planned (SCRUM-75 AC9, SCRUM-85) | **Details being updated – registration paused**, unchanged | unchanged |

Withdraw is on the event page and on **My Registrations**, not on the Browse
Events cards, which open the event page. It asks first in the shared
confirmation dialog (SCRUM-207 AC5): **Withdraw** (red) or **Keep my place**.
A venue with no approved booking reads "Venue to be confirmed" on all three
pages, except that a cancelled event on **My Registrations** shows the venues
it was last confirmed with (SCRUM-252 AC1). The registration period and "x of y places remaining" stay on each
event as SCRUM-72 AC3 requires.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-212-01](#tc-212-01) | Positive, Boundary | AC 1 | Unit |
| [TC-212-02](#tc-212-02) | Positive, Boundary | AC 1 | Unit |
| [TC-212-03](#tc-212-03) | Boundary | AC 1 | Unit |
| [TC-212-04](#tc-212-04) | Positive, Boundary | AC 1 | Unit |
| [TC-212-05](#tc-212-05) | Positive, Boundary | AC 1 | Unit |
| [TC-212-06](#tc-212-06) | Positive | AC 1 | e2e |
| [TC-212-07](#tc-212-07) | Positive | AC 1 | e2e |
| [TC-212-08](#tc-212-08) | Positive | AC 2 | Unit, e2e |
| [TC-212-09](#tc-212-09) | Positive | AC 1, AC 2 | e2e |
| [TC-212-10](#tc-212-10) | Positive, Negative, Boundary | AC 2 | Unit |
| [TC-212-11](#tc-212-11) | Positive | AC 2 | Unit, e2e |
| [TC-212-12](#tc-212-12) | Positive | AC 3 | e2e |

---

### TC-212-01

| Item | Content |
|---|---|
| Test Case ID | TC-212-01 |
| Test Scenario | [Positive, Boundary] AC 1: my own registration is shown first, however the event stands |
| Pre-conditions | An event with registration open, one that is full, and one closed by its Organiser; I hold an active registration for each. |
| Test Steps | 1. Read each event's badge and line. <br> 2. Repeat with the event's start 1 ms ahead, and exactly now. |
| Test Data | 20 places; 8 or 20 taken |
| Expected Result | Each reads **You're registered**, "You can withdraw until the event starts."; at the start itself, "The event has started." |

**Automated by:** `tests/unit/registration-summary.test.ts` › "SCRUM-212 [AC1] TC-212-01: my own registration comes first, however the event stands" and "SCRUM-212 [AC1] TC-212-01: [Boundary] a registered Attendee is told they can withdraw until the start, and not at it"

### TC-212-02

| Item | Content |
|---|---|
| Test Case ID | TC-212-02 |
| Test Scenario | [Positive, Boundary] AC 1: an open event shows how many places are left |
| Pre-conditions | Registration is open; I'm not registered. |
| Test Steps | 1. Read the badge and line with 8 of 20 places taken. <br> 2. Repeat with 19 of 20 taken. |
| Test Data | 20 places |
| Expected Result | **Open**, "12 places left"; with one left, **Open**, "1 place left". |

**Automated by:** `tests/unit/registration-summary.test.ts` › "SCRUM-212 [AC1] TC-212-02: an open event says Open and how many places are left" and "SCRUM-212 [AC1] TC-212-02: [Boundary] one place left is still Open, in the singular"

### TC-212-03

| Item | Content |
|---|---|
| Test Case ID | TC-212-03 |
| Test Scenario | [Boundary] AC 1: with no places left the event is shown as full |
| Pre-conditions | Registration is open; every place is taken; I'm not registered. |
| Test Steps | 1. Read the badge and line. |
| Test Data | 20 of 20 places taken |
| Expected Result | **Full**, "No places left". |

**Automated by:** `tests/unit/registration-summary.test.ts` › "SCRUM-212 [AC1] TC-212-03: [Boundary] with no places left the event is Full"

### TC-212-04

| Item | Content |
|---|---|
| Test Case ID | TC-212-04 |
| Test Scenario | [Positive, Boundary] AC 1: before registration opens, the event says when it opens |
| Pre-conditions | The event's registration opens at 3 Nov 2026, 9:00 am SGT; I'm not registered. |
| Test Steps | 1. Read the badge and line before the opening time. <br> 2. Repeat with the opening time exactly now, and 1 ms ahead. |
| Test Data | `registrationOpensAt` 2026-11-03T01:00:00Z |
| Expected Result | **Not open yet**, "Opens 3 Nov 2026, 9:00 am SGT". At the opening instant it reads **Open**; 1 ms before, **Not open yet**. |

**Automated by:** `tests/unit/registration-summary.test.ts` › "SCRUM-212 [AC1] TC-212-04: before registration opens, the event says Not open yet and when it opens, in Singapore time" and "SCRUM-212 [AC1] TC-212-04: [Boundary] registration is open from its opening instant, and not open 1 ms before"

### TC-212-05

| Item | Content |
|---|---|
| Test Case ID | TC-212-05 |
| Test Scenario | [Positive, Boundary] AC 1: closed registration reads Closed, whether closed by hand or by time |
| Pre-conditions | I'm not registered. |
| Test Steps | 1. Read an event whose Organiser closed registration. <br> 2. Read an event whose closing time is exactly now, then 1 ms ahead. |
| Test Data | `registrationEnabled` false; `registrationClosesAt` now / now + 1 ms |
| Expected Result | Closed by hand and at the closing instant: **Closed**, "Registration is closed". 1 ms before closing: **Open**. |

**Automated by:** `tests/unit/registration-summary.test.ts` › "SCRUM-212 [AC1] TC-212-05: registration closed by the Organiser reads Closed" and "SCRUM-212 [AC1] TC-212-05: [Boundary] a passed closing time reads Closed from the closing instant, and Open 1 ms before"

### TC-212-06

| Item | Content |
|---|---|
| Test Case ID | TC-212-06 |
| Test Scenario | [Positive] AC 1: Browse Events shows each event's one state, and the event's page says the same |
| Pre-conditions | Signed in as an Attendee with no registrations. |
| Test Steps | 1. Open **Browse Events**. <br> 2. Read the card of each seeded event below. <br> 3. Open each and read the badge and line on its page. |
| Test Data | `attendee4@test.local`; Confirmed — Charity Gala; One Place Left — Studio Masterclass; Full — Wine Tasting Evening; Registration Not Yet Open — Summer Camp; Registration Closed — Leadership Retreat |
| Expected Result | Card and page agree: **Open** "118 places left"; **Open** "1 place left"; **Full** "No places left"; **Not open yet** "Opens <date>, <time> SGT"; **Closed** "Registration is closed". |

**Automated by:** `e2e/registration-at-a-glance.spec.ts` › "SCRUM-212 [AC1] TC-212-06: Browse Events shows open with places left, full, not open yet and closed, and the event page says the same"

### TC-212-07

| Item | Content |
|---|---|
| Test Case ID | TC-212-07 |
| Test Scenario | [Positive] AC 1: an event I'm registered for shows You're registered, even when it is full, with Withdraw on its page |
| Pre-conditions | Signed in as an Attendee registered for the gala and the full Wine Tasting, not for the Leadership Retreat. |
| Test Steps | 1. Open **Browse Events** and read the three cards. <br> 2. Open the Wine Tasting. |
| Test Data | `attendee@test.local` |
| Expected Result | The gala and the Wine Tasting read **You're registered**, "You can withdraw until the event starts."; the Retreat reads **Closed**. The Wine Tasting's page says the same, offers **Withdraw** and no **Register**. |

**Automated by:** `e2e/registration-at-a-glance.spec.ts` › "SCRUM-212 [AC1] TC-212-07: my own registration comes first, as You're registered, even for a full event, with Withdraw on the event page"

### TC-212-08

| Item | Content |
|---|---|
| Test Case ID | TC-212-08 |
| Test Scenario | [Positive] AC 2: My Registrations shows the event, its date and time, its venue, my status and a link to the event |
| Pre-conditions | Signed in as an Attendee with an active registration and one for a cancelled event. |
| Test Steps | 1. Open **My Registrations**. <br> 2. Read the gala's row and the cancelled event's row. <br> 3. Choose **View event** on the gala's row. |
| Test Data | `attendee@test.local` |
| Expected Result | The gala's row shows its name, "<date>, <start> SGT – <end> SGT", its venue, **Registered** and **Withdraw**. The cancelled event's row shows **Cancelled**, with no Withdraw and no link. **View event** opens the gala's page. A row with no approved venue reads "Venue to be confirmed"; Withdrawn and Cancelled read as such. |

**Automated by:** `tests/unit/registrations-list.test.tsx` › "SCRUM-212 [AC2] TC-212-08: a row shows the event, its date and time, its venue, my status and a link to the event", "SCRUM-212 [AC2] TC-212-08: with no approved venue, the venue reads Venue to be confirmed", "SCRUM-212 [AC2] TC-212-08: my status reads %s" and "SCRUM-212 [AC2] TC-212-08: an event no longer open to Attendees has no link to it"; `e2e/registration-at-a-glance.spec.ts` › "SCRUM-212 [AC2] TC-212-08: each row shows the event, its date and time, its venue, my status and a link to the event"

### TC-212-09

| Item | Content |
|---|---|
| Test Case ID | TC-212-09 |
| Test Scenario | [Positive] AC 1, AC 2: Withdraw asks first; Keep my place changes nothing, and Withdraw withdraws |
| Pre-conditions | Signed in as an Attendee with an active registration for a Confirmed event 10 days away, 5 places, no approved venue (created by the test, local database only). |
| Test Steps | 1. On **My Registrations**, choose **Withdraw**, then **Keep my place**. <br> 2. Choose **Withdraw** again, then **Withdraw** in the dialog. <br> 3. With a fresh registration, do the same from the event's page. |
| Test Data | `attendee2@test.local` |
| Expected Result | The dialog asks "Withdraw from this event?" naming the event. **Keep my place** closes it; the row still reads **Registered** and the registration is still REGISTERED. **Withdraw** turns the row to **Withdrawn**, with no Withdraw button, and the registration is WITHDRAWN. On the event page, **You're registered** becomes **Open**, "5 places left", with **Register** enabled. |

**Automated by:** `e2e/registration-at-a-glance.spec.ts` › "SCRUM-212 [AC2] TC-212-09, SCRUM-207 [AC5] TC-207-10: on My Registrations, Keep my place changes nothing, and Withdraw withdraws" and "SCRUM-212 [AC1, AC2] TC-212-09, SCRUM-207 [AC5] TC-207-10: on the event page, withdrawing turns You're registered back into Open with the place given back". The dialog itself: `tests/unit/confirm-dialog.test.tsx` (SCRUM-207 TC-207-10).

### TC-212-10

| Item | Content |
|---|---|
| Test Case ID | TC-212-10 |
| Test Scenario | [Positive, Negative, Boundary] AC 2: Withdraw is offered only where the server allows it |
| Pre-conditions | Registrations in each state below. |
| Test Steps | 1. Render **My Registrations** for each. |
| Test Data | Registered for an event starting tomorrow, and one being re-planned; Withdrawn; Cancelled; Registered for a cancelled event; for an event that started; start 1 ms ahead and exactly now |
| Expected Result | Withdraw for an active registration whose event is still to start, including one being re-planned and 1 ms before the start. No Withdraw when Withdrawn, Cancelled, the event is cancelled, or at or after the start. |

**Automated by:** `tests/unit/registration-summary.test.ts` › "SCRUM-212 [AC2] TC-212-10: an active registration for an event still to start can be withdrawn, even while it is re-planned", "SCRUM-212 [AC2] TC-212-10: [Negative] a withdrawn or cancelled registration, or one for a cancelled event, can't be withdrawn" and "SCRUM-212 [AC2] TC-212-10: [Boundary] Withdraw is offered until the event's start, and not at it"; `tests/unit/registrations-list.test.tsx` › "SCRUM-212 [AC2] TC-212-10: Withdraw is offered for an active registration whose event is still to start" and "SCRUM-212 [AC2] TC-212-10: [Negative] Withdraw isn't offered when the registration %s"

### TC-212-11

| Item | Content |
|---|---|
| Test Case ID | TC-212-11 |
| Test Scenario | [Positive] AC 2: with no registrations, My Registrations says so and links to Browse Events |
| Pre-conditions | Signed in as an Attendee with no registrations. |
| Test Steps | 1. Open **My Registrations**. <br> 2. Choose **Browse Events** in the empty state. |
| Test Data | `attendee4@test.local` |
| Expected Result | "You haven't registered for any events yet", no rows, and **Browse Events** opens the browse list. |

**Automated by:** `tests/unit/registrations-list.test.tsx` › "SCRUM-212 [AC2] TC-212-11: with no registrations, the list says so and links to Browse Events"; `e2e/registration-at-a-glance.spec.ts` › "SCRUM-212 [AC2] TC-212-11: an Attendee with no registrations is told so, with a link to Browse Events"

### TC-212-12

| Item | Content |
|---|---|
| Test Case ID | TC-212-12 |
| Test Scenario | [Positive] AC 3: the three pages work on a phone |
| Pre-conditions | Signed in as an Attendee with registrations, in a window 360 px wide. |
| Test Steps | 1. Open **Browse Events**. <br> 2. Open the gala, choose **Withdraw**, then **Keep my place**. <br> 3. Open **My Registrations**. |
| Test Data | `attendee@test.local`, 360 × 740 px |
| Expected Result | No page scrolls sideways. The gala's badge and line show on its card and its page without opening anything else. Withdraw, View event and both dialog buttons are at least 44 px tall, and the dialog fits the screen. Keep my place writes nothing. |

**Automated by:** `e2e/registration-at-a-glance.spec.ts` › "SCRUM-212 [AC3] TC-212-12: at 360 px, Browse Events, the event page and My Registrations don't scroll sideways, show the state without opening anything, and have easy-to-tap buttons". SCRUM-132's `e2e/phone-and-speed.spec.ts` also checks Browse Events and My Registrations at 360 px.

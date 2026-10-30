# SCRUM-248 — Attendees see a "My work" menu heading, and the event progress steps overlap on a phone: test cases

SCRUM-248 is a Bug task in Jira, raised on 30 Oct from a code and UI review
of the Event Request Lifecycle and Attendee Registration epics. Its
acceptance criteria are in [docs/backlog/SCRUM-248.md](../backlog/SCRUM-248.md).

Format and conventions: [README.md](README.md).

**Why it failed:** SCRUM-210 put an Attendee's Browse Events and My
Registrations in the "work" group, headed "My work", so their menu read as a
staff menu, and on a phone the bar showed one briefcase. The progress steps
were one row of labelled steps that can't fit 328 px: the labels overflowed
their share of the row into each other and under the lines.

**The fix:** in `lib/nav.ts` an Attendee's links are their own "attending"
group, which has no heading, and the sidebar shows each link of a headless
group on its own. A user whose other roles have work of their own keeps
these links in My work, so every staff menu, alone or combined with the
Attendee role, is exactly as before. Checked across every combination of
roles against `main`'s `lib/nav.ts`: only the Attendee-only menu changed.
Below `md`, `event-progress.tsx` puts each label (11 px) under its dot and
draws the line between the dots, above the labels; from `md` up, the row is
unchanged.

**Shared pre-conditions:** the seeded database (`prisma/seed.ts`); every
account's password is `Password123!`. Nothing is written.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-248-01](#tc-248-01) | Positive | AC 1 | Unit, E2E |
| [TC-248-02](#tc-248-02) | Negative | AC 1 | Unit, E2E (SCRUM-210's) |
| [TC-248-03](#tc-248-03) | Boundary | AC 2 | E2E |

---

### TC-248-01

| Item | Content |
|---|---|
| Test Case ID | TC-248-01 |
| Test Scenario | [Positive] AC 1: an Attendee's menu has no "My work" heading; Browse Events and My Registrations show as their own links, including on the phone bar |
| Pre-conditions | Signed in as `attendee@test.local` |
| Test Steps | 1. Sign in on a desktop screen and read the menu. <br> 2. Sign in at 360 × 740 and read the bar. <br> 3. Choose My Registrations. |
| Test Data | — |
| Expected Result | Steps 1 and 2: Browse Events (current) and My Registrations are links of their own; there is no My work button and no group. The Attendee still lands on Browse Events. Step 3 opens My Registrations. |

**Automated by:** `tests/unit/nav-groups.test.ts` › "SCRUM-248 [AC1] TC-248-01: an Attendee's two links have no heading, each shown on its own, and nothing is headed My work"; `e2e/attendee-menu-and-progress.spec.ts` › "SCRUM-248 [AC1] TC-248-01: on the rail, an Attendee sees Browse Events and My Registrations as their own links, with no My work", "… on the phone's bar, …"; `e2e/menu-groups.spec.ts` › "SCRUM-210 [AC1, AC3, AC4] TC-210-01, TC-210-06, TC-210-08: Attendee lands on its own list, with its menu grouped by task", updated to the two single links

### TC-248-02

| Item | Content |
|---|---|
| Test Case ID | TC-248-02 |
| Test Scenario | [Negative] AC 1: staff menus are unchanged, also for a user who holds a staff role as well as Attendee |
| Pre-conditions | None (the menu is built from the permission table) |
| Test Steps | 1. Build the menu for each staff role alone. <br> 2. Build it for Coordinator + Attendee, Attendee + Safety Officer, and Organiser + Attendee. |
| Test Data | — |
| Expected Result | Step 1: as SCRUM-210's TC-210-01 expects, unchanged. Step 2: Coordinator + Attendee has My work: Events, My Registrations; Attendee + Safety Officer has My work: Browse Events, Safety Checks, My Registrations; Organiser + Attendee has My work: My Events, My Registrations; each the same as before SCRUM-248. |

**Automated by:** `tests/unit/nav-groups.test.ts` › "SCRUM-248 [AC1] TC-248-02: %j keeps the staff menu, with the Attendee's links in My work as before", and SCRUM-210's "TC-210-01: %s sees its links grouped by task, in order", whose staff rows are unchanged; `e2e/menu-groups.spec.ts` › SCRUM-210's TC-210-01 for every staff role and the several-role user

### TC-248-03

| Item | Content |
|---|---|
| Test Case ID | TC-248-03 |
| Test Scenario | [Boundary] AC 2: at 360 px wide, every step on the event progress is readable and no line crosses a label, at every status |
| Pre-conditions | Signed in as `organiser@test.local` at 360 × 740 |
| Test Steps | 1. Open each seeded event below and read its progress. |
| Test Data | `evt_clarification_fields` (Under Review), `evt_rejected` (Rejected), `evt_replanning` (Planning), `evt_cancellation_requested` (Confirmed), `evt_completed` (Completed), `evt_cancelled` (Cancelled) |
| Expected Result | Five labels, each visible and wholly inside the list; no two labels overlap; none of the four lines overlaps a label; the current step reads as its status (Review, Rejected, Planning, Confirmed, Cancelled); neither the list nor the page scrolls sideways. Run against `main`'s progress, the test fails: "UNDER_REVIEW: a line crosses label 1". |

**Automated by:** `e2e/attendee-menu-and-progress.spec.ts` › "SCRUM-248 [AC2] TC-248-03: at 360 px every progress step is readable and no line crosses a label, at every status"

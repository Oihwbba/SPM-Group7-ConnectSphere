# SCRUM-210 — Menus grouped by task: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-210.md](../backlog/SCRUM-210.md).
Format and conventions: [README.md](README.md).

**Shared pre-conditions for every case:** the database is migrated and seeded
(`npm run db:deploy && npm run db:seed`), the app is running, and every seeded
account signs in with `Password123!`.

**How the menu is built.** `lib/nav.ts` binds each page to the one action it
needs in the permission table (`lib/auth/can.ts`, SCRUM-66) and to a task:
**My work** (the role's own lists), **Venues**, **Equipment** and
**Planning**, in that order. A role sees a link only if it holds its action,
and only the groups it has links in. A group with one link shows just that
link, with no heading. Equipment Requests is in My work for a role that also
reviews them (Technical Support), and under Equipment otherwise. Notifications
is not in the menu: it is reached from the bell (SCRUM-207 AC6). Jira's AC1
was updated on 26 Oct 2026 to drop Notifications from its example; the
backlog snapshot predates that.

Expanded, the rail shows each heading above its links; collapsed, its icons
with a thin line between groups; on a phone, one bar with every link in the
same order.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-210-01](#tc-210-01) | Positive | AC 1 | Unit, e2e |
| [TC-210-02](#tc-210-02) | Boundary | AC 1 | Unit |
| [TC-210-03](#tc-210-03) | Negative | AC 1 | Unit, e2e |
| [TC-210-04](#tc-210-04) | Positive | AC 2 | Unit |
| [TC-210-05](#tc-210-05) | Boundary | AC 2 | Unit |
| [TC-210-06](#tc-210-06) | Positive | AC 3 | Unit, e2e |
| [TC-210-07](#tc-210-07) | Positive | AC 4 | Unit |
| [TC-210-08](#tc-210-08) | Positive | AC 3, AC 4 | Unit, e2e |
| [TC-210-09](#tc-210-09) | Positive | AC 1 | e2e |

## TC-210-01

**Each role's menu is grouped by task.**

1. Sign in as each role in turn and look at the side menu.

**Expected:** (headings in bold; a link without one stands alone)

| Role | Menu |
|---|---|
| Organiser | My Events |
| Coordinator | Events · **Venues**: Venue Search, Request Venue, Availability, Venue Catalogue · Equipment Requests · All Events |
| Event Coordinator Lead | Unassigned Queue · Venue Catalogue · All Events |
| Venue Staff | Bookings · **Venues**: Availability, Venue Catalogue · All Events |
| Technical Support | **My work**: Equipment, Equipment Requests · Venue Catalogue · All Events |
| Safety Officer | Safety Checks · Venue Catalogue |
| Attendee | **My work**: Browse Events, My Registrations |

Every link keeps the address it had. The catalogue link reads "Venue
Catalogue", as its page does.

*Automated:* `tests/unit/nav-groups.test.ts` every "SCRUM-210 [AC1] TC-210-01" test;
`e2e/menu-groups.spec.ts` every "SCRUM-210 [AC1, AC3, AC4] TC-210-01, TC-210-06, TC-210-08" test.

## TC-210-02

**Boundary — a group with one link has no heading.**

**Expected:** for every role, a group has a heading exactly when it has more
than one link.

*Automated:* `tests/unit/nav-groups.test.ts` "SCRUM-210 [AC1] TC-210-02".

## TC-210-03

**Negative — Notifications is in no menu.**

**Expected:** no role's menu, alone or combined with every other role, links
to `/notifications`; the bell does.

*Automated:* `tests/unit/nav-groups.test.ts` "SCRUM-210 [AC1] TC-210-03";
`e2e/menu-groups.spec.ts` every "SCRUM-210 [AC1, AC3, AC4] TC-210-01, TC-210-06, TC-210-08" test.

## TC-210-04

**Removing a permission removes its link, and nothing else is edited.**

1. Take the Coordinator's `venue:availability` away in the permission table.

**Expected:** Availability leaves the Venues group; the group keeps Venue
Search, Request Venue and Venue Catalogue.

*Automated:* `tests/unit/nav-groups.test.ts` "SCRUM-210 [AC2] TC-210-04".

## TC-210-05

**Boundary — a group left empty disappears; one left with a single link loses its heading.**

1. Take Venue Staff's `venue:availability` and `venue:read` away.
2. Separately, take only `venue:availability` away.
3. Separately, take Technical Support's `equipment-request:review` away.

**Expected:** 1: no Venues group (Bookings and All Events only). 2: Venue
Catalogue alone, without the Venues heading. 3: Equipment Requests moves out
of My work to its own Equipment group.

*Automated:* `tests/unit/nav-groups.test.ts` both "SCRUM-210 [AC2] TC-210-05" tests.

## TC-210-06

**Every role lands on the same page as before.**

1. Sign in as each role.

**Expected:** Organiser `/events` (My Events), Coordinator `/events` (Events),
Event Coordinator Lead `/queue`, Venue Staff `/bookings`, Technical Support
`/equipment` (not Equipment Requests), Safety Officer `/safety-checks`,
Attendee `/events` (Browse Events): each the first link of its My work.

*Automated:* `tests/unit/nav-groups.test.ts` every "SCRUM-210 [AC3] TC-210-06" test;
`e2e/menu-groups.spec.ts` every "SCRUM-210 [AC1, AC3, AC4] TC-210-01, TC-210-06, TC-210-08" test.

## TC-210-07

**A Coordinator who is also Venue Staff sees each group once.**

**Expected:** My work: Events, Bookings; Venues: Venue Search, Request Venue,
Availability, Venue Catalogue (once); Equipment Requests; All Events. No link
appears twice.

*Automated:* `tests/unit/nav-groups.test.ts` "SCRUM-210 [AC4] TC-210-07".

## TC-210-08

**The seeded several-role user.**

1. Sign in as `multirole@test.local` (Venue Staff, then Technical Support,
   Coordinator and Organiser).

**Expected:** lands on `/bookings`, Venue Staff's page, as before (the app
root sends a user where their primary role lands). Menu: My work: Events,
Bookings, Equipment, Equipment Requests; Venues: Venue Search, Request Venue,
Availability, Venue Catalogue; All Events.

*Automated:* `tests/unit/nav-groups.test.ts` "SCRUM-210 [AC4] TC-210-08";
`e2e/menu-groups.spec.ts` "SCRUM-210 [AC1, AC3, AC4] TC-210-01, TC-210-06, TC-210-08" for "Several roles".

## TC-210-09

**The grouped menu works collapsed, expanded and on a phone (SCRUM-132).**

1. As the Coordinator, look at the rail collapsed, then select **Expand
   navigation**.
2. At 360 px wide, look at the bottom bar.

**Expected:** collapsed, the links show as icons, in the same order, with no
heading text; expanded, "Venues" heads its four links. On a phone every link
is in the bar, in the same order, without headings, and the page doesn't
scroll sideways.

*Automated:* `e2e/menu-groups.spec.ts` both "SCRUM-210 [AC1] TC-210-09" tests.

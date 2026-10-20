<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-20. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-191 - Bug: Integration suites race each other through shared data, and the docs still describe the Safety Officer as unbuilt

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-191 |

---

Vitest runs test files in parallel, and several integration suites race each other through shared data. Every test passes, but a suite fails at random: in about half of local runs while working on #220, and on CI for #214.

**1. Accounts made mid-run.** A notice to everyone with a role (SCRUM-124, SCRUM-166) reaches any account of that role that exists at that moment, so a suite that creates and deletes such an account races other suites: deleting it fails on another suite's notice, or the suite deletes notices other suites count. SCRUM-20's race test made two throwaway Coordinators (removed on main when SCRUM-165 replaced automatic assignment); SCRUM-165's race test makes a second Lead; SCRUM-166's suite makes a second Safety Officer; SCRUM-172's TC-172-18 makes a Venue Staff hold approver. The same pattern was removed for Venue Staff in SCRUM-124 by seeding `venuestaff2@test.local`.

**2. SCRUM-50's TC-50-09** (`tests/integration/bookings.test.ts`) lists the events offered to a Coordinator, then re-reads them; an event another suite confirms in between fails it (the #214 CI run).

**3. Docs.** SCRUM-164, SCRUM-165 and SCRUM-166 have merged, but README.md, `docs/data-model.md` and `docs/product-context.md` still describe the Lead and the Safety Officer as unbuilt.

**Acceptance criteria**

1. No suite's cleanup can fail because another suite's notices reached an account it made: SCRUM-165's race test uses a seeded second Lead (`lead2@test.local`), and an account a test deletes on purpose (SCRUM-172's hold approver) holds no role that other suites notify.
2. A second Safety Officer (`safety2@test.local`) is seeded, and SCRUM-166's suite uses it without creating or deleting an account, clearing only the notices about its own events.
3. README.md, `docs/data-model.md` and `docs/product-context.md` describe the Safety Officer (SCRUM-166) and the Lead (SCRUM-165, SCRUM-141; reassignment is SCRUM-21) as built, and list the seeded accounts.
4. The whole Vitest suite with coverage passes repeatedly against the local database.
5. TC-50-09 judges only rows no other suite changed after the list was read, still checks both of its own events, and still fails if Confirmed events are offered.

Test cases: docs/testing/SCRUM-191.md. Found while verifying #220 (SCRUM-121) and #221 (SCRUM-41). Related: SCRUM-20, SCRUM-50, SCRUM-124, SCRUM-165, SCRUM-166, SCRUM-171, SCRUM-172.

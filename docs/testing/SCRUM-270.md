# SCRUM-270 — Automate TC-132-09's confirmation audit: test cases

SCRUM-270 is a Chore task in Jira. Its acceptance criteria are in
[docs/backlog/SCRUM-270.md](../backlog/SCRUM-270.md) once the backlog is next
synced; until then, in [Jira](https://smu-spm-group7.atlassian.net/browse/SCRUM-270).

Format and conventions: [README.md](README.md).

**What the test reads:** `tests/action-confirmations.ts` parses every
`"use client"` component under `app/` and `components/` with the TypeScript
compiler. It finds each action imported from a `"use server"` module, follows
each call to the function that handles its reply, and checks that function's
code. It proves the handler shows a confirmation and the refusal's message,
not that the page renders them. Each story's own e2e tests do that, as
TC-132-09 always relied on.

**Shared pre-conditions:** none. The unit cases read the source and don't
need a database.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-270-01](#tc-270-01) | Negative | AC 1 | Unit |
| [TC-270-02](#tc-270-02) | Positive | AC 2 | Unit |
| [TC-270-03](#tc-270-03) | Positive | AC 3 | Unit |
| [TC-270-04](#tc-270-04) | Positive | AC 3 | Unit |
| [TC-270-05](#tc-270-05) | Negative | AC 2, AC 3 | Unit |
| [TC-270-06](#tc-270-06) | Negative | AC 4 | Unit |
| [TC-270-07](#tc-270-07) | Negative | AC 4 | Unit |
| [TC-270-08](#tc-270-08) | Negative | AC 1, AC 4 | Unit |
| [TC-270-09](#tc-270-09) | Boundary | AC 3 | Unit |
| [TC-270-10](#tc-270-10) | Positive | AC 1 | Unit |
| [TC-270-11](#tc-270-11) | Positive | AC 5 | Manual (review) |

---

### TC-270-01

| Item | Content |
|---|---|
| Test Case ID | TC-270-01 |
| Test Scenario | [Negative] AC 1: an action a client component imports that isn't listed as changing data or not fails the audit |
| Pre-conditions | — |
| Test Steps | 1. List every action a client component imports. <br> 2. Compare it with the test's two lists. |
| Test Data | `CHANGES_DATA` and `CHANGES_NO_DATA` in the test |
| Expected Result | Every imported action is in exactly one list, and every listed action is still imported. |

**Automated by:** `tests/unit/action-confirmations.test.ts` › "SCRUM-270 [AC1] TC-270-01: every action a client component imports is listed as changing data or not, and every listed action is imported"

### TC-270-02

| Item | Content |
|---|---|
| Test Case ID | TC-270-02 |
| Test Scenario | [Positive] AC 2: every call of an action that changes data confirms success |
| Pre-conditions | — |
| Test Steps | 1. Find every call of an action in `CHANGES_DATA`. <br> 2. Read the function that handles its reply. |
| Test Data | The exception: `markNotificationRead`, whose list or page is the confirmation |
| Expected Result | Every action in `CHANGES_DATA` is called, and each handler calls `toast.success` or `toast.info`, or renders a `role="status"` message. |

**Automated by:** `tests/unit/action-confirmations.test.ts` › "SCRUM-270 [AC2] TC-270-02: every call of an action that changes data confirms success"

### TC-270-03

| Item | Content |
|---|---|
| Test Case ID | TC-270-03 |
| Test Scenario | [Positive] AC 3: every call of an action that changes data shows a refusal's message |
| Pre-conditions | — |
| Test Steps | 1. For each call in TC-270-02, read its handler. |
| Test Data | — |
| Expected Result | The handler keeps the reply and reads its `error`, or passes the reply whole to code that does (`showSaveReply(reply, …)`, `return result` to `ConfirmDialog`). |

**Automated by:** `tests/unit/action-confirmations.test.ts` › "SCRUM-270 [AC3] TC-270-03: every call of an action that changes data shows a refusal's message"

### TC-270-04

| Item | Content |
|---|---|
| Test Case ID | TC-270-04 |
| Test Scenario | [Positive] AC 3: where an action can refuse with field errors, its caller reads them |
| Pre-conditions | — |
| Test Steps | 1. For each call in TC-270-02, check whether the action can return `fieldErrors` (TC-270-09). <br> 2. If it can, read its handler. |
| Test Data | The exceptions, each named in `FIELD_ERRORS_NOT_READ` with its reason: `markNotificationRead`, `registerForEvent`, `closeRegistration` and `reopenRegistration` (an id the user doesn't type); `assignCoordinator` and `reassignCoordinator` (a choice the button can't send empty); `recordSuitabilityJudgement` and `addOperationalNote` (the one error line sits under the only text box) |
| Expected Result | The handler reads the reply's `fieldErrors`, or passes the reply whole to code that does. |

**Automated by:** `tests/unit/action-confirmations.test.ts` › "SCRUM-270 [AC3] TC-270-04: where an action can refuse with field errors, its caller reads them"

### TC-270-05

| Item | Content |
|---|---|
| Test Case ID | TC-270-05 |
| Test Scenario | [Negative] AC 2, AC 3: an exception that is no longer needed fails the audit |
| Pre-conditions | — |
| Test Steps | 1. For each action in `NO_CONFIRMATION` and `FIELD_ERRORS_NOT_READ`, find its calls. |
| Test Data | — |
| Expected Result | Each is still called, and at least one call still lacks what its exception excuses. For `FIELD_ERRORS_NOT_READ`, the action can still return `fieldErrors`. |

**Automated by:** `tests/unit/action-confirmations.test.ts` › "SCRUM-270 [AC2, AC3] TC-270-05: each exception is still needed"

### TC-270-06

| Item | Content |
|---|---|
| Test Case ID | TC-270-06 |
| Test Scenario | [Negative] AC 4: a handler with no success toast or status fails |
| Pre-conditions | — |
| Test Steps | 1. Check a handler that toasts success. <br> 2. Remove the toast. <br> 3. Use `toast.info` instead. <br> 4. Put the toast in another function of the same file. |
| Test Data | Fixture components in the test |
| Expected Result | 1. Passes. 2. Fails. 3. Passes. 4. Fails. |

**Automated by:** `tests/unit/action-confirmations.test.ts` › "SCRUM-270 [AC4] TC-270-06: a handler with no success toast or status fails, and one with either passes"

### TC-270-07

| Item | Content |
|---|---|
| Test Case ID | TC-270-07 |
| Test Scenario | [Negative] AC 4: a handler that drops the refusal's message or its field errors fails |
| Pre-conditions | — |
| Test Steps | 1. Check a handler that reads `fieldErrors` and toasts `result.error`. <br> 2. Remove the `fieldErrors` line. <br> 3. Also toast a fixed text instead of `result.error`. <br> 4. Check a reply that is never kept, then one passed to `showSaveReply` and one returned. |
| Test Data | Fixture components in the test |
| Expected Result | 1. Both checks pass. 2. The field-errors check fails. 3. The refusal check fails too. 4. The reply that isn't kept fails; the reply passed on and the reply returned pass both. |

**Automated by:** `tests/unit/action-confirmations.test.ts` › "SCRUM-270 [AC4] TC-270-07: a handler that drops the refusal's message or its field errors fails" and "SCRUM-270 [AC4] TC-270-07: a reply handed on whole counts as shown"

### TC-270-08

| Item | Content |
|---|---|
| Test Case ID | TC-270-08 |
| Test Scenario | [Negative] AC 1, AC 4: an action called indirectly is followed to its handler, and one sent with no handler fails |
| Pre-conditions | — |
| Test Steps | 1. Call the action inside `sendRequest(() => …)`. <br> 2. Pass it to a function in the same file. <br> 3. Keep it in a table read by a handler. <br> 4. Send it as `<form action={…}>`. |
| Test Data | Fixture components in the test, modelled on `create-event-dialog`, `registration-control` and `readiness-checklist` |
| Expected Result | 1–3. The reply is followed into `result` and the handler's toast is found. 4. It has no handler, and both checks fail. |

**Automated by:** `tests/unit/action-confirmations.test.ts` › "SCRUM-270 [AC1, AC4] TC-270-08: an action called through a wrapper, a local function or a table is traced to its handler, and one sent with no handler fails"

### TC-270-09

| Item | Content |
|---|---|
| Test Case ID | TC-270-09 |
| Test Scenario | [Boundary] AC 3: an action can refuse with field errors when it, or a function of its own module it calls, passes them to `err` |
| Pre-conditions | — |
| Test Steps | 1. Read four actions in a fixture module. |
| Test Data | `err(message, fieldErrors)` called directly; through a module helper; `err(message)` alone; an arrow action with `err(message)` |
| Expected Result | The first two can; the last two can't. |

**Automated by:** `tests/unit/action-confirmations.test.ts` › "SCRUM-270 [AC3] TC-270-09: an action refuses with field errors when it, or a function of its module it calls, passes them to err"

### TC-270-10

| Item | Content |
|---|---|
| Test Case ID | TC-270-10 |
| Test Scenario | [Positive] AC 1: only named, non-type imports from a `"use server"` module are actions |
| Pre-conditions | — |
| Test Steps | 1. Read a fixture component's imports. |
| Test Data | `{ save, type Saved }` and `import type` from a server module, by relative path and by `@/`; `{ helper }` from a module that isn't one |
| Expected Result | `save` and `aliased` only. |

**Automated by:** `tests/unit/action-confirmations.test.ts` › "SCRUM-270 [AC1] TC-270-10: only named, non-type imports from a server module are actions"

### TC-270-11

| Item | Content |
|---|---|
| Test Case ID | TC-270-11 |
| Test Scenario | [Positive] AC 5: TC-132-09 cites the audit's test |
| Pre-conditions | — |
| Test Steps | 1. Read TC-132-09 in [SCRUM-132.md](SCRUM-132.md#tc-132-09). |
| Test Data | — |
| Expected Result | It is marked Unit and cites TC-270-02, TC-270-03 and TC-270-04's tests, keeping the record of its manual runs. |

**Automated by:** Manual (review)

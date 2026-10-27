# SCRUM-65 — Sign in to the system: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-65.md](../backlog/SCRUM-65.md).
Format and conventions: [README.md](README.md). Sign-in is Auth.js's
Credentials provider ([auth.ts](../../auth.ts)) with JWT sessions that carry
the user's id and role ([auth.config.ts](../../auth.config.ts), ADR 0002); the
actions are `authenticate` and `signOutAction` in
[lib/auth/actions.ts](../../lib/auth/actions.ts).

Written on 2026-10-12 from the acceptance criteria, then mapped to the tests
that already existed (SCRUM-176). The tests predate the `SCRUM-n [ACx] TC-n-xx`
title format, so each case names them by their current titles.

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. Every seeded account's password is `Password123!`.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-65-01](#tc-65-01) | Positive | AC 1, AC 3 | Unit, e2e |
| [TC-65-02](#tc-65-02) | Negative | AC 2 | Unit, e2e |
| [TC-65-03](#tc-65-03) | Negative | AC 2 | Unit |
| [TC-65-04](#tc-65-04) | Positive | AC 4, AC 5 | Unit, e2e |

---

### TC-65-01

| Item | Content |
|---|---|
| Test Case ID | TC-65-01 |
| Test Scenario | [Positive] AC 1, AC 3: the right email and password sign the user in, with their role |
| Pre-conditions | Signed out, on `/login`. |
| Test Steps | 1. Enter **Email** and **Password** and click **Sign in**. <br> 2. Look at the navigation. <br> 3. Repeat as each seeded role. |
| Test Data | `organiser@test.local`; then `attendee@test.local` |
| Expected Result | The user lands signed in, and the navigation holds only their role's links: the Organiser sees Events and Notifications; the Attendee sees Events, Registrations and Notifications. |

**Automated by:** `tests/unit/login-schema.test.ts` › "accepts an email and a password"; `tests/unit/auth-actions.test.ts` › "re-throws a non-auth error (the NEXT_REDIRECT thrown on a successful sign-in)"; `e2e/access-control.spec.ts` › "Organiser sees only /events, /notifications", "Attendee sees only /events, /registrations, /notifications"

### TC-65-02

| Item | Content |
|---|---|
| Test Case ID | TC-65-02 |
| Test Scenario | [Negative] AC 2: a wrong password and an unknown email get the same refusal |
| Pre-conditions | Signed out, on `/login`. |
| Test Steps | 1. Sign in as `organiser@test.local` with a wrong password. <br> 2. Sign in as `nobody@test.local`. |
| Test Data | Password "wrong-password" |
| Expected Result | Both show "Invalid email or password.", so the message doesn't say whether the account exists. Neither signs in. |

**Automated by:** `tests/unit/auth-actions.test.ts` › "returns a generic message when credentials are rejected (no account enumeration)"; `e2e/auth.spec.ts` › "SCRUM-65 [AC2] TC-65-02: a wrong password is refused", "SCRUM-65 [AC2] TC-65-02: an unknown email gets the same refusal (no account enumeration)"

### TC-65-03

| Item | Content |
|---|---|
| Test Case ID | TC-65-03 |
| Test Scenario | [Negative] AC 2: an invalid email or an empty password is caught before checking the account |
| Pre-conditions | Signed out, on `/login`. |
| Test Steps | 1. Enter "not-an-email" and a password. <br> 2. Enter a valid email and leave the password empty. |
| Test Data | As above |
| Expected Result | Step 1 asks for a valid email address; step 2 asks for a password. Any other sign-in failure gives a general message rather than an error page. |

**Automated by:** `tests/unit/login-schema.test.ts` › "asks for a valid email address", "asks for a password when it is left empty"; `tests/unit/auth-actions.test.ts` › "returns a fallback message for any other auth error"

### TC-65-04

| Item | Content |
|---|---|
| Test Case ID | TC-65-04 |
| Test Scenario | [Positive] AC 4, AC 5: signing out ends the session, and later requests are treated as signed out |
| Pre-conditions | Signed in as `organiser@test.local`. |
| Test Steps | 1. Click **Open user menu**, then **Sign out**. <br> 2. Go to `/events`. |
| Test Data | None |
| Expected Result | The user is sent to `/login`. Going to `/events` sends them back to `/login`. |

**Automated by:** `tests/unit/auth-actions.test.ts` › "signs the user out and sends them back to /login"; `tests/unit/auth-guard.test.ts` › "redirects to /login when there is no session (deny path)"; `e2e/auth.spec.ts` › "SCRUM-65 [AC4, AC5] TC-65-04: signing out makes protected pages unreachable again"

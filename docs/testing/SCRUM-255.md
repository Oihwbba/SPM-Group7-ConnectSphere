# SCRUM-255 — Bug: Sign-in answers faster for an unknown email, which can reveal which accounts exist: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-255.md](../backlog/SCRUM-255.md)
(in Jira; the next `docs/backlog` sync adds the file).
Format and conventions: [README.md](README.md).

**Shared pre-conditions for every case:** the database is migrated and seeded
(`npm run db:deploy && npm run db:seed`), and every seeded account signs in
with `Password123!`.

Found by the SCRUM-216 epic check (finding C-1): an email with no account was
refused before any password comparison, so it was answered faster than a
wrong password for a real account. `auth.ts` now compares the password against
a dummy bcrypt hash when there is no account, made once at the seed's cost
(10). Nothing else about sign-in changes.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-255-01](#tc-255-01) | Negative | AC 1, AC 3 | Unit |
| [TC-255-02](#tc-255-02) | Negative | AC 2 | Unit, e2e |
| [TC-255-03](#tc-255-03) | Positive, Negative | AC 2 | Unit, e2e |

---

### TC-255-01

| Item | Content |
|---|---|
| Test Case ID | TC-255-01 |
| Test Scenario | [Negative] AC 1, AC 3: an email with no account still has its password compared, at the same cost |
| Pre-conditions | No account has the email. |
| Test Steps | 1. Sign in with the unknown email and any password. |
| Test Data | `nobody@test.local` / `Password123!` |
| Expected Result | Sign-in is refused. The password was compared once, against a bcrypt hash of cost 10 (the seed's), which isn't any account's hash. With the early return put back, this test fails. |

**Automated by:** `tests/unit/sign-in.test.ts` › "SCRUM-255 [AC1, AC3] TC-255-01: an email with no account still has its password compared, against a bcrypt hash at the seed's cost"

### TC-255-02

| Item | Content |
|---|---|
| Test Case ID | TC-255-02 |
| Test Scenario | [Negative] AC 2: an unknown email and a wrong password get the identical answer |
| Pre-conditions | `organiser@test.local` exists; `nobody@test.local` doesn't. |
| Test Steps | 1. Sign in with `nobody@test.local`. <br> 2. Sign in with `organiser@test.local` and a wrong password. |
| Test Data | `nobody@test.local` / `Password123!`; `organiser@test.local` / `not-the-password` |
| Expected Result | Both are refused the same way, after one password comparison each: "Invalid email or password.", nothing written, no session. |

**Automated by:** `tests/unit/sign-in.test.ts` › "SCRUM-255 [AC2] TC-255-02: an unknown email and a wrong password get the same answer, each after one comparison, and read nothing else"; `e2e/auth.spec.ts` › "SCRUM-65 [AC2] TC-65-02: a wrong password is refused" and "SCRUM-65 [AC2] TC-65-02: an unknown email gets the same refusal (no account enumeration)"

### TC-255-03

| Item | Content |
|---|---|
| Test Case ID | TC-255-03 |
| Test Scenario | [Positive, Negative] AC 2: a correct sign-in still works, and a malformed one is still refused before the database |
| Pre-conditions | `organiser@test.local` exists. |
| Test Steps | 1. Sign in with the right password. <br> 2. Sign in with "not-an-email" and an empty password. |
| Test Data | `organiser@test.local` / `Password123!` |
| Expected Result | 1: signed in, with the account's id, name, email and role. 2: refused, with no database read and no password comparison. |

**Automated by:** `tests/unit/sign-in.test.ts` › "SCRUM-255 [AC2] TC-255-03: the right password for a real account still signs in, with its role" and "SCRUM-255 [AC2] TC-255-03: a malformed sign-in is refused before the database, as before"; `e2e/auth.spec.ts` › "SCRUM-65 [AC4, AC5] TC-65-04: signing out makes protected pages unreachable again" (signs in first)

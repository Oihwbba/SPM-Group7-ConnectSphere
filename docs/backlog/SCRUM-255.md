<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-30. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-255 - Bug: Sign-in answers faster for an unknown email, which can reveal which accounts exist

| | |
|---|---|
| **Type** | Task |
| **Epic** | SCRUM-9 - Access Control |
| **Priority** | Low |
| **Story points** | - |
| **Status in Jira** | In Progress |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-255 |

---

Found in the SCRUM-216 Access Control epic check (finding C-1). PO approved raising it this sprint (Hann Qian, 30 Oct).

**What's wrong:** for an email with no account, sign-in returns at `auth.ts` (around lines 36–37) without checking a password, while a real account with a wrong password runs bcrypt first. The message is the same ("wrong email or password"), but the unknown-email response is measurably faster, so timing repeated attempts could reveal which emails have accounts (SCRUM-65 AC2).

**To reproduce:** time repeated sign-ins with `nobody@test.local` and with `organiser@test.local`, both with a wrong password.

**Acceptance criteria**

1. Given an email with no account, when someone signs in, then the password is still compared (against a fixed dummy bcrypt hash), so the response takes about as long as a wrong password for a real account.
2. The message and behaviour are unchanged: the same "wrong email or password", nothing written, no session.
3. A test proves the comparison runs for an unknown email (e.g. bcrypt.compare is called), and fails if the early return is restored.

Related: SCRUM-65 (sign in), SCRUM-216, SCRUM-9.

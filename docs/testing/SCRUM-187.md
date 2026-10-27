# SCRUM-187 — The clarification answer form stays on "Sending…" when sending fails: test cases

SCRUM-187 is a Bug task in Jira, raised in the PO's review of #184 to #191. Its
story and acceptance criteria: [docs/backlog/SCRUM-187.md](../backlog/SCRUM-187.md).
Format and conventions: [README.md](README.md).

**Why it failed:** `submitResponse()` in
`components/events/clarification-panel.tsx` set "Sending…" before awaiting
`respondToClarification` and cleared it only after a reply. A send that got no
reply (a dropped connection, or an error the action rethrows) left the button
disabled with no message. The fix follows #191's change-request form: the send
is wrapped in `try`/`finally`, and a send with no reply shows a message and
reads the thread again, because it can't tell whether the answer was saved.

**Shared pre-conditions for every case:** a local PostgreSQL migrated with
`npm run db:deploy` and seeded with `npm run db:seed`; the e2e tests create
their own event Under Review with an open, text-only clarification.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-187-01](#tc-187-01) | Negative | AC 1, AC 4 | e2e |
| [TC-187-02](#tc-187-02) | Negative | AC 2, AC 4 | e2e |
| [TC-187-03](#tc-187-03) | Negative | AC 3 | e2e (existing, SCRUM-108) |

---

### TC-187-01

| Item | Content |
|---|---|
| Test Case ID | TC-187-01 |
| Test Scenario | [Negative] AC 1, AC 4: a send that never reaches the server says so, and the same answer can be sent again |
| Pre-conditions | Signed in as the Organiser; the event's clarification is Open |
| Test Steps | 1. Open the event and type an answer. <br> 2. Drop the connection and click **Send response**. <br> 3. Restore the connection and click **Send response** again. |
| Test Data | `organiser@test.local` / `Password123!`; answer "Yes, it is fixed." |
| Expected Result | After step 2: "Your response couldn't be sent. If it isn't shown as answered above, try again." is shown, **Send response** is enabled, the clarification is still Open and no answer is recorded. After step 3: "Response sent to the coordinator.", the message is gone, and one answer is recorded. |

**Automated by:** `e2e/clarification-and-amend.spec.ts` › "SCRUM-187 [AC1, AC4] TC-187-01: a send that never reaches the server says so, and the same answer can be sent again"

### TC-187-02

| Item | Content |
|---|---|
| Test Case ID | TC-187-02 |
| Test Scenario | [Negative] AC 2, AC 4: an answer that was saved but whose reply was lost shows as answered, so it isn't sent twice |
| Pre-conditions | As TC-187-01 |
| Test Steps | 1. Open the event and type an answer. <br> 2. Click **Send response**; the server saves it, but the reply never reaches the browser. |
| Test Data | As TC-187-01 |
| Expected Result | The failure message is shown, the thread is read again, and the panel shows "Organiser responded:" with the answer and no **Send response** button. The clarification is Answered with that response, recorded once. |

**Automated by:** `e2e/clarification-and-amend.spec.ts` › "SCRUM-187 [AC2, AC4] TC-187-02: an answer saved whose reply is lost shows as answered, so it isn't sent twice"

### TC-187-03

| Item | Content |
|---|---|
| Test Case ID | TC-187-03 |
| Test Scenario | [Negative] AC 3: an answer the server refuses is handled as before |
| Pre-conditions | As TC-187-01, with Expected attendance named as editable |
| Test Steps | 1. Set Expected attendance to 0, type an answer, and click **Send response**. |
| Test Data | Expected attendance `0` |
| Expected Result | "Attendance must be a positive whole number." is shown at the field, which is marked invalid; the clarification stays Open. |

**Automated by:** `e2e/clarification-and-amend.spec.ts` › "SCRUM-108 [AC1, AC2, AC3, AC14] TC-108-10: …" (its failure path, unchanged by this fix)

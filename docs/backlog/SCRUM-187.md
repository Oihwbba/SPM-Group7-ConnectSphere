<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-21. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-187 - Bug: The clarification answer form stays on "Sending…" when sending fails

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-187 |

---

When an Organiser answers a clarification (SCRUM-108) and the send fails before the server replies (the connection drops, or `respondToClarification` rethrows an unexpected error), the form stays on **"Sending…"** with its button disabled and no message. The Organiser has to close and reopen the event to try again.

The cause is `submitResponse()` in `components/events/clarification-panel.tsx`: it sets `submitting` before `await respondToClarification(...)` and resets it only after a reply arrives, with no `try`/`finally`. The change-request form had the same shape; #191 (SCRUM-41) fixed it there, and its review notes this one is still open. It is recorded as a known gap in `.github/ai-review/memory.md` (the #162 lesson).

**Acceptance criteria**

1. When sending an answer fails without a reply from the server, the form leaves "Sending…", **Send response** is enabled again, and a message says the answer couldn't be sent.
2. Because a failure without a reply can't say whether the answer was saved, the panel reads the clarification again, so an answer that was in fact saved shows as answered rather than being sent twice.
3. An answer the server refuses (a reply with an error) is handled exactly as before: the field errors and the message are shown.
4. An e2e regression test drops the send in the browser and checks AC1 and AC2, and it fails without the fix.

Raised in the PO's review of #184 to #191 (Sprint 3), as a new Bug task rather than reopening SCRUM-108. Related: SCRUM-108, SCRUM-41, #191.

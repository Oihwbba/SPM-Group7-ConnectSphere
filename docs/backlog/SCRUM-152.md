<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-04. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-152 - Keep the GLM reviewer memory within the size the reviewer reads, and stop losing lessons to the cap

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | Done |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-152 |

---

Type: technical task. Follow-up to SCRUM-112 (the reviewer writes its own memory).

## Why this exists

The GLM reviewer reads `.github/ai-review/memory.md` from main and cuts it at 8,000 characters (`MAX_MEMORY_CHARS`).

* **The memory on main is over the cap.** It is 8,181 characters since the hand edit in #105 (SCRUM-125), so the reviewer has been reading a truncated memory: the end of the #99 lesson (unavailability can't be removed; the record form blocks past start times the server accepts) is cut off. Nothing checks the size of a hand edit.
* **A real lesson was lost.** After #95 (SCRUM-28) merged, GLM proposed a lesson, but the rewritten memory was 8,150 characters, and `checkProposal` rejected it. The job only logs a rejection and still shows green, so nobody saw it, and the lesson's text was not kept.
* **Every future lesson starts over the cap.** GLM rewrites the whole file and rarely prunes on its own, so with the file already full, a new lesson is rejected for size.

## Scope

1. Bring `memory.md` back under the cap with room for new lessons, without dropping any lesson that is still true.
2. Fail CI when `memory.md` on a branch is longer than the reviewer reads, so a hand edit can't silently overflow it again.
3. When GLM's proposal is only too long, ask it once more to prune to the limit instead of discarding the lesson.
4. Make a rejected lesson visible in the run (a warning), not just a log line.
5. Allow the memory job to be re-run by hand for a given pull request, so the lesson lost from #95 can be recovered.

## Acceptance criteria

* `memory.md` is under 8,000 characters and every lesson in it before the change is still present (condensed is fine).
* CI fails on a pull request whose `memory.md` is over the limit the reviewer reads.
* A proposal rejected only for length gets one retry that tells GLM the size and the limit.
* A rejected lesson shows as a warning on the workflow run.
* The memory job can be run manually for a chosen pull request number.

Needs Jin Hong's approval (CODEOWNERS on .github/).

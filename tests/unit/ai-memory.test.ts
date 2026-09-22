import { describe, it, expect } from "vitest";

import {
  buildMemoryPrompt,
  checkProposal,
  memoryEntries,
  singaporeDate,
  parseProposal,
  renderFileStat,
  summariseCi,
} from "../../.github/scripts/ai-memory.mjs";

// SCRUM-112 — the reviewer writes its own memory now, and that memory is read
// before every review. A wiped, gutted or oversized rewrite would quietly
// degrade every later review, so the guards are checked here rather than only
// asked for in the prompt.

const HEADING = "# GLM reviewer memory";

function memory(body: string): string {
  return [
    HEADING,
    "",
    "Lessons from past reviews, approved by the team.",
    "",
    "Rules for a lesson:",
    "",
    "- State a fact about this project and why it's so.",
    "",
    "## Lessons",
    "",
    body,
  ].join("\n");
}

const current = memory("- (2026-09-15, #27) Jin Hong merges as admin, so CODEOWNERS is satisfied.");

function proposal(body: string, note = "Coordinators are seeded twice.") {
  return { learned: true, note, memory: memory(body) };
}

describe("parseProposal — SCRUM-112", () => {
  it("reads the JSON out of a fenced reply with prose around it", () => {
    const reply = [
      "Here is what I learned:",
      "```json",
      JSON.stringify({ learned: true, note: "  The seed  has   two coordinators. ", memory: "# GLM reviewer memory" }),
      "```",
      "Done.",
    ].join("\n");

    expect(parseProposal(reply)).toEqual({
      learned: true,
      note: "The seed has two coordinators.",
      memory: "# GLM reviewer memory",
    });
  });

  it("reads a bare JSON reply, and treats anything but true as nothing learned", () => {
    expect(parseProposal(JSON.stringify({ learned: "yes", note: "n" }))).toMatchObject({ learned: false });
    expect(parseProposal(JSON.stringify({ learned: false, note: "Nothing here." }))).toMatchObject({
      learned: false,
      note: "Nothing here.",
    });
  });

  it("returns null for a reply that is not usable JSON", () => {
    expect(parseProposal("I could not decide.")).toBeNull();
    expect(parseProposal("```json\n{ broken\n```")).toBeNull();
    expect(parseProposal("")).toBeNull();
  });
});

describe("checkProposal — SCRUM-112", () => {
  it("accepts a rewrite that keeps the file's shape and adds a lesson", () => {
    const next = proposal("- (2026-09-21, #61) The seed has two coordinators, so a test must read the assignment.");

    const verdict = checkProposal({ proposal: next, current, prNumber: 61 });

    expect(verdict.accept).toBe(true);
    expect(verdict.note).toBe("Coordinators are seeded twice.");
    // Only the accepting branch carries a memory, so TypeScript needs telling.
    expect(verdict.memory!.endsWith("\n")).toBe(true);
    expect(verdict.memory).toContain("two coordinators");
  });

  it("makes no change when the merge taught nothing, and says why", () => {
    const verdict = checkProposal({
      proposal: { learned: false, note: "A straightforward bug fix.", memory: "" },
      current,
      prNumber: 61,
    });

    expect(verdict.accept).toBe(false);
    expect(verdict.reason).toContain("A straightforward bug fix.");
  });

  it("refuses a memory the reviewer would not read in full", () => {
    const tooLong = proposal(`- ${"x".repeat(9_000)}`);

    const verdict = checkProposal({ proposal: tooLong, current, prNumber: 61 });

    expect(verdict.accept).toBe(false);
    expect(verdict.reason).toContain("8000");
  });

  // A rewrite may prune a stale lesson, but handing back a near-empty file
  // would silently switch the reviewer's memory off.
  it("refuses a wipe, and a rewrite that keeps only a fraction of the file", () => {
    const gutted = { learned: true, note: "Tidied up.", memory: `${HEADING}\n\nRules for a lesson:\n` };

    const verdict = checkProposal({ proposal: gutted, current, prNumber: 61 });

    expect(verdict.accept).toBe(false);
    expect(verdict.reason).toContain("wipe");
  });

  it("refuses a memory that lost its heading or its own rules", () => {
    const noHeading = { learned: true, note: "n", memory: current.replace(HEADING, "# Notes") };
    const noRules = { learned: true, note: "n", memory: current.replace("Rules for a lesson:", "Guidance:") };

    expect(checkProposal({ proposal: noHeading, current, prNumber: 61 }).reason).toContain(HEADING);
    expect(checkProposal({ proposal: noRules, current, prNumber: 61 }).reason).toContain("Rules for a lesson:");
  });

  it("refuses a lesson with no note, because the pull request has nothing to say", () => {
    const unexplained = { learned: true, note: "", memory: memory("- (2026-09-21, #61) Something.") };

    expect(checkProposal({ proposal: unexplained, current, prNumber: 61 }).reason).toContain("no note");
  });

  it("makes no change when the rewrite says exactly what the file already says", () => {
    const same = { learned: true, note: "n", memory: `${current}\r\n` };

    const verdict = checkProposal({ proposal: same, current, prNumber: 61 });

    expect(verdict.accept).toBe(false);
    expect(verdict.reason).toContain("identical");
  });

  // The first live run, on #67, handed back a correct new lesson and also
  // turned an unrelated migration name's underscore into a hyphen.
  describe("entries the pull request had no reason to touch", () => {
    const migration = [
      "- (2026-09-16, #33) Migration",
      "  `20260912120000_add_programme_and_special_requests` uses IF NOT EXISTS.",
    ].join("\n");
    const lesson = "- (2026-09-22, #67) Held checks on the memory pull request are GitHub's guard.";
    const before = memory(migration);

    it("refuses a proposal that edits an old entry without citing the pull request", () => {
      const corrupted = memory(`${migration.replace("add_programme", "add-programme")}\n${lesson}`);

      const verdict = checkProposal({ proposal: { learned: true, note: "n", memory: corrupted }, current: before, prNumber: 67 });

      expect(verdict.accept).toBe(false);
      expect(verdict.reason).toContain("without citing #67");
      expect(verdict.reason).toContain("add-programme");
    });

    it("accepts a new lesson, a re-wrapped old one, and a stale one deleted whole", () => {
      const rewrapped = migration.replace("\n  ", " ");
      const kept = memory(`${rewrapped}\n${lesson}`);
      const pruned = memory(lesson);

      expect(checkProposal({ proposal: { learned: true, note: "n", memory: kept }, current: before, prNumber: 67 }).accept).toBe(true);
      expect(checkProposal({ proposal: { learned: true, note: "n", memory: pruned }, current: before, prNumber: 67 }).accept).toBe(true);
    });

    it("does not take #6 as a citation of #67", () => {
      const edited = memory(`${migration.replace("uses", "now uses")} (see #67)`);

      expect(checkProposal({ proposal: { learned: true, note: "n", memory: edited }, current: before, prNumber: 6 }).accept).toBe(false);
    });
  });

  it("reads a bullet and its indented lines as one entry, whatever the wrapping", () => {
    expect(memoryEntries("# Title\n\n- one\n  two\n-   three")).toEqual(["# Title", "- one two", "- three"]);
  });

  // The file's opening paragraph is hard-wrapped flush left; a model returning
  // it on one line has not changed it.
  it("reads a flush-left wrapped paragraph as one entry, so re-wrapping it is not a change", () => {
    const wrapped = "Lessons from past reviews, approved by the team. The reviewer reads this file\nfrom `main` on every pull request.";
    const oneLine = wrapped.replace("\n", " ");

    expect(memoryEntries(wrapped)).toEqual(memoryEntries(oneLine));
    expect(memoryEntries(`${wrapped}\n## Tests\n- a`)).toHaveLength(3);
  });

  // Existing lessons cite pull requests mid-sentence ("was recovered in #33"),
  // and a different wrapping can put the citation at the start of a line.
  it("does not take a citation wrapped to the start of a line for a heading", () => {
    const wrapped = "- Migration X was recovered in\n  #33 and is safe everywhere.";
    const oneLine = "- Migration X was recovered in #33 and is safe everywhere.";

    expect(memoryEntries(wrapped)).toEqual(memoryEntries(oneLine));
    expect(memoryEntries("Migration X was recovered in\n#33 and is safe.")).toHaveLength(1);
  });

  // 17:00 UTC is already the next day in Singapore; a UTC date would be a
  // day behind every evening.
  it("dates a lesson in Singapore time, not UTC", () => {
    expect(singaporeDate(new Date("2026-09-22T17:00:00Z"))).toBe("2026-09-23");
    expect(singaporeDate(new Date("2026-09-22T15:59:00Z"))).toBe("2026-09-22");
  });

  it("refuses a reply GLM never gave", () => {
    expect(checkProposal({ proposal: null, current, prNumber: 61 }).accept).toBe(false);
  });
});

describe("summariseCi — SCRUM-112", () => {
  it("names the failing checks, because a predictable failure is the lesson", () => {
    const summary = summariseCi([
      { name: "build-and-test", conclusion: "failure" },
      { name: "build-and-test", conclusion: "failure" },
      { name: "review", conclusion: "success" },
    ]);

    expect(summary).toContain("failed 2 time(s)");
    expect(summary).toContain("build-and-test");
    expect(summary).not.toContain("review,");
  });

  it("says so when CI never failed, and says nothing when there was no CI", () => {
    expect(summariseCi([{ name: "build-and-test", conclusion: "success" }])).toContain("passed");
    expect(summariseCi([])).toBe("");
  });
});

// The stat comes from the API because merged branches are deleted, so the
// pull request's head commit is usually not in the runner's clone.
describe("renderFileStat — SCRUM-112", () => {
  it("lists each file with its line counts, and says when it was added or removed", () => {
    expect(
      renderFileStat([
        { filename: "lib/nav.ts", additions: 12, deletions: 3, status: "modified" },
        { filename: "tests/unit/nav.test.ts", additions: 40, deletions: 0, status: "added" },
        { filename: "old.ts", additions: 0, deletions: 9, status: "removed" },
      ]),
    ).toBe(
      ["lib/nav.ts | +12 -3", "tests/unit/nav.test.ts | +40 -0 (added)", "old.ts | +0 -9 (removed)"].join("\n"),
    );
  });
});

describe("buildMemoryPrompt — SCRUM-112", () => {
  const pr = {
    number: 61,
    title: "SCRUM-13 Simplify the filter tabs",
    body: "Body.",
    branch: "SCRUM-13-tabs",
    author: "Oihwbba",
    mergedBy: "Oihwbba",
  };

  it("shows the memory, the pull request, its review and what CI did", () => {
    const prompt = buildMemoryPrompt({
      current,
      pending: false,
      pr,
      review: "### 1. Medium: the Submitted tab hides UNDER_REVIEW",
      ci: "CI failed 1 time(s).",
      stat: " app/page.tsx | 2 +-",
      today: "2026-09-22",
    });

    expect(prompt).toContain("Jin Hong merges as admin");
    expect(prompt).toContain("#61 SCRUM-13 Simplify the filter tabs");
    expect(prompt).toContain("the Submitted tab hides UNDER_REVIEW");
    expect(prompt).toContain("CI failed 1 time(s).");
    expect(prompt).toContain("app/page.tsx");
    expect(prompt).not.toContain("not been merged yet");
  });

  it("tells GLM the date and the pull request to cite, so a lesson is dated today", () => {
    const prompt = buildMemoryPrompt({ current, pending: false, pr, review: "", ci: "", stat: "", today: "2026-09-22" });

    expect(prompt).toContain("Today is 2026-09-22.");
    expect(prompt).toContain("cite #61");
  });

  it("says when the memory carries lessons still waiting in an open proposal", () => {
    const prompt = buildMemoryPrompt({ current, pending: true, pr, review: "", ci: "", stat: "", today: "2026-09-22" });

    expect(prompt).toContain("not been merged yet");
    expect(prompt).toContain("No CI result was found");
  });
});

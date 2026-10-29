import { readFileSync } from "node:fs";

import { describe, it, expect } from "vitest";

import {
  buildMemoryPrompt,
  buildPruneRequest,
  checkProposal,
  refusalLog,
  memoryEntries,
  singaporeDate,
  parseProposal,
  renderFileStat,
  summariseCi,
} from "../../.github/scripts/ai-memory.mjs";
import { MAX_MEMORY_CHARS, MEMORY_PATH } from "../../.github/scripts/ai-review.mjs";

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
  it("SCRUM-112: reads the JSON out of a fenced reply with prose around it", () => {
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

  it("SCRUM-112: reads a bare JSON reply, and treats anything but true as nothing learned", () => {
    expect(parseProposal(JSON.stringify({ learned: "yes", note: "n" }))).toMatchObject({ learned: false });
    expect(parseProposal(JSON.stringify({ learned: false, note: "Nothing here." }))).toMatchObject({
      learned: false,
      note: "Nothing here.",
    });
  });

  it("SCRUM-112: returns null for a reply that is not usable JSON", () => {
    expect(parseProposal("I could not decide.")).toBeNull();
    expect(parseProposal("```json\n{ broken\n```")).toBeNull();
    expect(parseProposal("")).toBeNull();
  });
});

describe("checkProposal — SCRUM-112", () => {
  it("SCRUM-112: accepts a rewrite that keeps the file's shape and adds a lesson", () => {
    const next = proposal("- (2026-09-21, #61) The seed has two coordinators, so a test must read the assignment.");

    const verdict = checkProposal({ proposal: next, current, prNumber: 61 });

    expect(verdict.accept).toBe(true);
    expect(verdict.note).toBe("Coordinators are seeded twice.");
    // Only the accepting branch carries a memory, so TypeScript needs telling.
    expect(verdict.memory!.endsWith("\n")).toBe(true);
    expect(verdict.memory).toContain("two coordinators");
  });

  it("SCRUM-112: makes no change when the merge taught nothing, and says why", () => {
    const verdict = checkProposal({
      proposal: { learned: false, note: "A straightforward bug fix.", memory: "" },
      current,
      prNumber: 61,
    });

    expect(verdict.accept).toBe(false);
    expect(verdict.reason).toContain("A straightforward bug fix.");
  });

  it("SCRUM-112: refuses a memory the reviewer would not read in full", () => {
    const tooLong = proposal(`- ${"x".repeat(13_000)}`);

    const verdict = checkProposal({ proposal: tooLong, current, prNumber: 61 });

    expect(verdict.accept).toBe(false);
    expect(verdict.reason).toContain("12000");
  });

  // A rewrite may prune a stale lesson, but handing back a near-empty file
  // would silently switch the reviewer's memory off.
  it("SCRUM-112: refuses a wipe, and a rewrite that keeps only a fraction of the file", () => {
    const gutted = { learned: true, note: "Tidied up.", memory: `${HEADING}\n\nRules for a lesson:\n` };

    const verdict = checkProposal({ proposal: gutted, current, prNumber: 61 });

    expect(verdict.accept).toBe(false);
    expect(verdict.reason).toContain("wipe");
  });

  it("SCRUM-112: refuses a memory that lost its heading or its own rules", () => {
    const noHeading = { learned: true, note: "n", memory: current.replace(HEADING, "# Notes") };
    const noRules = { learned: true, note: "n", memory: current.replace("Rules for a lesson:", "Guidance:") };

    expect(checkProposal({ proposal: noHeading, current, prNumber: 61 }).reason).toContain(HEADING);
    expect(checkProposal({ proposal: noRules, current, prNumber: 61 }).reason).toContain("Rules for a lesson:");
  });

  it("SCRUM-112: refuses a lesson with no note, because the pull request has nothing to say", () => {
    const unexplained = { learned: true, note: "", memory: memory("- (2026-09-21, #61) Something.") };

    expect(checkProposal({ proposal: unexplained, current, prNumber: 61 }).reason).toContain("no note");
  });

  it("SCRUM-112: makes no change when the rewrite says exactly what the file already says", () => {
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

    it("SCRUM-112: refuses a proposal that edits an old entry without citing the pull request", () => {
      const corrupted = memory(`${migration.replace("add_programme", "add-programme")}\n${lesson}`);

      const verdict = checkProposal({ proposal: { learned: true, note: "n", memory: corrupted }, current: before, prNumber: 67 });

      expect(verdict.accept).toBe(false);
      expect(verdict.reason).toContain("without citing #67");
      expect(verdict.reason).toContain("add-programme");
    });

    it("SCRUM-112: accepts a new lesson, a re-wrapped old one, and a stale one deleted whole", () => {
      const rewrapped = migration.replace("\n  ", " ");
      const kept = memory(`${rewrapped}\n${lesson}`);
      const pruned = memory(lesson);

      expect(checkProposal({ proposal: { learned: true, note: "n", memory: kept }, current: before, prNumber: 67 }).accept).toBe(true);
      expect(checkProposal({ proposal: { learned: true, note: "n", memory: pruned }, current: before, prNumber: 67 }).accept).toBe(true);
    });

    it("SCRUM-112: does not take #6 as a citation of #67", () => {
      const edited = memory(`${migration.replace("uses", "now uses")} (see #67)`);

      expect(checkProposal({ proposal: { learned: true, note: "n", memory: edited }, current: before, prNumber: 6 }).accept).toBe(false);
    });
  });

  it("SCRUM-112: reads a bullet and its indented lines as one entry, whatever the wrapping", () => {
    expect(memoryEntries("# Title\n\n- one\n  two\n-   three")).toEqual(["# Title", "- one two", "- three"]);
  });

  // The file's opening paragraph is hard-wrapped flush left; a model returning
  // it on one line has not changed it.
  it("SCRUM-112: reads a flush-left wrapped paragraph as one entry, so re-wrapping it is not a change", () => {
    const wrapped = "Lessons from past reviews, approved by the team. The reviewer reads this file\nfrom `main` on every pull request.";
    const oneLine = wrapped.replace("\n", " ");

    expect(memoryEntries(wrapped)).toEqual(memoryEntries(oneLine));
    expect(memoryEntries(`${wrapped}\n## Tests\n- a`)).toHaveLength(3);
  });

  // Existing lessons cite pull requests mid-sentence ("was recovered in #33"),
  // and a different wrapping can put the citation at the start of a line.
  it("SCRUM-112: does not take a citation wrapped to the start of a line for a heading", () => {
    const wrapped = "- Migration X was recovered in\n  #33 and is safe everywhere.";
    const oneLine = "- Migration X was recovered in #33 and is safe everywhere.";

    expect(memoryEntries(wrapped)).toEqual(memoryEntries(oneLine));
    expect(memoryEntries("Migration X was recovered in\n#33 and is safe.")).toHaveLength(1);
  });

  // 17:00 UTC is already the next day in Singapore; a UTC date would be a
  // day behind every evening.
  it("SCRUM-112: dates a lesson in Singapore time, not UTC", () => {
    expect(singaporeDate(new Date("2026-09-22T17:00:00Z"))).toBe("2026-09-23");
    expect(singaporeDate(new Date("2026-09-22T15:59:00Z"))).toBe("2026-09-22");
  });

  it("SCRUM-112: refuses a reply GLM never gave", () => {
    expect(checkProposal({ proposal: null, current, prNumber: 61 }).accept).toBe(false);
  });

  it("SCRUM-152: marks a proposal refused only for length, so it gets one retry", () => {
    const tooLong = checkProposal({ proposal: proposal(`- ${"x".repeat(13_000)}`), current, prNumber: 61 });
    const gutted = checkProposal({
      proposal: { learned: true, note: "Tidied up.", memory: `${HEADING}\n\nRules for a lesson:\n` },
      current,
      prNumber: 61,
    });

    expect(tooLong.tooLong).toBeGreaterThan(MAX_MEMORY_CHARS);
    expect(gutted.tooLong).toBeUndefined();
  });
});

describe("buildPruneRequest — SCRUM-152", () => {
  it("SCRUM-152: a proposal rejected only for length is retried with its size and the limit", () => {
    const request = buildPruneRequest({ length: 8150, prNumber: 95 });

    expect(request).toContain("8150 characters");
    expect(request).toContain(`at most ${MAX_MEMORY_CHARS}`);
    expect(request).toContain("Keep your lesson");
    // Shortening an old entry without citing the pull request is refused by
    // checkProposal, so the request must say how to shorten one legally.
    expect(request).toContain("citing #95");
  });
});

describe("refusalLog — SCRUM-152", () => {
  const tooLong = { accept: false, reason: "The proposed memory is 12150 characters, over the 12000 the reviewer reads." };
  const found = { learned: true, note: "Equipment lines are reviewed one by one.", memory: "" };

  it("SCRUM-152: a rejected lesson shows as a warning on the workflow run", () => {
    const log = refusalLog({ attempts: [found], verdict: tooLong, prNumber: 95 });

    expect(log).toMatch(/^::warning::A lesson was lost \(Equipment lines are reviewed one by one\.\)/);
    expect(log).toContain("No memory change for #95: The proposed memory is 12150 characters");
  });

  // The GLM review of #109: the retry replaced the proposal, so an
  // unparseable or empty retry hid the lesson the first attempt found.
  it("SCRUM-152: still warns when the prune retry comes back unusable or empty", () => {
    const unparseable = refusalLog({ attempts: [found, null], verdict: { accept: false, reason: "GLM returned no usable JSON." }, prNumber: 95 });
    const empty = refusalLog({
      attempts: [found, { learned: false, note: "Nothing to add.", memory: "" }],
      verdict: { accept: false, reason: "Nothing learned: Nothing to add." },
      prNumber: 95,
    });

    expect(unparseable).toContain("::warning::A lesson was lost (Equipment lines are reviewed one by one.)");
    expect(empty).toContain("::warning::A lesson was lost (Equipment lines are reviewed one by one.)");
  });

  it("SCRUM-152: names the latest attempt's lesson when both found one", () => {
    const pruned = { learned: true, note: "Equipment lines are reviewed one by one; dropped the #33 checksums note.", memory: "" };

    expect(refusalLog({ attempts: [found, pruned], verdict: tooLong, prNumber: 95 })).toContain("dropped the #33 checksums note");
  });

  it("SCRUM-152: logs nothing learned as a plain line, because that is the normal answer", () => {
    const log = refusalLog({
      attempts: [{ learned: false, note: "A docs-only sync.", memory: "" }],
      verdict: { accept: false, reason: "Nothing learned: A docs-only sync." },
      prNumber: 103,
    });

    expect(log).toBe("No memory change for #103: Nothing learned: A docs-only sync.");
  });
});

// #105 edited the memory by hand to 8,181 characters, and for a day the
// reviewer read it cut off mid-lesson, with nothing to say so.
describe("the memory on this branch — SCRUM-152", () => {
  it("SCRUM-152: CI fails when memory.md is longer than the reviewer reads", () => {
    // The reviewer reads the file through git (readFromBase), which stores LF;
    // a Windows checkout adds a CR to every line that the reviewer never sees.
    const length = readFileSync(MEMORY_PATH, "utf8").replace(/\r\n/g, "\n").length;

    expect(length, `${MEMORY_PATH} is ${length} characters`).toBeLessThanOrEqual(MAX_MEMORY_CHARS);
  });

  // The memory's own rules said 8,000 for a day after SCRUM-180 raised the
  // limit, and the bot is told to keep those rules unchanged.
  it("SCRUM-181 [AC6]: the memory's rules state the limit the reviewer actually reads", () => {
    const memory = readFileSync(MEMORY_PATH, "utf8");
    const limit = String(MAX_MEMORY_CHARS).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    expect(memory).toContain(`reads at most ${limit} characters`);
  });
});

describe("summariseCi — SCRUM-112", () => {
  it("SCRUM-112: names the failing checks, because a predictable failure is the lesson", () => {
    const summary = summariseCi([
      { name: "build-and-test", conclusion: "failure" },
      { name: "build-and-test", conclusion: "failure" },
      { name: "review", conclusion: "success" },
    ]);

    expect(summary).toContain("failed 2 time(s)");
    expect(summary).toContain("build-and-test");
    expect(summary).not.toContain("review,");
  });

  it("SCRUM-112: says so when CI never failed, and says nothing when there was no CI", () => {
    expect(summariseCi([{ name: "build-and-test", conclusion: "success" }])).toContain("passed");
    expect(summariseCi([])).toBe("");
  });
});

// The stat comes from the API because merged branches are deleted, so the
// pull request's head commit is usually not in the runner's clone.
describe("renderFileStat — SCRUM-112", () => {
  it("SCRUM-112: lists each file with its line counts, and says when it was added or removed", () => {
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

  it("SCRUM-112: shows the memory, the pull request, its review and what CI did", () => {
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

  it("SCRUM-112: tells GLM the date and the pull request to cite, so a lesson is dated today", () => {
    const prompt = buildMemoryPrompt({ current, pending: false, pr, review: "", ci: "", stat: "", today: "2026-09-22" });

    expect(prompt).toContain("Today is 2026-09-22.");
    expect(prompt).toContain("cite #61");
  });

  it("SCRUM-112: says when the memory carries lessons still waiting in an open proposal", () => {
    const prompt = buildMemoryPrompt({ current, pending: true, pr, review: "", ci: "", stat: "", today: "2026-09-22" });

    expect(prompt).toContain("not been merged yet");
    expect(prompt).toContain("No CI result was found");
  });
});

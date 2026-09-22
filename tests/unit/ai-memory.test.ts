import { describe, it, expect } from "vitest";

import {
  buildMemoryPrompt,
  checkProposal,
  parseProposal,
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

    const verdict = checkProposal({ proposal: next, current });

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
    });

    expect(verdict.accept).toBe(false);
    expect(verdict.reason).toContain("A straightforward bug fix.");
  });

  it("refuses a memory the reviewer would not read in full", () => {
    const tooLong = proposal(`- ${"x".repeat(9_000)}`);

    const verdict = checkProposal({ proposal: tooLong, current });

    expect(verdict.accept).toBe(false);
    expect(verdict.reason).toContain("8000");
  });

  // A rewrite may prune a stale lesson, but handing back a near-empty file
  // would silently switch the reviewer's memory off.
  it("refuses a wipe, and a rewrite that keeps only a fraction of the file", () => {
    const gutted = { learned: true, note: "Tidied up.", memory: `${HEADING}\n\nRules for a lesson:\n` };

    const verdict = checkProposal({ proposal: gutted, current });

    expect(verdict.accept).toBe(false);
    expect(verdict.reason).toContain("wipe");
  });

  it("refuses a memory that lost its heading or its own rules", () => {
    const noHeading = { learned: true, note: "n", memory: current.replace(HEADING, "# Notes") };
    const noRules = { learned: true, note: "n", memory: current.replace("Rules for a lesson:", "Guidance:") };

    expect(checkProposal({ proposal: noHeading, current }).reason).toContain(HEADING);
    expect(checkProposal({ proposal: noRules, current }).reason).toContain("Rules for a lesson:");
  });

  it("refuses a lesson with no note, because the pull request has nothing to say", () => {
    const unexplained = { learned: true, note: "", memory: memory("- (2026-09-21, #61) Something.") };

    expect(checkProposal({ proposal: unexplained, current }).reason).toContain("no note");
  });

  it("makes no change when the rewrite says exactly what the file already says", () => {
    const same = { learned: true, note: "n", memory: `${current}\r\n` };

    const verdict = checkProposal({ proposal: same, current });

    expect(verdict.accept).toBe(false);
    expect(verdict.reason).toContain("identical");
  });

  it("refuses a reply GLM never gave", () => {
    expect(checkProposal({ proposal: null, current }).accept).toBe(false);
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
    });

    expect(prompt).toContain("Jin Hong merges as admin");
    expect(prompt).toContain("#61 SCRUM-13 Simplify the filter tabs");
    expect(prompt).toContain("the Submitted tab hides UNDER_REVIEW");
    expect(prompt).toContain("CI failed 1 time(s).");
    expect(prompt).toContain("app/page.tsx");
    expect(prompt).not.toContain("not been merged yet");
  });

  it("says when the memory carries lessons still waiting in an open proposal", () => {
    const prompt = buildMemoryPrompt({ current, pending: true, pr, review: "", ci: "", stat: "" });

    expect(prompt).toContain("not been merged yet");
    expect(prompt).toContain("No CI result was found");
  });
});

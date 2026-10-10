import { describe, it, expect } from "vitest";

import {
  buildSystemPrompt,
  checkCompletion,
  countBlocking,
  describeTestFile,
  extractStoryKeys,
  fenceFor,
  fileLink,
  filesMentioningStories,
  extractFailedSteps,
  findChangedAssertions,
  renderChangedAssertions,
  numberLines,
  parseLcov,
  renderCiResults,
  excerptFile,
  renderContextFiles,
  renderProjectRuleScan,
  resolveImports,
  scanProjectRules,
  selectContextFiles,
  summariseCoverage,
  locationFor,
  parseDiff,
  parseReview,
  renderConversation,
  renderReview,
  renderTestInventory,
  renderTooLargeReview,
} from "../../.github/scripts/ai-review.mjs";

// SCRUM-88 — the GLM reviewer's pure logic. Line numbers must match git's
// new-side numbering exactly, or every "Where:" reference points at the wrong
// line; story keys decide which acceptance criteria GLM checks; the reply
// parser, the blocking rule and the renderer decide what is posted on the PR
// and whether its check turns red.

type Severity = "critical" | "high" | "medium" | "low";

function finding(severity: Severity, title: string, extra: Record<string, unknown> = {}) {
  return { path: "src/a.ts", line: 11, severity, title, detail: "", suggestion: "", ...extra };
}

/** The file's own characters, without the note that says it was shortened. */
function fileOnly(content: string): string {
  return content.replace(/\n\n\[truncated at [\d,]+ characters\]$/, "");
}

describe("parseDiff", () => {
  it("numbers added and context lines, and treats header-looking lines inside a hunk as content", () => {
    const diff = [
      "diff --git a/src/a.ts b/src/a.ts",
      "index 1111111..2222222 100644",
      "--- a/src/a.ts",
      "+++ b/src/a.ts",
      "@@ -10,4 +10,4 @@ function f() {",
      " keep",
      "--- removed line that looks like a header",
      "+++ added line that looks like a header",
      " tail",
    ].join("\n");

    const { annotated, commentable } = parseDiff(diff);

    expect([...commentable.get("src/a.ts")!]).toEqual([10, 11, 12]);
    expect(commentable.size).toBe(1);
    expect(annotated).toContain("11\t+++ added line that looks like a header");
    expect(annotated).toContain("\t--- removed line that looks like a header");
  });

  it("restarts numbering per hunk and per file", () => {
    const diff = [
      "diff --git a/src/a.ts b/src/a.ts",
      "--- a/src/a.ts",
      "+++ b/src/a.ts",
      "@@ -1,2 +1,3 @@",
      " one",
      "+two",
      " three",
      "@@ -40,2 +41,2 @@",
      "-old",
      "+new",
      " end",
      "diff --git a/src/new.ts b/src/new.ts",
      "new file mode 100644",
      "--- /dev/null",
      "+++ b/src/new.ts",
      "@@ -0,0 +1,2 @@",
      "+first",
      "+second",
    ].join("\n");

    const { commentable } = parseDiff(diff);

    expect([...commentable.get("src/a.ts")!]).toEqual([1, 2, 3, 41, 42]);
    expect([...commentable.get("src/new.ts")!]).toEqual([1, 2]);
  });

  it("gives deleted files no lines and ignores the no-newline marker", () => {
    const diff = [
      "diff --git a/src/gone.ts b/src/gone.ts",
      "deleted file mode 100644",
      "--- a/src/gone.ts",
      "+++ /dev/null",
      "@@ -1,2 +0,0 @@",
      "-a",
      "-b",
      "diff --git a/src/c.ts b/src/c.ts",
      "--- a/src/c.ts",
      "+++ b/src/c.ts",
      "@@ -1 +1 @@",
      "-x",
      "\\ No newline at end of file",
      "+y",
      "\\ No newline at end of file",
    ].join("\n");

    const { commentable } = parseDiff(diff);

    expect(commentable.has("src/gone.ts")).toBe(false);
    expect([...commentable.get("src/c.ts")!]).toEqual([1]);
  });
});

describe("extractStoryKeys", () => {
  it("reads every story from a multi-story branch name, title and description, without duplicates", () => {
    expect(
      extractStoryKeys(
        "SCRUM-13-15-16-84-events",
        "SCRUM-13 SCRUM-15 — Event requests",
        "Closes SCRUM-16\nCloses scrum-99",
      ),
    ).toEqual(["SCRUM-13", "SCRUM-15", "SCRUM-16", "SCRUM-84", "SCRUM-99"]);
  });

  it("stops at the first word, so a trailing number in the branch isn't a story", () => {
    expect(extractStoryKeys("SCRUM-89-node-24", "", "")).toEqual(["SCRUM-89"]);
  });

  it("finds nothing when the PR names no story, and caps the list at 6", () => {
    expect(extractStoryKeys("fix-typo", "Fix a typo", undefined)).toEqual([]);
    expect(extractStoryKeys("SCRUM-1-2-3-4-5-6-7-8", "", "")).toHaveLength(6);
  });

  it("ignores a key the description only mentions in passing", () => {
    const description = [
      "The stale footer showed on #24, which rendered a SCRUM-31 acceptance table.",
      "",
      "Part of SCRUM-88.",
      "- Closes SCRUM-19 and SCRUM-20",
    ].join("\n");

    expect(extractStoryKeys("docs-footer", "Fix the review footer", description)).toEqual([
      "SCRUM-88",
      "SCRUM-19",
      "SCRUM-20",
    ]);
  });
});

describe("parseReview", () => {
  it("extracts the JSON from a fenced reply with surrounding prose and normalises findings", () => {
    const reply = [
      "Here is my review:",
      "```json",
      JSON.stringify({
        summary: "Adds X.",
        findings: [
          { path: "b/src/a.ts", line: "11", severity: "BLOCKER", title: "Unknown severity", detail: "d" },
          { path: "src/a.ts", line: 0, severity: " CRITICAL ", title: "Bad line" },
          { path: "src/a.ts" },
        ],
      }),
      "```",
      "Thanks",
    ].join("\n");

    const review = parseReview(reply);

    expect(review.summary).toBe("Adds X.");
    expect(review.findings).toHaveLength(2);
    // Sorted most severe first: the critical finding moves ahead.
    expect(review.findings[0]).toMatchObject({ title: "Bad line", severity: "critical", line: null });
    expect(review.findings[1]).toMatchObject({ path: "src/a.ts", line: 11, severity: "medium" });
    expect(review.acceptance).toEqual([]);
  });

  it("does not accept inherited object keys such as toString as a severity or status", () => {
    const review = parseReview(
      JSON.stringify({
        summary: "",
        findings: [{ path: "a.ts", line: 1, severity: "toString", title: "Sneaky" }],
        acceptance: [{ story: "scrum-13", criterion: "Saves a draft", status: "constructor", evidence: "" }],
      }),
    );

    expect(review.findings[0].severity).toBe("medium");
    expect(review.acceptance[0]).toMatchObject({ story: "SCRUM-13", status: "unclear" });
  });

  it("normalises acceptance criteria and drops entries without a criterion", () => {
    const review = parseReview(
      JSON.stringify({
        summary: "",
        findings: [],
        acceptance: [
          {
            story: "SCRUM-31",
            criterion: "Over-allocation shows the shortfall",
            status: "MET",
            testedBy: " unit: tests/reservation.test.ts; e2e: none ",
            evidence: "actions.ts:125",
          },
          { story: "SCRUM-31", criterion: "  ", status: "met" },
          { story: "SCRUM-31", criterion: "Zero quantity is rejected", status: "partial" },
        ],
      }),
    );

    expect(review.acceptance).toEqual([
      {
        story: "SCRUM-31",
        criterion: "Over-allocation shows the shortfall",
        status: "met",
        testedBy: "unit: tests/reservation.test.ts; e2e: none",
        evidence: "actions.ts:125",
      },
      { story: "SCRUM-31", criterion: "Zero quantity is rejected", status: "partial", testedBy: "", evidence: "" },
    ]);
  });

  it("orders findings critical, high, medium, low and caps them at 10", () => {
    const severities: Severity[] = ["low", "medium", "high", "critical"];
    const findings = Array.from({ length: 16 }, (_, i) => ({
      path: "a.ts",
      line: i + 1,
      severity: severities[i % 4],
      title: `F${i}`,
    }));

    const parsed = parseReview(JSON.stringify({ summary: "", findings })).findings;

    expect(parsed).toHaveLength(10);
    expect(parsed.slice(0, 4).every((f: { severity: string }) => f.severity === "critical")).toBe(true);
    expect(parsed.slice(4, 8).every((f: { severity: string }) => f.severity === "high")).toBe(true);
  });

  it("throws on a reply with no JSON, so the PR is told the review did not complete", () => {
    expect(() => parseReview("Sorry, I cannot help with that.")).toThrow(/did not return a JSON review/);
  });
});

describe("countBlocking", () => {
  it("counts only critical findings, which fail the required check", () => {
    const findings = [finding("critical", "a"), finding("high", "b"), finding("medium", "c"), finding("low", "d")];

    expect(countBlocking(findings)).toBe(1);
    expect(countBlocking([finding("high", "b"), finding("medium", "c"), finding("low", "d")])).toBe(0);
  });
});

describe("checkCompletion", () => {
  const usage = { completion_tokens: 64000, completion_tokens_details: { reasoning_tokens: 63900 } };

  it("accepts an answer that finished normally", () => {
    expect(() => checkCompletion({ content: '{"summary":"ok"}', finishReason: "stop", usage })).not.toThrow();
  });

  it("explains a run cut off while still thinking, with its token counts", () => {
    expect(() => checkCompletion({ content: "", finishReason: "length", usage })).toThrow(
      "GLM stopped before answering: it reached the output token limit while still thinking after 64,000 output tokens (63,900 thinking).",
    );
  });

  it("rejects an empty answer even when GLM says it stopped normally", () => {
    expect(() => checkCompletion({ content: "  ", finishReason: "stop", usage: null })).toThrow(
      "GLM stopped before answering: it finished with an empty answer.",
    );
  });

  it("names an unknown or missing finish reason instead of guessing", () => {
    expect(() => checkCompletion({ content: "", finishReason: "constructor", usage: null })).toThrow(
      'finish_reason "constructor"',
    );
    expect(() => checkCompletion({ content: "", finishReason: null, usage: null })).toThrow(
      "the stream ended without a finish reason",
    );
  });
});

describe("describeTestFile and renderTestInventory", () => {
  it("reads Vitest titles through .each and .skipIf, and calls a mocked database a unit test", () => {
    const source = [
      'vi.mock("@/lib/db", () => ({ prisma: {} }));',
      'describe("createReservation — SCRUM-31", () => {',
      '  it("AC 3: over-allocation is refused", async () => {});',
      '  it.each([0, -1, ""])("AC 6: quantity %s is invalid", async () => {});',
      "  it(\"doesn't count a touching period\", () => {});",
      "});",
      'describe.skipIf(!usesLocalDatabase)("last unit race", () => {});',
    ].join("\n");

    expect(describeTestFile("tests/reservation.test.ts", source)).toEqual({
      path: "tests/reservation.test.ts",
      kind: "unit (Vitest, database mocked)",
      titles: [
        { group: true, title: "createReservation — SCRUM-31" },
        { group: false, title: "AC 3: over-allocation is refused" },
        { group: false, title: "AC 6: quantity %s is invalid" },
        { group: false, title: "doesn't count a touching period" },
        { group: true, title: "last unit race" },
      ],
    });
  });

  it("recognises a Playwright file, a test.describe group, and skips hooks", () => {
    const source = [
      'test.describe("Equipment — SCRUM-31", () => {',
      "  test.beforeEach(async ({ page }) => {});",
      '  test("tech support reserves equipment", async ({ page }) => {});',
      "});",
    ].join("\n");

    const file = describeTestFile("e2e/equipment.spec.ts", source);

    expect(file.kind).toBe("e2e (Playwright)");
    expect(file.titles).toEqual([
      { group: true, title: "Equipment — SCRUM-31" },
      { group: false, title: "tech support reserves equipment" },
    ]);
  });

  it("doesn't call a Vitest file without a database mock a unit test", () => {
    expect(describeTestFile("tests/concurrency.test.ts", 'it("only one wins", () => {});').kind).toBe(
      "integration or unit (Vitest, real database or none)",
    );
  });

  it("takes the kind from the tests/unit and tests/integration folders, whatever the file mocks", () => {
    const mocked = 'vi.mock("@/lib/db", () => ({}));\nit("a", () => {});';

    expect(describeTestFile("tests/integration/concurrency.test.ts", mocked).kind).toBe(
      "integration (Vitest, real database)",
    );
    expect(describeTestFile("tests/unit/nav.test.ts", 'it("a", () => {});').kind).toBe("unit (Vitest)");
  });

  it("lists each file with its kind and indented titles, and says when there are none", () => {
    const text = renderTestInventory([
      {
        path: "e2e/a.spec.ts",
        kind: "e2e (Playwright)",
        titles: [
          { group: true, title: "A" },
          { group: false, title: "works" },
        ],
      },
    ]);

    expect(text).toBe("### e2e/a.spec.ts — e2e (Playwright)\n- A\n  - works");
    expect(renderTestInventory([])).toBe("There are no test files under tests/ or e2e/.");
  });
});

describe("it.todo placeholders in the test list", () => {
  it("marks it.todo titles so a placeholder isn't read as coverage", () => {
    const source = 'describe("race", () => {\n  it.todo("last place goes to one of two (SCRUM-74)");\n  it("real", () => {});\n});';

    const file = describeTestFile("tests/integration/concurrency.test.ts", source);

    expect(file.titles).toEqual([
      { group: true, title: "race" },
      { group: false, title: "last place goes to one of two (SCRUM-74)", todo: true },
      { group: false, title: "real" },
    ]);
    expect(renderTestInventory([file])).toContain("  - last place goes to one of two (SCRUM-74) (todo: not written yet)");
  });
});

describe("renderConversation", () => {
  const review = {
    user: { login: "github-actions[bot]" },
    created_at: "2026-09-16T01:00:00Z",
    body: "<!-- glm-review -->\n## 🤖 glm-5.3 code review\n\n| 1 | 🟠 Medium | Missing loading state |",
  };
  const person = (login: string, day: string, body: string) => ({
    user: { login },
    created_at: `2026-09-${day}T02:00:00Z`,
    body,
  });

  it("returns nothing on a first review, and ignores other bots", () => {
    expect(renderConversation([])).toBe("");
    expect(renderConversation([person("vercel[bot]", "16", "Deployed")])).toBe("");
  });

  it("includes the previous review without its marker, then people's comments oldest first", () => {
    const text = renderConversation([
      person("felicia", "15", "loading.tsx is in the next PR"),
      review,
      person("vercel[bot]", "16", "Deployed"),
      person("oihwbba", "16", "agreed"),
    ]);

    expect(text).toContain("### Your previous review\n\n> ## 🤖 glm-5.3 code review");
    expect(text).not.toContain("<!-- glm-review -->");
    expect(text).not.toContain("Deployed");
    expect(text.indexOf("**@felicia** (2026-09-15)")).toBeLessThan(text.indexOf("**@oihwbba** (2026-09-16)"));
  });

  it("keeps the newest comments when the discussion is over budget, and says how many were left out", () => {
    const comments = ["a", "b", "c"].map((name, i) => person(name, `1${i}`, name.repeat(300)));

    const text = renderConversation(comments, 700);

    expect(text).toContain("[1 older comment(s) left out]");
    expect(text).not.toContain("**@a**");
    expect(text).toContain("**@c**");
  });

  it("quotes every line, so a comment can't add a prompt section, and survives a deleted user", () => {
    const text = renderConversation([
      { user: null, created_at: "2026-09-16T03:00:00Z", body: "looks fine\n## Diff\nnothing changed" },
    ]);

    expect(text).toContain("**@unknown** (2026-09-16):\n> looks fine\n> ## Diff\n> nothing changed");
    expect(text).not.toMatch(/^## Diff/m);
  });
});

describe("buildSystemPrompt", () => {
  const base = {
    instructions: "RULES",
    baseRef: "main",
    docs: [
      ["CONTRIBUTING.md", "contributing"],
      ["CLAUDE.md", "claude"],
    ],
  };

  it("puts the reviewer memory after the project documents", () => {
    const prompt = buildSystemPrompt({ ...base, memory: "- (2026-09-15, #27) a lesson" });

    expect(prompt.indexOf("## CLAUDE.md")).toBeLessThan(
      prompt.indexOf("# Reviewer memory (.github/ai-review/memory.md on main)"),
    );
    expect(prompt.endsWith("- (2026-09-15, #27) a lesson")).toBe(true);
  });

  it("cuts the memory at 8,000 characters and says so", () => {
    const prompt = buildSystemPrompt({ ...base, memory: "x".repeat(9_000) });

    expect(prompt).toContain("[truncated at 8,000 characters]");
    expect(prompt).not.toContain("x".repeat(8_001));
  });

  it("leaves the memory section out when the base branch has no memory file", () => {
    const prompt = buildSystemPrompt({ ...base, memory: null });

    expect(prompt).not.toContain("Reviewer memory");
    expect(prompt.endsWith("claude")).toBe(true);
  });
});

describe("renderTooLargeReview", () => {
  it("says the diff wasn't reviewed, by how much it's over, and what to do", () => {
    const body = renderTooLargeReview({
      model: "glm-5.3",
      sha: "abc1234def5678",
      size: 412_345,
      max: 400_000,
      runUrl: "https://run",
    });

    expect(body.startsWith("<!-- glm-review -->")).toBe(true);
    expect(body).toContain(
      "❌ **Too large to review** for commit `abc1234`: the reviewable diff is 412,345 characters, over the 400,000-character limit",
    );
    expect(body).toContain("so this check failed");
    expect(body).toContain("Split the pull request");
    expect(body).toContain("no GLM call made · [workflow run](https://run)");
  });
});

describe("parseDiff added lines", () => {
  it("records only the lines the PR added, not unchanged context", () => {
    const diff = ["diff --git a/src/a.ts b/src/a.ts", "--- a/src/a.ts", "+++ b/src/a.ts", "@@ -1,3 +1,4 @@", " keep", "+new one", "-old", "+new two", " tail"].join("\n");

    const { added, commentable } = parseDiff(diff);

    expect([...added.get("src/a.ts")!]).toEqual([2, 3]);
    expect([...commentable.get("src/a.ts")!]).toEqual([1, 2, 3, 4]);
  });
});

describe("findChangedAssertions and renderChangedAssertions", () => {
  const diffOf = (path: string, hunk: string, lines: string[]) =>
    [`diff --git a/${path} b/${path}`, `--- a/${path}`, `+++ b/${path}`, hunk, ...lines].join("\n");

  it("pairs a narrowed assertion with the lines that replaced it (#41)", () => {
    const diff = diffOf("e2e/events.spec.ts", "@@ -10,3 +10,5 @@", [
      " test(\"isolation\", async ({ page }) => {",
      '-  await expect(page.getByText("Draft — Annual Tech Summit")).not.toBeVisible();',
      "+  await expect(",
      '+    page.getByRole("cell", { name: "Draft — Annual Tech Summit" }),',
      "+  ).not.toBeVisible();",
      " });",
    ]);

    const { changes, skips } = findChangedAssertions(diff);

    expect(skips).toEqual([]);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ path: "e2e/events.spec.ts", oldLine: 11, newLine: 11, deleted: false });
    expect(changes[0].removed[0]).toContain("getByText");
    expect(changes[0].added[1]).toContain('getByRole("cell"');
  });

  it("ignores edits that remove no assertion and files that aren't tests", () => {
    const comment = diffOf("tests/unit/a.test.ts", "@@ -1,1 +1,1 @@", ["-// old note", "+// new note"]);
    const source = diffOf("lib/a.ts", "@@ -1,1 +1,1 @@", ["-expect(x).toBe(1);", "+expect(x).toBe(2);"]);

    expect(findChangedAssertions(`${comment}\n${source}`).changes).toEqual([]);
  });

  it("lists a deleted test file's checks, and new skips and .only", () => {
    const deleted = [
      "diff --git a/tests/unit/gone.test.ts b/tests/unit/gone.test.ts",
      "--- a/tests/unit/gone.test.ts",
      "+++ /dev/null",
      "@@ -1,3 +0,0 @@",
      '-it("refuses an organiser", () => {',
      "-  const r = run();",
      "-  expect(r.ok).toBe(false);",
    ].join("\n");
    const skipped = diffOf("e2e/a.spec.ts", "@@ -1,0 +1,1 @@", ['+test.skip("flaky", async () => {});']);

    const result = findChangedAssertions(`${deleted}\n${skipped}`);

    expect(result.changes).toEqual([
      expect.objectContaining({
        path: "tests/unit/gone.test.ts",
        deleted: true,
        removed: ['it("refuses an organiser", () => {', "  expect(r.ok).toBe(false);"],
      }),
    ]);
    expect(result.skips).toEqual(['e2e/a.spec.ts:1: test.skip("flaky", async () => {});']);
    const text = renderChangedAssertions(result);
    expect(text).toContain("(file deleted)");
    expect(text).toContain("Replaced by: nothing in this file");
    expect(text).toContain("### Tests skipped or narrowed with .only");
  });

  it("catches a locator narrowed inside an unchanged multi-line expect (#43 review)", () => {
    const diff = diffOf("e2e/events.spec.ts", "@@ -20,3 +20,3 @@", [
      "   await expect(",
      '-    page.getByText("Draft — Annual Tech Summit"),',
      '+    page.getByRole("cell", { name: "Draft — Annual Tech Summit" }),',
      "   ).not.toBeVisible();",
    ]);

    const { changes } = findChangedAssertions(diff);

    expect(changes).toHaveLength(1);
    expect(changes[0].removed).toEqual(['    page.getByText("Draft — Annual Tech Summit"),']);
    expect(renderChangedAssertions({ changes, skips: [] })).toContain("Replaced by:");
  });

  it("catches an edited expected value inside a multi-line toEqual", () => {
    const diff = diffOf("tests/unit/a.test.ts", "@@ -5,4 +5,4 @@", [
      "   expect(result).toEqual({",
      "     ok: false,",
      '-    error: "Not found",',
      "+    error: expect.any(String),",
      "   });",
    ]);

    const [change] = findChangedAssertions(diff).changes;

    expect(change.before).toEqual(["  expect(result).toEqual({", "    ok: false,"]);
    expect(renderChangedAssertions({ changes: [change], skips: [] })).toContain("Unchanged lines just before:");
  });

  it("doesn't treat .toString() or .toISOString() as an assertion (#43 review)", () => {
    const diff = diffOf("tests/unit/a.test.ts", "@@ -1,2 +1,2 @@", [
      "-const iso = start.toISOString();",
      "+const iso = start.toISOString().slice(0, 10);",
      "-const label = id.toString();",
      "+const label = String(id);",
      " const x = 1;",
    ]);

    expect(findChangedAssertions(diff).changes).toEqual([]);
  });

  it("flags .only, .todo and xit, lists skips first, and caps long blocks (#43 review)", () => {
    const skips = diffOf("tests/unit/a.test.ts", "@@ -1,0 +1,3 @@", [
      '+it.only("just this one", () => {});',
      '+describe.todo("later");',
      '+xit("off", () => {});',
    ]);
    const long = diffOf("tests/unit/b.test.ts", "@@ -1,35 +1,0 @@", [
      ...Array.from({ length: 35 }, (_, i) => `-  expect(value${i}).toBe(${i});`),
    ]);

    const result = findChangedAssertions(`${skips}\n${long}`);

    expect(result.skips).toEqual([
      'tests/unit/a.test.ts:1: it.only("just this one", () => {});',
      'tests/unit/a.test.ts:2: describe.todo("later");',
      'tests/unit/a.test.ts:3: xit("off", () => {});',
    ]);
    const full = renderChangedAssertions(result);
    expect(full.indexOf("### Tests skipped")).toBeLessThan(full.indexOf("### 1."));
    expect(full).toContain("-… 5 more line(s)");
    expect(renderChangedAssertions(result, 200)).toContain("[truncated at 200 characters]");
    expect(renderChangedAssertions(result, 200)).toContain("it.only");
  });

  it("says so when no test changed", () => {
    expect(renderChangedAssertions({ changes: [], skips: [] })).toBe(
      "No test or assertion was removed, changed or skipped.",
    );
  });
});

describe("context beyond the diff", () => {
  const file = (path: string, content: string) => ({ path, content });

  it("numbers every line of a file", () => {
    expect(numberLines("a\nb")).toBe("1\ta\n2\tb");
  });

  it("resolves @/ and relative imports to repo files, and ignores packages and missing files", () => {
    const paths = new Set([
      "components/ui/table.tsx",
      "app/(app)/events/actions.ts",
      "app/(app)/events/events-list.module.css",
      "lib/auth/index.ts",
    ]);
    const source = [
      'import { Table } from "@/components/ui/table";',
      'import { createDraftEvent } from "./actions";',
      'import styles from "./events-list.module.css";',
      'import { can } from "../../../lib/auth";',
      'import { useState } from "react";',
      'import { gone } from "@/lib/missing";',
      'const lazy = import("./actions");',
    ].join("\n");

    expect(resolveImports("app/(app)/events/events-client.tsx", source, paths).sort()).toEqual([
      "app/(app)/events/actions.ts",
      "app/(app)/events/events-list.module.css",
      "components/ui/table.tsx",
      "lib/auth/index.ts",
    ]);
  });

  it("finds files naming a story key, without matching a longer number", () => {
    const files = [
      file("tests/unit/reservation.test.ts", 'describe("createReservation — SCRUM-31", () => {});'),
      file("app/(app)/x.ts", "// SCRUM-310 is a different story"),
      file("app/(app)/y.ts", "// scrum-31 in lower case"),
    ];

    expect(filesMentioningStories(files, ["SCRUM-31"])).toEqual(["tests/unit/reservation.test.ts", "app/(app)/y.ts"]);
  });

  it("sends changed files first, then imports, importers and story files, and lists what didn't fit", () => {
    const files = [
      file("app/(app)/events/events-client.tsx", 'import { Table } from "@/components/ui/table";\n// changed'),
      file("components/ui/table.tsx", "export function Table() {}"),
      file("app/(app)/events/page.tsx", 'import { EventsClient } from "./events-client";'),
      file("tests/unit/events.test.ts", 'describe("User Story 84 — SCRUM-84", () => {});'),
      file("tests/unit/ai-review.test.ts", "SCRUM-84 fixture text"),
      file("lib/unrelated.ts", "export const x = 1;"),
    ];

    const { included, omitted } = selectContextFiles({
      files,
      changed: ["app/(app)/events/events-client.tsx", "README.md"],
      storyKeys: ["SCRUM-84"],
    });

    expect(included.map((f) => [f.path, f.reason])).toEqual([
      ["app/(app)/events/events-client.tsx", "changed in this PR"],
      ["components/ui/table.tsx", "imported by a changed file"],
      ["app/(app)/events/page.tsx", "imports a changed file"],
      ["tests/unit/events.test.ts", "mentions SCRUM-84"],
    ]);
    expect(omitted).toEqual([]);

    const small = selectContextFiles({
      files,
      changed: ["app/(app)/events/events-client.tsx"],
      storyKeys: ["SCRUM-84"],
      maxRelated: 30,
    });
    expect(small.included.map((f) => f.path)).toEqual(["app/(app)/events/events-client.tsx", "components/ui/table.tsx"]);
    expect(small.omitted.map((f) => f.path)).toEqual(["app/(app)/events/page.tsx", "tests/unit/events.test.ts"]);
    expect(renderContextFiles(small)).toContain(
      "### Not included (did not fit the context budget)\n\n- app/(app)/events/page.tsx (imports a changed file)",
    );
  });

  // SCRUM-111 — the pull request's own files are what the review judges, so a
  // changed file that overshoots is shortened, never dropped. #54 lost a
  // changed test file by 1,656 characters and then reviewed its test coverage
  // without it.
  it("shortens a changed file that overshoots instead of dropping it", () => {
    const long = "x".repeat(40_000);
    const files = [file("tests/unit/events.test.ts", long), file("lib/small.ts", "export const x = 1;")];

    const { included, omitted } = selectContextFiles({
      files,
      changed: ["tests/unit/events.test.ts"],
      storyKeys: [],
      maxChanged: 20_000,
    });

    expect(omitted).toEqual([]);
    expect(included).toHaveLength(1);
    expect(included[0].path).toBe("tests/unit/events.test.ts");
    expect(included[0].reason).toBe("changed in this PR, shortened to fit");
    expect(included[0].content.length).toBeLessThanOrEqual(20_000);
    expect(included[0].content).toContain("truncated");
  });

  it("drops a changed file only when too little of it would fit", () => {
    const files = [file("tests/unit/events.test.ts", "y".repeat(40_000))];

    const { included, omitted } = selectContextFiles({
      files,
      changed: ["tests/unit/events.test.ts"],
      storyKeys: [],
      maxChanged: 2_000,
    });

    expect(included).toEqual([]);
    expect(omitted.map((f) => f.path)).toEqual(["tests/unit/events.test.ts"]);
  });

  // SCRUM-111 — changed files arrive in diff order and each took whatever
  // budget was left, so the first of a wide PR could starve the last below the
  // floor and drop it: the #54 loss again, one file further down the diff.
  it("gives every changed file its floor instead of letting the first ones eat the budget", () => {
    const paths = ["a.ts", "b.ts", "c.ts"];
    const files = paths.map((path) => file(path, "x".repeat(40_000)));

    const { included, omitted } = selectContextFiles({
      files,
      changed: paths,
      storyKeys: [],
      maxChanged: 30_000,
    });

    expect(omitted).toEqual([]);
    expect(included.map((f) => f.path)).toEqual(paths);
    for (const entry of included) {
      expect(entry.reason).toBe("changed in this PR, shortened to fit");
      // The floor is 8,000 characters of the file. Measuring the note as well
      // would let 7,970 characters plus a note pass as a floor of 8,000.
      expect(fileOnly(entry.content).length).toBeGreaterThanOrEqual(8_000);
    }
    const total = included.reduce((sum, entry) => sum + entry.content.length, 0);
    expect(total).toBeLessThanOrEqual(30_000);
  });

  // SCRUM-111 — the reserve first covered only the shortening path, so three
  // files that each fitted could still spend the budget and leave the last
  // with nothing: the same loss by a different route.
  it("keeps a file that fits whole from spending what the files behind it need", () => {
    const paths = ["a.ts", "b.ts", "c.ts"];
    const files = [file("a.ts", "x".repeat(25_000)), file("b.ts", "y".repeat(40_000)), file("c.ts", "z".repeat(40_000))];

    const { included, omitted } = selectContextFiles({
      files,
      changed: paths,
      storyKeys: [],
      maxChanged: 30_000,
    });

    expect(omitted).toEqual([]);
    expect(included.map((f) => f.path)).toEqual(paths);
    for (const entry of included) {
      expect(fileOnly(entry.content).length).toBeGreaterThanOrEqual(8_000);
    }
  });

  // A file shorter than the floor needs only its own length. Reserving a whole
  // floor for it would shorten an earlier file to make room nobody wanted.
  it("reserves only what a small file behind it actually needs", () => {
    const files = [file("big.ts", "x".repeat(40_000)), file("one.ts", "a"), file("two.ts", "b")];

    const { included, omitted } = selectContextFiles({
      files,
      changed: ["big.ts", "one.ts", "two.ts"],
      storyKeys: [],
      maxChanged: 30_000,
    });

    expect(omitted).toEqual([]);
    expect(included.map((f) => f.content)).toEqual([expect.stringContaining("truncated"), "a", "b"]);
    // The big file keeps nearly the whole budget: two characters were held back.
    expect(fileOnly(included[0].content).length).toBeGreaterThan(29_000);
  });

  // SCRUM-111 — an e2e test can only assert what the seed writes. #53 broke CI
  // by hard-coding one of the two seeded coordinators.
  it("sends the seed when the PR touches an e2e spec, and not otherwise", () => {
    const files = [
      file("e2e/events.spec.ts", 'test("x", async () => {});'),
      file("lib/thing.ts", "export const x = 1;"),
      file("prisma/seed.ts", "const users = [];"),
    ];

    const withE2e = selectContextFiles({
      files,
      changed: ["e2e/events.spec.ts"],
      storyKeys: [],
    });
    expect(withE2e.included.map((f) => [f.path, f.reason])).toContainEqual([
      "prisma/seed.ts",
      "seeded data the e2e tests assert against",
    ]);

    const withoutE2e = selectContextFiles({
      files,
      changed: ["lib/thing.ts"],
      storyKeys: [],
    });
    expect(withoutE2e.included.map((f) => f.path)).not.toContain("prisma/seed.ts");
  });

  // SCRUM-111 — #153 to #156 each lost prisma/schema.prisma and the seed, and
  // #154 lost 30 files, because unchanged tests that merely import a changed
  // file were sent first and a related file that didn't fit was dropped whole.
  it("SCRUM-111: sends the seed and story-relevant source before tests that merely import a changed file", () => {
    const files = [
      file("lib/changed.ts", "export const x = 1;"),
      file("tests/unit/aaa.test.ts", 'import { x } from "@/lib/changed";\n' + "t".repeat(500)),
      file("prisma/schema.prisma", "// SCRUM-48 notifications\n" + "s".repeat(300)),
      file("prisma/seed.ts", "const users = [];"),
      file("e2e/x.spec.ts", 'test("x", async () => {});'),
    ];

    const { included } = selectContextFiles({
      files,
      changed: ["lib/changed.ts", "e2e/x.spec.ts"],
      storyKeys: ["SCRUM-48"],
      maxRelated: 400,
    });

    expect(included.map((f) => [f.path, f.reason])).toEqual([
      ["lib/changed.ts", "changed in this PR"],
      ["e2e/x.spec.ts", "changed in this PR"],
      ["prisma/seed.ts", "seeded data the e2e tests assert against"],
      ["prisma/schema.prisma", "mentions SCRUM-48"],
      ["tests/unit/aaa.test.ts", "imports a changed file, excerpt"],
    ]);
  });

  it("SCRUM-111: sends a story file that doesn't fit whole as the lines around its mentions, numbered as in the file", () => {
    const lines = Array.from({ length: 200 }, (_, i) => `line ${i + 1}`);
    lines[99] = "/// SCRUM-48 AC8 — not shown before this time.";
    const files = [
      file("lib/changed.ts", "export const x = 1;"),
      file("prisma/schema.prisma", lines.join("\n")),
    ];

    const { included, omitted } = selectContextFiles({
      files,
      changed: ["lib/changed.ts"],
      storyKeys: ["SCRUM-48"],
      maxRelated: 1_000,
    });

    expect(omitted).toEqual([]);
    const schema = included.find((f) => f.path === "prisma/schema.prisma")!;
    expect(schema.reason).toBe("mentions SCRUM-48, excerpt");
    const shown = schema.content.split("\n");
    expect(shown[0]).toBe("…");
    expect(shown[1]).toBe("88\tline 88");
    expect(shown).toContain("100\t/// SCRUM-48 AC8 — not shown before this time.");
    expect(shown.at(-2)).toBe("112\tline 112");
    expect(shown.at(-1)).toBe("…");
    // Already numbered: the rendering doesn't number it again.
    expect(renderContextFiles({ included, omitted })).toContain(
      "### prisma/schema.prisma (mentions SCRUM-48, excerpt)\n\n…\n88\tline 88",
    );
  });

  it("SCRUM-111: outlines a test file that doesn't fit whole: its imports and what each test is called", () => {
    const content = [
      'import { describe, it } from "vitest";',
      'import { x } from "@/lib/changed";',
      "",
      'describe("thing", () => {',
      "  const setup = 1;",
      '  it("does one thing", () => {',
      "    expect(x).toBe(1);",
      "  });",
      '  it.each([1, 2])("does %s", () => {});',
      "});",
    ].join("\n");

    expect(excerptFile("tests/unit/thing.test.ts", content, [])).toBe(
      [
        '1\timport { describe, it } from "vitest";',
        '2\timport { x } from "@/lib/changed";',
        "…",
        '4\tdescribe("thing", () => {',
        "…",
        '6\t  it("does one thing", () => {',
        "…",
        '9\t  it.each([1, 2])("does %s", () => {});',
        "…",
      ].join("\n"),
    );
  });

  it("SCRUM-111: outlines a source file that names none of the PR's stories by its imports and exports, and has nothing to excerpt from one with neither", () => {
    const content = ['import { prisma } from "@/lib/db";', "", "const internal = 1;", "export function visible() {", "  return internal;", "}"].join(
      "\n",
    );

    expect(excerptFile("lib/thing.ts", content, ["SCRUM-48"])).toBe(
      ['1\timport { prisma } from "@/lib/db";', "…", "4\texport function visible() {", "…"].join("\n"),
    );
    expect(excerptFile("lib/thing.ts", "const x = 1;", ["SCRUM-48"])).toBeNull();
  });

  // The reserve: a related file is sent whole only if what's left still holds
  // the excerpts of the files behind it. Without it, the source file below is
  // sent whole and the test behind it is dropped.
  it("SCRUM-111: sends a related file as its excerpt when sending it whole would leave a later file no room for its own", () => {
    const source = file("lib/a.ts", ['import { x } from "./changed";', ...Array(80).fill("// body"), "export const a = x;"].join("\n"));
    const test = file(
      "tests/unit/b.test.ts",
      ['import { x } from "@/lib/changed";', ...Array(200).fill("// body"), 'it("b", () => {});'].join("\n"),
    );
    const sourceExcerpt = excerptFile(source.path, source.content, [])!;
    const testExcerpt = excerptFile(test.path, test.content, [])!;
    const files = [file("lib/changed.ts", "export const x = 1;"), source, test];

    const { included, omitted } = selectContextFiles({
      files,
      changed: ["lib/changed.ts"],
      storyKeys: [],
      // Room for the source whole, or for both excerpts, but not the source
      // whole and the test's excerpt.
      maxRelated: source.content.length + testExcerpt.length - 1,
    });

    expect(omitted).toEqual([]);
    expect(included.slice(1).map((f) => [f.path, f.reason, f.content])).toEqual([
      ["lib/a.ts", "imports a changed file, excerpt", sourceExcerpt],
      ["tests/unit/b.test.ts", "imports a changed file, excerpt", testExcerpt],
    ]);
  });

  // The yield: a reserve that can't be met anyway is no reason to cut an
  // earlier file down. The files are in priority order, so it goes first.
  it("SCRUM-111: sends an earlier related file whole when the file behind it can't fit even its excerpt", () => {
    const source = file("lib/a.ts", ['import { x } from "./changed";', "const local = x;", "export const a = local;"].join("\n"));
    const test = file(
      "tests/unit/b.test.ts",
      ['import { x } from "@/lib/changed";', ...Array.from({ length: 40 }, (_, i) => `it("case ${i}", () => {});`)].join("\n"),
    );
    const files = [file("lib/changed.ts", "export const x = 1;"), source, test];
    expect(excerptFile(test.path, test.content, [])!.length).toBeGreaterThan(source.content.length + 50);

    const { included, omitted } = selectContextFiles({
      files,
      changed: ["lib/changed.ts"],
      storyKeys: [],
      maxRelated: source.content.length + 50,
    });

    expect(included.slice(1)).toEqual([{ path: "lib/a.ts", reason: "imports a changed file", content: source.content }]);
    expect(omitted.map((f) => f.path)).toEqual(["tests/unit/b.test.ts"]);
  });

  it("SCRUM-111: sends the head of a related file with nothing to excerpt, capped so the files behind it still fit", () => {
    const files = [
      file("e2e/x.spec.ts", 'test("x", async () => {});'),
      file("prisma/seed.ts", "u".repeat(50_000)),
      file("tests/unit/later.test.ts", 'import { a } from "../../e2e/x.spec";\nit("later", () => {});'),
    ];

    const { included, omitted } = selectContextFiles({
      files,
      changed: ["e2e/x.spec.ts"],
      storyKeys: [],
      maxRelated: 30_000,
    });

    expect(omitted).toEqual([]);
    const seed = included.find((f) => f.path === "prisma/seed.ts")!;
    expect(seed.reason).toBe("seeded data the e2e tests assert against, shortened to fit");
    expect(seed.content.length).toBeLessThanOrEqual(12_000);
  });

  it("scans the branch for role checks outside can(), hard deletes and inline dates", () => {
    const results = scanProjectRules([
      file("app/(app)/equipment/page.tsx", 'const ALLOWED_ROLES: Role[] = ["TECH_SUPPORT"];\nif (!ALLOWED_ROLES.includes(session.user.role)) {}'),
      file("lib/auth/can.ts", 'if (user.role === "ORGANISER") {}'),
      file("app/(app)/equipment/actions.ts", "await prisma.reservation.delete({ where });\nparams.delete(\"q\");"),
      file("lib/datetime.ts", "return date.toLocaleString();"),
      file("components/card.tsx", "{new Date().toLocaleDateString()}"),
      file("tests/unit/x.test.ts", "await prisma.event.delete({});"),
    ]);

    expect(results.map((r) => r.lines)).toEqual([
      [
        'app/(app)/equipment/page.tsx:1: const ALLOWED_ROLES: Role[] = ["TECH_SUPPORT"];',
        "app/(app)/equipment/page.tsx:2: if (!ALLOWED_ROLES.includes(session.user.role)) {}",
      ],
      ["app/(app)/equipment/actions.ts:1: await prisma.reservation.delete({ where });"],
      ["components/card.tsx:1: {new Date().toLocaleDateString()}"],
    ]);
    expect(renderProjectRuleScan([{ rule: "Rule", lines: [] }])).toBe("### Rule\n\nNone found.");
  });

  it("reads lcov and reports which added lines ran, matching absolute report paths", () => {
    const lcov = parseLcov(
      [
        "TN:",
        "SF:/home/runner/work/repo/repo/app/(app)/equipment/actions.ts",
        "DA:10,3",
        "DA:11,0",
        "DA:12,1",
        "end_of_record",
      ].join("\n"),
    );
    const added = new Map([
      ["app/(app)/equipment/actions.ts", new Set([10, 11, 13])],
      ["app/(app)/events/events-client.tsx", new Set([5])],
    ]);

    const coverage = summariseCoverage(lcov, added);

    expect(coverage).toEqual([
      { path: "app/(app)/equipment/actions.ts", measured: true, executable: 2, uncovered: [11] },
      { path: "app/(app)/events/events-client.tsx", measured: false },
    ]);
    const text = renderCiResults({
      url: "https://ci",
      conclusion: "success",
      steps: [
        { name: "Lint", conclusion: "success" },
        { name: "End-to-end tests", conclusion: "failure" },
        { name: "Post job cleanup", conclusion: "skipped" },
      ],
      coverage,
    });
    expect(text).toContain("build-and-test: success (https://ci)");
    expect(text).toContain("- End-to-end tests: failure");
    expect(text).not.toContain("Post job cleanup");
    expect(text).toContain("- app/(app)/equipment/actions.ts: 1 of 2 added executable lines ran; never run: lines 11");
    expect(text).toContain("- app/(app)/events/events-client.tsx: not measured by the coverage configuration");
    expect(renderCiResults(null)).toContain("Don't guess them.");
  });

  it("extracts only the failed step's failure report from a job log", () => {
    const log = [
      "2026-09-16T09:54:50.0000000Z ##[group]Run npm run lint",
      "2026-09-16T09:54:50.0000000Z npm run lint",
      "2026-09-16T09:54:50.0000000Z ##[endgroup]",
      "2026-09-16T09:54:51.0000000Z lint ok",
      "2026-09-16T09:54:52.0000000Z ##[group]Run npm run test:coverage",
      "2026-09-16T09:54:52.0000000Z npm run test:coverage",
      "2026-09-16T09:54:52.0000000Z shell: /usr/bin/bash -e {0}",
      "2026-09-16T09:54:52.0000000Z ##[endgroup]",
      "2026-09-16T09:54:58.0000000Z  [32m✓[39m tests/unit/nav.test.ts (5 tests) 7ms",
      "2026-09-16T09:54:59.0000000Z ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯",
      "2026-09-16T09:54:59.0000000Z  FAIL  tests/integration/a.test.ts > SCRUM-89 > creates the columns",
      "2026-09-16T09:54:59.0000000Z AssertionError: expected 'text' to be 'ARRAY'",
      "2026-09-16T09:54:59.0000000Z ##[error]Process completed with exit code 1.",
      "2026-09-16T09:55:00.0000000Z ##[group]Run actions/upload-artifact@v7",
    ].join("\n");

    const failed = extractFailedSteps(log);

    expect(failed).toEqual([
      {
        command: "npm run test:coverage",
        output: [
          "⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯",
          " FAIL  tests/integration/a.test.ts > SCRUM-89 > creates the columns",
          "AssertionError: expected 'text' to be 'ARRAY'",
        ].join("\n"),
      },
    ]);
    const text = renderCiResults({ url: "https://ci", conclusion: "failure", steps: [], coverage: null, failures: failed });
    expect(text).toContain("### Failed: npm run test:coverage");
    expect(text).toContain("AssertionError: expected 'text' to be 'ARRAY'");
  });

  it("keeps the end of a failed step with no test report, where the error is", () => {
    const log = [
      "##[group]Run npm ci",
      "##[endgroup]",
      ...Array.from({ length: 50 }, (_, i) => `npm error line ${i}`),
      "##[error]Process completed with exit code 1.",
    ].join("\n");

    const [step] = extractFailedSteps(log, 40);

    expect(step.command).toBe("npm ci");
    expect(step.output.startsWith("…")).toBe(true);
    expect(step.output.endsWith("npm error line 49")).toBe(true);
    expect(renderCiResults({ url: "u", conclusion: "failure", steps: [], coverage: null, failures: [] })).toContain(
      "couldn't be read from CI's log",
    );
  });
});

describe("fileLink, locationFor and fenceFor", () => {
  const commentable = new Map([["app/(app)/events/actions.ts", new Set([40, 41, 42])]]);

  it("links to the exact line, encoding route-group parentheses", () => {
    expect(fileLink({ repo: "o/r", sha: "abc123", path: "app/(app)/events/actions.ts", line: 42 })).toBe(
      "https://github.com/o/r/blob/abc123/app/%28app%29/events/actions.ts#L42",
    );
    expect(fileLink({ repo: "o/r", sha: "abc123", path: "src/a.ts", line: null })).toBe(
      "https://github.com/o/r/blob/abc123/src/a.ts",
    );
  });

  it("only gives an exact-line link to a line that is really in the diff", () => {
    const at = (path: string, line: number | null) => locationFor({ repo: "o/r", sha: "abc", commentable, path, line });

    expect(at("app/(app)/events/actions.ts", 42)).toEqual({
      text: "app/(app)/events/actions.ts:42",
      link: "https://github.com/o/r/blob/abc/app/%28app%29/events/actions.ts#L42",
    });
    expect(at("app/(app)/events/actions.ts", 99)).toEqual({
      text: "app/(app)/events/actions.ts:99 (outside the diff)",
      link: "https://github.com/o/r/blob/abc/app/%28app%29/events/actions.ts",
    });
    expect(at("lib/made-up.ts", 7)).toEqual({ text: "lib/made-up.ts:7 (not in the diff)", link: null });
  });

  it("uses a fence longer than any backtick run in the code", () => {
    expect(fenceFor("const x = 1;")).toBe("```");
    expect(fenceFor("```js\nconst x = 1;\n```")).toBe("````");
  });
});

describe("renderReview", () => {
  const base = {
    model: "glm-5.3",
    repo: "o/r",
    sha: "abc1234def5678",
    baseRef: "main",
    commentable: new Map([
      ["app/(app)/events/actions.ts", new Set([42])],
      ["src/a.ts", new Set([11])],
    ]),
    summary: "Adds reservations.",
    stories: [] as string[],
    storiesFound: [] as string[],
    acceptance: [] as { story: string; criterion: string; status: string; testedBy?: string; evidence: string }[],
    notes: [],
    usage: { total_tokens: 12345 },
    seconds: 42,
    runUrl: "https://run",
  };

  it("writes a long review with a blocking verdict, a table and a section per finding", () => {
    const body = renderReview({
      ...base,
      findings: [
        finding("critical", "Unguarded | action", {
          path: "app/(app)/events/actions.ts",
          line: 42,
          detail: "Anyone can call it.",
          suggestion: "requirePermission(user, \"event:create\");",
        }),
        finding("low", "Missing test", { line: null, detail: "Add one." }),
        finding("low", "Invented file", { path: "lib/made-up.ts", line: 3 }),
      ],
    });

    expect(body.startsWith("<!-- glm-review -->")).toBe(true);
    expect(body).toContain("❌ **Blocking issues found:** 1 critical finding(s)");
    expect(body).toContain("1 critical · 2 low");
    expect(body).toContain("### Overview\n\nAdds reservations.");
    expect(body).toContain(
      "| 1 | 🟣 Critical | [`app/(app)/events/actions.ts:42`](https://github.com/o/r/blob/abc1234def5678/app/%28app%29/events/actions.ts#L42) | Unguarded \\| action |",
    );
    expect(body).toContain("### 1. 🟣 Critical: Unguarded | action");
    expect(body).toContain("Anyone can call it.");
    expect(body).toContain('```\nrequirePermission(user, "event:create");\n```');
    expect(body).toContain("**Where:** [`src/a.ts`](https://github.com/o/r/blob/abc1234def5678/src/a.ts)");
    expect(body).toContain("**Where:** `lib/made-up.ts:3 (not in the diff)`");
    expect(body).toContain("12,345 tokens");
    expect(body).toContain("Reviewed against CONTRIBUTING.md, CLAUDE.md, the reviewer memory and the story files on `main`");
    expect(body).toContain("A critical finding fails this required check and blocks the merge (ADR 0008).");
  });

  it("renders the acceptance criteria table for the stories it checked", () => {
    const body = renderReview({
      ...base,
      findings: [],
      stories: ["SCRUM-31", "SCRUM-999"],
      storiesFound: ["SCRUM-31"],
      acceptance: [
        {
          story: "SCRUM-31",
          criterion: "Shows the shortfall",
          status: "met",
          testedBy: "unit: tests/reservation.test.ts",
          evidence: "actions.ts:125",
        },
        { story: "SCRUM-31", criterion: "Last unit | race", status: "missing", evidence: "" },
      ],
    });

    expect(body).toContain("### Acceptance criteria\n\nChecked against: SCRUM-31");
    expect(body).toContain("No `docs/backlog` file on `main` for SCRUM-999");
    expect(body).toContain("| Story | Criterion | Status | Tested by | Evidence |");
    expect(body).toContain("| SCRUM-31 | Shows the shortfall | ✅ Met | unit: tests/reservation.test.ts | actions.ts:125 |");
    expect(body).toContain("| SCRUM-31 | Last unit \\| race | ❌ Missing | — | — |");
  });

  it("says when the PR names no story", () => {
    const body = renderReview({ ...base, findings: [] });

    expect(body).toContain("_No SCRUM story key was found in the branch name, title or a `Closes`/`Part of` line");
  });

  it("marks high, medium and low findings as issues to consider, not blocking", () => {
    const body = renderReview({ ...base, findings: [finding("high", "Crash"), finding("medium", "Edge case")] });

    expect(body).toContain("⚠️ **Issues to consider:** no critical findings, so this doesn't block the merge.");
    expect(body).not.toContain("Blocking issues");
  });

  it("says so when there are no findings", () => {
    const body = renderReview({ ...base, findings: [] });

    expect(body).toContain("✅ **No issues found.**");
    expect(body).not.toContain("Findings at a glance");
  });

  it("keeps a suggested fix containing backticks inside its code block", () => {
    const body = renderReview({
      ...base,
      findings: [finding("medium", "Fence", { suggestion: "```ts\nconst x = 1;\n```" })],
    });

    expect(body).toContain("````\n```ts\nconst x = 1;\n```\n````");
  });
});

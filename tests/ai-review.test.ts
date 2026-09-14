import { describe, it, expect } from "vitest";

import { parseDiff, parseReview, renderBody } from "../.github/scripts/ai-review.mjs";

// SCRUM-88 — the GLM reviewer's pure logic. Line numbers must match git's
// new-side numbering exactly, or every inline comment anchors to the wrong line;
// the reply parser and renderer decide what is posted on the PR.

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

  it("gives deleted files no commentable lines and ignores the no-newline marker", () => {
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

describe("parseReview", () => {
  it("extracts the JSON from a fenced reply with surrounding prose and normalises findings", () => {
    const reply = [
      "Here is my review:",
      "```json",
      JSON.stringify({
        summary: "Adds X.",
        findings: [
          { path: "b/src/a.ts", line: "11", severity: "CRITICAL", title: "Unguarded action", detail: "No requirePermission." },
          { path: "src/a.ts", line: 0, severity: "low", title: "Bad line" },
          { path: "src/a.ts" },
        ],
      }),
      "```",
      "Thanks",
    ].join("\n");

    const review = parseReview(reply);

    expect(review.summary).toBe("Adds X.");
    expect(review.findings).toHaveLength(2);
    expect(review.findings[0]).toMatchObject({ path: "src/a.ts", line: 11, severity: "medium" });
    expect(review.findings[1].line).toBeNull();
  });

  it("caps findings at 10", () => {
    const findings = Array.from({ length: 15 }, (_, i) => ({ path: "a.ts", line: i + 1, severity: "low", title: `F${i}` }));

    expect(parseReview(JSON.stringify({ summary: "", findings })).findings).toHaveLength(10);
  });

  it("throws on a reply with no JSON, so the PR is told the review did not complete", () => {
    expect(() => parseReview("Sorry, I cannot help with that.")).toThrow(/did not return a JSON review/);
  });
});

describe("renderBody", () => {
  const base = { model: "glm-5.3", summary: "Adds X.", notes: [], usage: { total_tokens: 12345 }, seconds: 42, runUrl: "https://run" };

  it("links anchored findings to their comment and keeps unanchored findings' detail", () => {
    const body = renderBody({
      ...base,
      findings: [
        { path: "src/a.ts", line: 11, severity: "high", title: "Unguarded action", detail: "No guard.", suggestion: "" },
        { path: "src/a.ts", line: 99, severity: "low", title: "Off-diff | line", detail: "Line 99 is not in the diff.", suggestion: "" },
      ],
      links: ["https://github.com/o/r/pull/1#discussion_r1"],
    });

    expect(body.startsWith("<!-- glm-single-review -->")).toBe(true);
    expect(body).toContain("[`src/a.ts:11`](https://github.com/o/r/pull/1#discussion_r1)");
    expect(body).toContain("| 2 | 🔵 low | `src/a.ts:99` | Off-diff \\| line |");
    expect(body).toContain("Line 99 is not in the diff.");
    expect(body).not.toContain("No guard.");
    expect(body).toContain("12,345 tokens");
  });

  it("says so when there are no findings", () => {
    expect(renderBody({ ...base, findings: [], links: [] })).toContain("✅ No findings.");
  });
});

import { describe, it, expect } from "vitest";

import {
  countBlocking,
  fenceFor,
  fileLink,
  parseDiff,
  parseReview,
  renderReview,
} from "../.github/scripts/ai-review.mjs";

// SCRUM-88 — the GLM reviewer's pure logic. Line numbers must match git's
// new-side numbering exactly, or every "Where:" reference points at the wrong
// line; the reply parser, the blocking rule and the renderer decide what is
// posted on the PR and whether its check turns red.

type Severity = "critical" | "high" | "medium" | "low";

function finding(severity: Severity, title: string, extra: Record<string, unknown> = {}) {
  return { path: "src/a.ts", line: 11, severity, title, detail: "", suggestion: "", ...extra };
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

describe("parseReview", () => {
  it("extracts the JSON from a fenced reply with surrounding prose and normalises findings", () => {
    const reply = [
      "Here is my review:",
      "```json",
      JSON.stringify({
        summary: "Adds X.",
        findings: [
          { path: "b/src/a.ts", line: "11", severity: "BLOCKER", title: "Unknown severity", detail: "d" },
          { path: "src/a.ts", line: 0, severity: "CRITICAL", title: "Bad line" },
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
  it("counts only critical and high findings, which fail the check", () => {
    const findings = [finding("critical", "a"), finding("high", "b"), finding("medium", "c"), finding("low", "d")];

    expect(countBlocking(findings)).toBe(2);
    expect(countBlocking([finding("medium", "c"), finding("low", "d")])).toBe(0);
  });
});

describe("fileLink and fenceFor", () => {
  it("links to the exact line, encoding route-group parentheses", () => {
    expect(fileLink({ repo: "o/r", sha: "abc123", path: "app/(app)/events/actions.ts", line: 42 })).toBe(
      "https://github.com/o/r/blob/abc123/app/%28app%29/events/actions.ts#L42",
    );
    expect(fileLink({ repo: "o/r", sha: "abc123", path: "src/a.ts", line: null })).toBe(
      "https://github.com/o/r/blob/abc123/src/a.ts",
    );
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
    summary: "Adds reservations.",
    notes: [],
    usage: { total_tokens: 12345 },
    seconds: 42,
    runUrl: "https://run",
  };

  it("writes a long review with a blocking verdict, a table and a section per finding", () => {
    const body = renderReview({
      ...base,
      findings: [
        finding("high", "Unguarded | action", {
          path: "app/(app)/events/actions.ts",
          line: 42,
          detail: "Anyone can call it.",
          suggestion: "requirePermission(user, \"event:create\");",
        }),
        finding("low", "Missing test", { line: null, detail: "Add one." }),
      ],
    });

    expect(body.startsWith("<!-- glm-review -->")).toBe(true);
    expect(body).toContain("❌ **Blocking issues found:** 1 critical or high finding(s)");
    expect(body).toContain("1 high · 1 low");
    expect(body).toContain("### Overview\n\nAdds reservations.");
    expect(body).toContain(
      "| 1 | 🔴 High | [`app/(app)/events/actions.ts:42`](https://github.com/o/r/blob/abc1234def5678/app/%28app%29/events/actions.ts#L42) | Unguarded \\| action |",
    );
    expect(body).toContain("### 1. 🔴 High: Unguarded | action");
    expect(body).toContain("**Where:** [`app/(app)/events/actions.ts:42`]");
    expect(body).toContain("Anyone can call it.");
    expect(body).toContain('```\nrequirePermission(user, "event:create");\n```');
    expect(body).toContain("**Where:** [`src/a.ts`](https://github.com/o/r/blob/abc1234def5678/src/a.ts)");
    expect(body).toContain("12,345 tokens");
  });

  it("marks medium and low findings as issues to consider, not blocking", () => {
    const body = renderReview({ ...base, findings: [finding("medium", "Edge case")] });

    expect(body).toContain("⚠️ **Issues to consider:** no critical or high findings.");
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

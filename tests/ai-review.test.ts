import { describe, it, expect } from "vitest";

import {
  checkCompletion,
  countBlocking,
  extractStoryKeys,
  fenceFor,
  fileLink,
  locationFor,
  parseDiff,
  parseReview,
  renderReview,
} from "../.github/scripts/ai-review.mjs";

// SCRUM-88 — the GLM reviewer's pure logic. Line numbers must match git's
// new-side numbering exactly, or every "Where:" reference points at the wrong
// line; story keys decide which acceptance criteria GLM checks; the reply
// parser, the blocking rule and the renderer decide what is posted on the PR
// and whether its check turns red.

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
    expect(extractStoryKeys("SCRUM-1-2-3-4-5-6-7-8")).toHaveLength(6);
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
          { story: "SCRUM-31", criterion: "Over-allocation shows the shortfall", status: "MET", evidence: "actions.ts:125" },
          { story: "SCRUM-31", criterion: "  ", status: "met" },
          { story: "SCRUM-31", criterion: "Zero quantity is rejected", status: "partial" },
        ],
      }),
    );

    expect(review.acceptance).toEqual([
      { story: "SCRUM-31", criterion: "Over-allocation shows the shortfall", status: "met", evidence: "actions.ts:125" },
      { story: "SCRUM-31", criterion: "Zero quantity is rejected", status: "partial", evidence: "" },
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
    acceptance: [] as { story: string; criterion: string; status: string; evidence: string }[],
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
    expect(body).toContain("Reviewed against CONTRIBUTING.md, CLAUDE.md and the story files on `main`");
    expect(body).toContain("A critical finding fails this required check and blocks the merge (ADR 0008).");
  });

  it("renders the acceptance criteria table for the stories it checked", () => {
    const body = renderReview({
      ...base,
      findings: [],
      stories: ["SCRUM-31", "SCRUM-999"],
      storiesFound: ["SCRUM-31"],
      acceptance: [
        { story: "SCRUM-31", criterion: "Shows the shortfall", status: "met", evidence: "actions.ts:125" },
        { story: "SCRUM-31", criterion: "Last unit | race", status: "missing", evidence: "" },
      ],
    });

    expect(body).toContain("### Acceptance criteria\n\nChecked against: SCRUM-31");
    expect(body).toContain("No `docs/backlog` file on `main` for SCRUM-999");
    expect(body).toContain("| SCRUM-31 | Shows the shortfall | ✅ Met | actions.ts:125 |");
    expect(body).toContain("| SCRUM-31 | Last unit \\| race | ❌ Missing | — |");
  });

  it("says when the PR names no story", () => {
    const body = renderReview({ ...base, findings: [] });

    expect(body).toContain("_No SCRUM story key was found in the branch name, title or description");
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

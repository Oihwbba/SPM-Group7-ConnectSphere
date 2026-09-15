// SCRUM-88 — one GLM-5.3 reviewer for the whole pull request (ADR 0008).
//
// Reads the PR diff, asks GLM-5.3 for a review in ONE call, and posts ONE long
// review as a PR comment in the Conversation tab: a verdict, an overview, the
// story's acceptance criteria, and a section per finding with a "Where:"
// reference to the exact line. No inline comments; the comment is updated in
// place on every push.
//
// Context GLM gets besides the diff: the PR title, description and branch, the
// project's CONTRIBUTING.md and CLAUDE.md, and the docs/backlog story file for
// every SCRUM key the PR names. All of it, and this script itself, is read from
// the BASE branch, so a pull request can't rewrite the rules it is judged by.
//
// Exit code: 1 (red check, which blocks the merge) when the review finds a
// critical issue, or when no review could be completed: the check is required,
// so it must never pass without a review. If GLM stops before answering, it is
// retried once with less thinking first.

import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const GLM_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
// GLM-5.3 always thinks before it answers, and the answer only starts once the
// thinking ends: a replay of PR #22 thought for ~45-48K tokens (10+ minutes)
// before writing a ~1K-token JSON answer. A run cut off while still thinking
// returns an empty answer, so allow plenty of output and retry once.
const GLM_MAX_OUTPUT_TOKENS = 100_000;
// All attempts share one budget that ends before the job's 30-minute timeout,
// leaving time to post the comment. A retry needs at least MIN_RETRY_MS left.
const GLM_BUDGET_MS = 27 * 60 * 1000;
const MIN_RETRY_MS = 8 * 60 * 1000;
// Thinking levels (`reasoning_effort`). Without one, GLM-5.3 thinks as much as
// at "max" — a probe used 145 thinking tokens with no level, 143 at max, 27 at
// high and 19 at low — which is why reviews ran for 10-15 minutes. Reviews use
// "high"; the retry uses "low", so it finishes.
const EFFORTS = ["high", "low"];
const MAX_DIFF_CHARS = 120_000;
const MAX_FINDINGS = 10;
const MAX_STORIES = 6;
const MAX_DOC_CHARS = 20_000;
const MAX_STORY_CHARS = 6_000;
const MAX_BODY_CHARS = 4_000;
const MAX_TEST_INVENTORY_CHARS = 15_000;
const MARKER = "<!-- glm-review -->";

// Docs, lockfiles and generated snapshots aren't sent as diff to review.
const EXCLUDE = [
  ":(glob,exclude)**/*.md",
  ":(glob,exclude)**/package-lock.json",
  ":(glob,exclude)docs/backlog/**",
  ":(glob,exclude)**/migration_lock.toml",
];

// Project documents GLM reviews against, read from the base branch.
const PROJECT_DOCS = ["CONTRIBUTING.md", "CLAUDE.md"];

export const SEVERITY = {
  critical: { rank: 0, label: "🟣 Critical" },
  high: { rank: 1, label: "🔴 High" },
  medium: { rank: 2, label: "🟠 Medium" },
  low: { rank: 3, label: "🔵 Low" },
};

export const CRITERION_STATUS = {
  met: "✅ Met",
  partial: "🟡 Partial",
  missing: "❌ Missing",
  unclear: "❔ Unclear",
};

// Findings at these severities fail the check, which is required on `main`, so
// they block the merge. High findings are listed first but don't block.
const BLOCKING = new Set(["critical"]);

/**
 * Prefixes each added or context line with its line number in the new file, so
 * GLM can cite exact lines, and records which lines exist on the new side of
 * each file's hunks.
 */
export function parseDiff(diff) {
  const commentable = new Map();
  const annotated = [];
  let path = null;
  let inHunk = false;
  let newLine = 0;

  for (const raw of diff.split("\n")) {
    if (raw.startsWith("diff --git ")) {
      path = null;
      inHunk = false;
      annotated.push(raw);
      continue;
    }
    // Inside a hunk a removed line can itself start with "--", so file headers
    // are only recognised before the first hunk.
    if (!inHunk && raw.startsWith("+++ ")) {
      const target = raw.slice(4).trim();
      path = target === "/dev/null" ? null : target.replace(/^b\//, "");
      if (path && !commentable.has(path)) commentable.set(path, new Set());
      annotated.push(raw);
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (hunk) {
      inHunk = true;
      newLine = Number(hunk[1]);
      annotated.push(raw);
      continue;
    }
    if (!inHunk || !path) {
      annotated.push(raw);
      continue;
    }
    if (raw.startsWith("+") || raw.startsWith(" ")) {
      commentable.get(path).add(newLine);
      annotated.push(`${newLine}\t${raw}`);
      newLine += 1;
    } else if (raw.startsWith("-")) {
      annotated.push(`\t${raw}`);
    } else {
      annotated.push(raw);
    }
  }

  return { annotated: annotated.join("\n"), commentable };
}

// A description line that says which story the PR is for ("Closes SCRUM-31",
// "Part of SCRUM-88"). A key anywhere else in the description is just prose:
// #23 mentioned SCRUM-31 as an example and got SCRUM-31's criteria checked.
const STORY_LINE = /^\W*(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?|implement(?:s|ed)?|part of|refs?)\b/i;

/**
 * SCRUM keys the PR names, in first-seen order: every key in the branch name and
 * title, and the keys on a "Closes …" or "Part of …" line of the description. A
 * branch like "SCRUM-13-15-16-84-events" names four stories;
 * "SCRUM-89-node-24" names one, because the run of numbers stops at the first word.
 */
export function extractStoryKeys(branch, title, description) {
  const storyLines = String(description ?? "")
    .split("\n")
    .filter((line) => STORY_LINE.test(line));
  const keys = [];
  for (const text of [branch, title, ...storyLines]) {
    for (const match of String(text ?? "").matchAll(/SCRUM-(\d+(?:-\d+)*)/gi)) {
      for (const number of match[1].split("-")) {
        const key = `SCRUM-${Number(number)}`;
        if (!keys.includes(key)) keys.push(key);
      }
    }
  }
  return keys.slice(0, MAX_STORIES);
}

function ownKey(table, value) {
  const key = String(value ?? "").trim().toLowerCase();
  return Object.hasOwn(table, key) ? key : null;
}

/** Extracts the JSON review from GLM's reply, tolerating stray fences or prose. */
export function parseReview(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("GLM did not return a JSON review.");
  }
  const data = JSON.parse(text.slice(start, end + 1));
  const findings = Array.isArray(data.findings) ? data.findings : [];
  const acceptance = Array.isArray(data.acceptance) ? data.acceptance : [];

  return {
    summary: typeof data.summary === "string" ? data.summary.trim() : "",
    findings: findings
      .filter((f) => f && typeof f.path === "string" && typeof f.title === "string")
      .map((f) => {
        const line = Number.parseInt(f.line, 10);
        return {
          path: f.path.trim().replace(/^b\//, ""),
          line: Number.isInteger(line) && line > 0 ? line : null,
          // Object.hasOwn, not `in`: "toString" must not pass as a severity.
          severity: ownKey(SEVERITY, f.severity) ?? "medium",
          title: f.title.trim(),
          detail: typeof f.detail === "string" ? f.detail.trim() : "",
          suggestion: typeof f.suggestion === "string" ? f.suggestion.trim() : "",
        };
      })
      // Most severe first; Array.prototype.sort is stable, so GLM's order holds
      // within a severity.
      .sort((a, b) => SEVERITY[a.severity].rank - SEVERITY[b.severity].rank)
      .slice(0, MAX_FINDINGS),
    acceptance: acceptance
      .filter((a) => a && typeof a.criterion === "string" && a.criterion.trim())
      .slice(0, 40)
      .map((a) => ({
        story: typeof a.story === "string" ? a.story.trim().toUpperCase() : "",
        criterion: a.criterion.trim(),
        status: ownKey(CRITERION_STATUS, a.status) ?? "unclear",
        testedBy: typeof a.testedBy === "string" ? a.testedBy.trim() : "",
        evidence: typeof a.evidence === "string" ? a.evidence.trim() : "",
      })),
  };
}

export function countBlocking(findings) {
  return findings.filter((f) => BLOCKING.has(f.severity)).length;
}

/** A link to a file, or to an exact line, of the PR head's code. */
export function fileLink({ repo, sha, path, line }) {
  const encoded = path
    .split("/")
    .map((part) => encodeURIComponent(part).replace(/\(/g, "%28").replace(/\)/g, "%29"))
    .join("/");
  return `https://github.com/${repo}/blob/${sha}/${encoded}${line ? `#L${line}` : ""}`;
}

/**
 * Where a finding points, checked against the diff: an exact-line link only
 * when the line really is on the new side of the diff, a file link when only
 * the file is, and no link at all for a path the diff doesn't contain — so a
 * hallucinated location is never presented as verified.
 */
export function locationFor({ repo, sha, commentable, path, line }) {
  const lines = commentable.get(path);
  if (!lines) {
    return { text: `${line ? `${path}:${line}` : path} (not in the diff)`, link: null };
  }
  if (line && lines.has(line)) {
    return { text: `${path}:${line}`, link: fileLink({ repo, sha, path, line }) };
  }
  return {
    text: line ? `${path}:${line} (outside the diff)` : path,
    link: fileLink({ repo, sha, path, line: null }),
  };
}

/** A code fence longer than any run of backticks in the code, so it can't break out. */
export function fenceFor(code) {
  const longest = Math.max(0, ...(code.match(/`+/g) ?? []).map((run) => run.length));
  return "`".repeat(Math.max(3, longest + 1));
}

function oneLine(text) {
  return text.replace(/\s+/g, " ").trim();
}

function tableCell(text) {
  return oneLine(text).replace(/\|/g, "\\|");
}

function formatCount(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function severityCounts(findings) {
  return Object.keys(SEVERITY)
    .map((s) => [s, findings.filter((f) => f.severity === s).length])
    .filter(([, n]) => n > 0)
    .map(([s, n]) => `${n} ${s}`)
    .join(" · ");
}

function locationMarkdown(location) {
  const text = `\`${tableCell(location.text)}\``;
  return location.link ? `[${text}](${location.link})` : text;
}

export function renderReview({
  model,
  repo,
  sha,
  baseRef,
  commentable,
  summary,
  findings,
  stories,
  storiesFound,
  acceptance,
  notes,
  usage,
  seconds,
  runUrl,
}) {
  const blocking = countBlocking(findings);
  const lines = [MARKER, `## 🤖 ${model} code review`, ""];

  if (blocking > 0) {
    lines.push(`❌ **Blocking issues found:** ${blocking} critical finding(s). Fix them and push; this check blocks the merge.`);
  } else if (findings.length > 0) {
    lines.push("⚠️ **Issues to consider:** no critical findings, so this doesn't block the merge.");
  } else {
    lines.push("✅ **No issues found.**");
  }

  const counts = findings.length ? ` · ${severityCounts(findings)}` : "";
  lines.push("", `**Commit:** [\`${sha.slice(0, 7)}\`](https://github.com/${repo}/commit/${sha})${counts}`);
  lines.push("", "### Overview", "", summary || "_GLM returned no overview._");

  lines.push("", "### Acceptance criteria", "");
  if (stories.length === 0) {
    lines.push(
      "_No SCRUM story key was found in the branch name, title or a `Closes`/`Part of` line of the description, so acceptance criteria were not checked._",
    );
  } else {
    const missingFiles = stories.filter((key) => !storiesFound.includes(key));
    lines.push(`Checked against: ${storiesFound.length ? storiesFound.join(", ") : "none"}`);
    if (missingFiles.length) {
      lines.push("", `> No \`docs/backlog\` file on \`${baseRef}\` for ${missingFiles.join(", ")}, so those stories could not be checked.`);
    }
    if (acceptance.length) {
      lines.push("", "| Story | Criterion | Status | Tested by | Evidence |", "|---|---|---|---|---|");
      for (const a of acceptance) {
        lines.push(
          `| ${tableCell(a.story || "—")} | ${tableCell(a.criterion)} | ${CRITERION_STATUS[a.status]} | ` +
            `${tableCell(a.testedBy || "—")} | ${tableCell(a.evidence || "—")} |`,
        );
      }
    } else if (storiesFound.length) {
      lines.push("", "_GLM did not report on the acceptance criteria._");
    }
  }

  if (findings.length > 0) {
    lines.push("", "### Findings at a glance", "", "| # | Severity | Where | Issue |", "|---|---|---|---|");
    const locations = findings.map((f) => locationFor({ repo, sha, commentable, path: f.path, line: f.line }));
    findings.forEach((f, i) => {
      lines.push(`| ${i + 1} | ${SEVERITY[f.severity].label} | ${locationMarkdown(locations[i])} | ${tableCell(f.title)} |`);
    });

    findings.forEach((f, i) => {
      lines.push("", "---", "", `### ${i + 1}. ${SEVERITY[f.severity].label}: ${oneLine(f.title)}`, "");
      lines.push(`**Where:** ${locationMarkdown(locations[i])}`);
      if (f.detail) lines.push("", f.detail);
      if (f.suggestion) {
        const fence = fenceFor(f.suggestion);
        lines.push("", "**Suggested fix:**", "", fence, f.suggestion, fence);
      }
    });
  }

  for (const note of notes) lines.push("", `> ${oneLine(note)}`);

  const tokens = usage?.total_tokens ? ` · ${formatCount(usage.total_tokens)} tokens` : "";
  lines.push(
    "",
    "---",
    "",
    `<sub>AI-generated by ${model} in one call · ${seconds}s${tokens} · [workflow run](${runUrl}) · ` +
      `Reviewed against ${PROJECT_DOCS.join(", ")} and the story files on \`${baseRef}\` · ` +
      "A critical finding fails this required check and blocks the merge (ADR 0008).</sub>",
  );
  return lines.join("\n");
}

const STOP_REASONS = new Map([
  ["stop", "it finished with an empty answer"],
  ["length", "it reached the output token limit while still thinking"],
  ["sensitive", "BigModel's content filter stopped it"],
  ["network_error", "BigModel reported an inference error"],
  ["model_context_window_exceeded", "the prompt exceeded the context window"],
]);

/** Throws unless GLM finished its answer, saying why it stopped and how many tokens it used. */
export function checkCompletion({ content, finishReason, usage }) {
  if (finishReason === "stop" && content.trim()) return;
  const why =
    STOP_REASONS.get(finishReason) ??
    (finishReason ? `finish_reason "${finishReason}"` : "the stream ended without a finish reason");
  const output = usage?.completion_tokens;
  const thinking = usage?.completion_tokens_details?.reasoning_tokens;
  const tokens =
    output == null
      ? ""
      : ` after ${formatCount(output)} output tokens${thinking == null ? "" : ` (${formatCount(thinking)} thinking)`}`;
  throw new Error(`GLM stopped before answering: ${why}${tokens}.`);
}

/** One streamed GLM call; returns the answer text (thinking is ignored), why it stopped, and usage. */
async function askGlm({ apiKey, model, system, user, timeoutMs, effort }) {
  const response = await fetch(GLM_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    // Streaming makes response headers arrive at once, instead of after GLM's
    // forced thinking — without it the request can hit fetch's header timeout.
    body: JSON.stringify({
      model,
      stream: true,
      thinking: { type: "enabled" },
      max_tokens: GLM_MAX_OUTPUT_TOKENS,
      ...(effort ? { reasoning_effort: effort } : {}),
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`GLM request failed: HTTP ${response.status} ${detail}`);
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let finishReason = null;
  let usage = null;

  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let newline;
    while ((newline = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") continue;
      let event;
      try {
        event = JSON.parse(payload);
      } catch {
        continue;
      }
      if (event.error) {
        throw new Error(`GLM stream error: ${event.error.message ?? JSON.stringify(event.error)}`);
      }
      const choice = event.choices?.[0];
      content += choice?.delta?.content ?? "";
      if (choice?.finish_reason) finishReason = choice.finish_reason;
      if (event.usage) usage = event.usage;
    }
  }

  return { content, finishReason, usage };
}

function makeGithub(token) {
  return async function github(method, path, body) {
    const response = await fetch(`https://api.github.com${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`GitHub ${method} ${path}: HTTP ${response.status} ${text.slice(0, 300)}`);
    }
    return text ? JSON.parse(text) : null;
  };
}

/** Updates this PR's single GLM review comment, or creates it on the first run. */
async function upsertReviewComment(github, repo, prNumber, body) {
  for (let page = 1; page <= 10; page += 1) {
    const comments = await github("GET", `/repos/${repo}/issues/${prNumber}/comments?per_page=100&page=${page}`);
    const existing = comments.find(
      (c) => c.user?.login === "github-actions[bot]" && c.body?.startsWith(MARKER),
    );
    if (existing) {
      return github("PATCH", `/repos/${repo}/issues/comments/${existing.id}`, { body });
    }
    if (comments.length < 100) break;
  }
  return github("POST", `/repos/${repo}/issues/${prNumber}/comments`, { body });
}

/** A file's content at a commit (usually the base), or null when it doesn't exist there. */
function readFromBase(baseSha, path) {
  try {
    return execFileSync("git", ["show", `${baseSha}:${path}`], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
}

const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/;
// describe/it/test, any chained modifiers such as .each([...]) or .skipIf(!x),
// then the title string.
const TEST_TITLE =
  /\b(describe|it|test)\b((?:\s*\.\s*\w+(?:\s*\([^()]*(?:\([^()]*\)[^()]*)*\))?)*)\s*\(\s*(["'`])((?:(?!\3)[^\\\n]|\\.)+)\3/g;

/**
 * A test file's kind and its describe/test titles. The folder decides the kind
 * (tests/unit, tests/integration, e2e); a file outside them is guessed from
 * whether it mocks the database.
 */
export function describeTestFile(path, source) {
  const kind = path.startsWith("e2e/")
    ? "e2e (Playwright)"
    : path.startsWith("tests/integration/")
      ? "integration (Vitest, real database)"
      : path.startsWith("tests/unit/")
        ? "unit (Vitest)"
        : /vi\.mock\(\s*["']@\/lib\/db["']/.test(source)
          ? "unit (Vitest, database mocked)"
          : "integration or unit (Vitest, real database or none)";
  const titles = [...source.matchAll(TEST_TITLE)].map(([, fn, chain, , title]) => ({
    group: fn === "describe" || /\.\s*describe\b/.test(chain),
    title,
  }));
  return { path, kind, titles };
}

/** The existing-tests section of the prompt: each file, its kind and its titles. */
export function renderTestInventory(files, max = MAX_TEST_INVENTORY_CHARS) {
  if (files.length === 0) return "There are no test files under tests/ or e2e/.";
  const text = files
    .map((file) =>
      [
        `### ${file.path} — ${file.kind}`,
        ...file.titles.map((t) => (t.group ? `- ${t.title}` : `  - ${t.title}`)),
      ].join("\n"),
    )
    .join("\n\n");
  return capped(text, max);
}

// The reviewer's own tests cover tooling, not app features, and their fixtures
// hold sample test code in strings that the title pattern would misread.
const NOT_APP_TESTS = new Set(["tests/unit/ai-review.test.ts"]);

/** Every app test file under tests/ and e2e/ at a commit. */
function listTestFiles(sha) {
  return execFileSync("git", ["ls-tree", "-r", "--name-only", sha, "--", "tests", "e2e"], { encoding: "utf8" })
    .split("\n")
    .map((path) => path.trim())
    .filter((path) => TEST_FILE.test(path) && !NOT_APP_TESTS.has(path))
    .map((path) => describeTestFile(path, readFromBase(sha, path) ?? ""));
}

function capped(text, max) {
  return text.length > max ? `${text.slice(0, max)}\n\n[truncated at ${formatCount(max)} characters]` : text;
}

async function main() {
  const env = process.env;
  if (!env.ZHIPU_API_KEY) {
    // A required check must not pass without a review.
    console.log("::error::ZHIPU_API_KEY is not set, so no GLM review can run. Add the repository secret.");
    process.exitCode = 1;
    return;
  }

  const model = env.GLM_MODEL || "glm-5.3";
  const repo = env.GITHUB_REPOSITORY;
  const baseRef = env.BASE_REF || "main";
  const github = makeGithub(env.GITHUB_TOKEN);
  const started = Date.now();
  const elapsed = () => Math.round((Date.now() - started) / 1000);
  const notes = [];

  const diff = execFileSync(
    "git",
    ["diff", "--no-color", "--unified=3", `${env.BASE_SHA}...${env.HEAD_SHA}`, "--", ".", ...EXCLUDE],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  if (!diff.trim()) {
    console.log("Nothing to review: the PR only changes docs, lockfiles or other skipped files.");
    return;
  }

  const { annotated, commentable } = parseDiff(diff);
  let prompt = annotated;
  if (prompt.length > MAX_DIFF_CHARS) {
    prompt = prompt.slice(0, MAX_DIFF_CHARS);
    notes.push(`The diff is over ${formatCount(MAX_DIFF_CHARS)} characters, so only its first part was reviewed.`);
  }

  // Files skipped on purpose (docs, lockfiles) still exist in the PR. Say so, or
  // GLM reports them as missing — it did exactly that on its first run.
  const skipped = execFileSync("git", ["diff", "--name-only", `${env.BASE_SHA}...${env.HEAD_SHA}`], {
    encoding: "utf8",
  })
    .split("\n")
    .map((p) => p.trim())
    .filter((p) => p && !commentable.has(p) && !diff.includes(` b/${p}\n`));

  // The reviewer's rules and the project's documents, from the base branch.
  const instructions = readFromBase(env.BASE_SHA, ".github/ai-review/instructions.md");
  if (!instructions) throw new Error(`.github/ai-review/instructions.md is missing on ${baseRef}.`);
  const docs = PROJECT_DOCS.map((path) => [path, readFromBase(env.BASE_SHA, path)]).filter(([, text]) => text);
  const system = [
    instructions,
    "---",
    `# Project documents (from the ${baseRef} branch)`,
    ...docs.map(([path, text]) => `## ${path}\n\n${capped(text, MAX_DOC_CHARS)}`),
  ].join("\n\n");

  // The user stories this PR says it implements.
  const title = env.PR_TITLE ?? "";
  const description = env.PR_BODY ?? "";
  const stories = extractStoryKeys(env.HEAD_REF, title, description);
  const storyFiles = stories
    .map((key) => [key, readFromBase(env.BASE_SHA, `docs/backlog/${key}.md`)])
    .filter(([, text]) => text);
  const storiesFound = storyFiles.map(([key]) => key);

  const storySection = storyFiles.length
    ? storyFiles.map(([key, text]) => `### ${key}\n\n${capped(text, MAX_STORY_CHARS)}`).join("\n\n")
    : stories.length
      ? `The PR names ${stories.join(", ")}, but no docs/backlog file exists for them, so there are no acceptance criteria to check.`
      : "No SCRUM story key was found in the branch name, title or a Closes/Part of line of the description. Return an empty acceptance list.";

  // Every test file at the PR's head, so a test outside the diff still counts as
  // coverage instead of being reported missing.
  const testInventory = renderTestInventory(listTestFiles(env.HEAD_SHA));

  const skippedNote = skipped.length
    ? "Also changed in this PR but deliberately not shown (docs, lockfiles, generated " +
      "files). They exist, so do not report them as missing:\n" +
      skipped.map((p) => `- ${p}`).join("\n")
    : "";

  const user = [
    "## Pull request",
    `Title: ${title || "(none)"}`,
    `Branch: ${env.HEAD_REF || "(unknown)"} → ${baseRef}`,
    `Description:\n${description.trim() ? capped(description.trim(), MAX_BODY_CHARS) : "(none)"}`,
    "## User stories this PR implements",
    storySection,
    "## Existing tests (at this PR's head)",
    "Every test file with its kind and its describe/test titles. Tests this PR adds appear here and in the diff.",
    testInventory,
    "## Diff",
    "Every added (+) or unchanged context line is prefixed with its line number in the new " +
      "file and a tab; removed (-) lines have no number.",
    skippedNote,
    prompt,
  ]
    .filter(Boolean)
    .join("\n\n");

  // If GLM stops before answering, the retry thinks less: a shorter think is far
  // less likely to be cut off.
  const failures = [];
  let review;
  for (const [index, effort] of EFFORTS.entries()) {
    const remaining = started + GLM_BUDGET_MS - Date.now();
    if (index > 0 && remaining < MIN_RETRY_MS) {
      failures.push(`no retry: only ${Math.round(remaining / 60_000)} minute(s) of the time budget were left`);
      break;
    }
    const attemptStarted = Date.now();
    try {
      const result = await askGlm({ apiKey: env.ZHIPU_API_KEY, model, system, user, timeoutMs: remaining, effort });
      console.log(
        `GLM attempt ${index + 1}${effort ? ` (${effort} effort)` : ""}: finish_reason=${result.finishReason ?? "none"}, ` +
          `${formatCount(result.usage?.completion_tokens ?? 0)} output tokens ` +
          `(${formatCount(result.usage?.completion_tokens_details?.reasoning_tokens ?? 0)} thinking), ` +
          `${Math.round((Date.now() - attemptStarted) / 1000)}s.`,
      );
      checkCompletion(result);
      review = { ...parseReview(result.content), usage: result.usage };
      break;
    } catch (error) {
      failures.push(`attempt ${index + 1}: ${oneLine(error.message)}`);
      console.log(`::warning::GLM attempt ${index + 1} failed: ${error.message}`);
    }
  }

  if (!review) {
    await upsertReviewComment(
      github,
      repo,
      env.PR_NUMBER,
      [
        MARKER,
        `## 🤖 ${model} code review`,
        "",
        `❌ **The review did not complete** for commit \`${env.HEAD_SHA.slice(0, 7)}\`, so this required check failed. ` +
          "Re-run the failed **GLM Code Review** job, or push a new commit.",
        "",
        ...failures.map((failure) => `- ${failure}`),
        "",
        `<sub>${model} · ${elapsed()}s · [workflow run](${env.RUN_URL})</sub>`,
      ].join("\n"),
    );
    console.log(`::error::The GLM review did not complete: ${failures.join("; ")}`);
    process.exitCode = 1;
    return;
  }
  if (failures.length) {
    notes.push(`The first GLM attempt didn't finish (${failures[0]}), so this review comes from a retry with less thinking.`);
  }

  await upsertReviewComment(
    github,
    repo,
    env.PR_NUMBER,
    renderReview({
      model,
      repo,
      sha: env.HEAD_SHA,
      baseRef,
      commentable,
      summary: review.summary,
      findings: review.findings,
      stories,
      storiesFound,
      acceptance: review.acceptance,
      notes,
      usage: review.usage,
      seconds: elapsed(),
      runUrl: env.RUN_URL,
    }),
  );

  const blocking = countBlocking(review.findings);
  console.log(
    `Posted the ${model} review: ${review.findings.length} finding(s), ${blocking} critical, ` +
      `stories ${storiesFound.join(", ") || "none"}, ${review.acceptance.length} criteria, ${elapsed()}s.`,
  );
  if (blocking > 0) {
    console.log(`::error::GLM found ${blocking} critical issue(s), which block the merge. See the review comment on the pull request.`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    // A crash means no review, so the required check fails.
    console.log(`::error::GLM review step failed: ${error.message}`);
    process.exitCode = 1;
  });
}

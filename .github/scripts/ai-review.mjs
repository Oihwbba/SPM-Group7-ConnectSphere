// SCRUM-88 — one GLM-5.3 reviewer for the whole pull request (ADR 0008).
//
// Reads the PR diff, asks GLM-5.3 for a review in ONE call, and posts ONE long
// review as a PR comment in the Conversation tab: a verdict, an overview, and a
// section per finding with a "Where:" reference that links to the exact line.
// No inline comments. The comment is updated in place on every push.
//
// Exit code: 1 (red check) when the review finds critical or high issues, so
// they are visible at a glance. A problem with GLM or the GitHub API is
// reported on the PR and exits 0 — an outage must not turn every PR red.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const GLM_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const GLM_TIMEOUT_MS = 20 * 60 * 1000;
const MAX_DIFF_CHARS = 120_000;
const MAX_FINDINGS = 10;
const MARKER = "<!-- glm-review -->";

// Docs, lockfiles and generated snapshots don't need an AI review.
const EXCLUDE = [
  ":(glob,exclude)**/*.md",
  ":(glob,exclude)**/package-lock.json",
  ":(glob,exclude)docs/backlog/**",
  ":(glob,exclude)**/migration_lock.toml",
];

export const SEVERITY = {
  critical: { rank: 0, label: "🟣 Critical" },
  high: { rank: 1, label: "🔴 High" },
  medium: { rank: 2, label: "🟠 Medium" },
  low: { rank: 3, label: "🔵 Low" },
};

// Findings at these severities fail the check (it is not a required check, so
// a red review does not block merging; a human decides).
const BLOCKING = new Set(["critical", "high"]);

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

/** Extracts the JSON review from GLM's reply, tolerating stray fences or prose. */
export function parseReview(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("GLM did not return a JSON review.");
  }
  const data = JSON.parse(text.slice(start, end + 1));
  const findings = Array.isArray(data.findings) ? data.findings : [];

  return {
    summary: typeof data.summary === "string" ? data.summary.trim() : "",
    findings: findings
      .filter((f) => f && typeof f.path === "string" && typeof f.title === "string")
      .map((f) => {
        const severity = String(f.severity).toLowerCase();
        const line = Number.parseInt(f.line, 10);
        return {
          path: f.path.trim().replace(/^b\//, ""),
          line: Number.isInteger(line) && line > 0 ? line : null,
          severity: severity in SEVERITY ? severity : "medium",
          title: f.title.trim(),
          detail: typeof f.detail === "string" ? f.detail.trim() : "",
          suggestion: typeof f.suggestion === "string" ? f.suggestion.trim() : "",
        };
      })
      // Most severe first; Array.prototype.sort is stable, so GLM's order holds
      // within a severity.
      .sort((a, b) => SEVERITY[a.severity].rank - SEVERITY[b.severity].rank)
      .slice(0, MAX_FINDINGS),
  };
}

export function countBlocking(findings) {
  return findings.filter((f) => BLOCKING.has(f.severity)).length;
}

/** A link to the exact line of the PR head's code. */
export function fileLink({ repo, sha, path, line }) {
  const encoded = path
    .split("/")
    .map((part) => encodeURIComponent(part).replace(/\(/g, "%28").replace(/\)/g, "%29"))
    .join("/");
  return `https://github.com/${repo}/blob/${sha}/${encoded}${line ? `#L${line}` : ""}`;
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

export function renderReview({ model, repo, sha, summary, findings, notes, usage, seconds, runUrl }) {
  const blocking = countBlocking(findings);
  const lines = [MARKER, `## 🤖 ${model} code review`, ""];

  if (blocking > 0) {
    lines.push(`❌ **Blocking issues found:** ${blocking} critical or high finding(s) to fix, or explicitly accept, before merging.`);
  } else if (findings.length > 0) {
    lines.push("⚠️ **Issues to consider:** no critical or high findings.");
  } else {
    lines.push("✅ **No issues found.**");
  }

  const counts = findings.length ? ` · ${severityCounts(findings)}` : "";
  lines.push("", `**Commit:** [\`${sha.slice(0, 7)}\`](https://github.com/${repo}/commit/${sha})${counts}`);
  lines.push("", "### Overview", "", summary || "_GLM returned no overview._");

  if (findings.length > 0) {
    lines.push("", "### Findings at a glance", "", "| # | Severity | Where | Issue |", "|---|---|---|---|");
    findings.forEach((f, i) => {
      const where = f.line ? `${f.path}:${f.line}` : f.path;
      const link = fileLink({ repo, sha, path: f.path, line: f.line });
      lines.push(`| ${i + 1} | ${SEVERITY[f.severity].label} | [\`${tableCell(where)}\`](${link}) | ${tableCell(f.title)} |`);
    });

    findings.forEach((f, i) => {
      const where = f.line ? `${f.path}:${f.line}` : f.path;
      const link = fileLink({ repo, sha, path: f.path, line: f.line });
      lines.push("", "---", "", `### ${i + 1}. ${SEVERITY[f.severity].label}: ${oneLine(f.title)}`, "");
      lines.push(`**Where:** [\`${oneLine(where)}\`](${link})`);
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
      "Critical or high findings mark the check red; it does not block merging (ADR 0008).</sub>",
  );
  return lines.join("\n");
}

/** One streamed GLM call; returns only the answer text (thinking is ignored). */
async function askGlm({ apiKey, model, system, user }) {
  const response = await fetch(GLM_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    // Streaming makes response headers arrive at once, instead of after GLM's
    // forced thinking — without it the request can hit fetch's header timeout.
    body: JSON.stringify({
      model,
      stream: true,
      thinking: { type: "enabled" },
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(GLM_TIMEOUT_MS),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`GLM request failed: HTTP ${response.status} ${detail}`);
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
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
      content += event.choices?.[0]?.delta?.content ?? "";
      if (event.usage) usage = event.usage;
    }
  }

  return { content, usage };
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

async function main() {
  const env = process.env;
  if (!env.ZHIPU_API_KEY) {
    console.log("::notice::ZHIPU_API_KEY is not set, so the GLM review was skipped.");
    return;
  }

  const model = env.GLM_MODEL || "glm-5.3";
  const repo = env.GITHUB_REPOSITORY;
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

  const system = readFileSync(new URL("../ai-review/instructions.md", import.meta.url), "utf8");
  const skippedNote = skipped.length
    ? "\n\nAlso changed in this PR but deliberately not shown (docs, lockfiles, generated " +
      "files). They exist, so do not report them as missing:\n" +
      skipped.map((p) => `- ${p}`).join("\n")
    : "";
  const user =
    "Review this pull request diff. Every added (+) or unchanged context line is " +
    "prefixed with its line number in the new file and a tab; removed (-) lines " +
    `have no number.${skippedNote}\n\n${prompt}`;

  let review;
  try {
    const { content, usage } = await askGlm({ apiKey: env.ZHIPU_API_KEY, model, system, user });
    review = { ...parseReview(content), usage };
  } catch (error) {
    await upsertReviewComment(
      github,
      repo,
      env.PR_NUMBER,
      [
        MARKER,
        `## 🤖 ${model} code review`,
        "",
        `⚠️ **The review did not complete** for commit \`${env.HEAD_SHA.slice(0, 7)}\`: ${oneLine(error.message)}`,
        "",
        `<sub>${model} · ${elapsed()}s · [workflow run](${env.RUN_URL})</sub>`,
      ].join("\n"),
    );
    console.log(`::warning::GLM review did not complete: ${error.message}`);
    return;
  }

  await upsertReviewComment(
    github,
    repo,
    env.PR_NUMBER,
    renderReview({
      model,
      repo,
      sha: env.HEAD_SHA,
      summary: review.summary,
      findings: review.findings,
      notes,
      usage: review.usage,
      seconds: elapsed(),
      runUrl: env.RUN_URL,
    }),
  );

  const blocking = countBlocking(review.findings);
  console.log(`Posted the ${model} review: ${review.findings.length} finding(s), ${blocking} critical/high, ${elapsed()}s.`);
  if (blocking > 0) {
    console.log(`::error::GLM found ${blocking} critical or high issue(s). See the review comment on the pull request.`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    // A crash in the reviewer itself is advisory: warn, don't turn the PR red.
    console.log(`::warning::GLM review step failed: ${error.message}`);
  });
}

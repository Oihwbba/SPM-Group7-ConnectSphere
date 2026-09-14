// SCRUM-88 — one GLM-5.3 reviewer for the whole pull request (ADR 0008).
//
// Reads the PR diff, asks GLM-5.3 for a review in ONE call, and posts ONE pull
// request review: a findings table at the top whose rows link straight to the
// inline comments on the changed lines. The review is advisory, so a problem
// with GLM or the GitHub API is reported on the PR and this script still exits 0.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const GLM_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const GLM_TIMEOUT_MS = 20 * 60 * 1000;
const MAX_DIFF_CHARS = 120_000;
const MARKER = "<!-- glm-single-review -->";

// Docs, lockfiles and generated snapshots don't need an AI review.
const EXCLUDE = [
  ":(glob,exclude)**/*.md",
  ":(glob,exclude)**/package-lock.json",
  ":(glob,exclude)docs/backlog/**",
  ":(glob,exclude)**/migration_lock.toml",
];

const SEVERITY_LABEL = { high: "🔴 high", medium: "🟠 medium", low: "🔵 low" };

/**
 * Prefixes each added or context line with its line number in the new file, so
 * GLM can cite exact lines, and records which lines can carry an inline comment
 * (GitHub only accepts comments on lines that appear on the new side of a hunk).
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
      .slice(0, 10)
      .map((f) => {
        const severity = String(f.severity).toLowerCase();
        const line = Number.parseInt(f.line, 10);
        return {
          path: f.path.trim().replace(/^b\//, ""),
          line: Number.isInteger(line) && line > 0 ? line : null,
          severity: severity in SEVERITY_LABEL ? severity : "medium",
          title: f.title.trim(),
          detail: typeof f.detail === "string" ? f.detail.trim() : "",
          suggestion: typeof f.suggestion === "string" ? f.suggestion.trim() : "",
        };
      }),
  };
}

function formatCount(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function tableCell(text) {
  return text.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

function renderComment(finding, model) {
  const parts = [`**${SEVERITY_LABEL[finding.severity]}** · ${finding.title}`];
  if (finding.detail) parts.push(finding.detail);
  if (finding.suggestion) {
    parts.push(`**Suggested fix:**\n\`\`\`\n${finding.suggestion}\n\`\`\``);
  }
  parts.push(`<sub>${model} · advisory</sub>`);
  return parts.join("\n\n");
}

export function renderBody({ model, summary, findings, links, notes, usage, seconds, runUrl }) {
  const lines = [MARKER, `### 🤖 ${model} review`, ""];
  if (summary) lines.push(summary, "");

  if (findings.length === 0) {
    lines.push("✅ No findings.");
  } else {
    lines.push(
      `**${findings.length} finding(s).** Click a location to jump to the comment. Advisory only (ADR 0008): fix it, or reply with why it doesn't apply.`,
      "",
      "| # | Severity | Where | Finding |",
      "|---|---|---|---|",
    );
    findings.forEach((f, i) => {
      const where = f.line ? `${f.path}:${f.line}` : f.path;
      const location = links[i] ? `[\`${where}\`](${links[i]})` : `\`${where}\``;
      lines.push(`| ${i + 1} | ${SEVERITY_LABEL[f.severity]} | ${location} | ${tableCell(f.title)} |`);
    });

    // Findings GitHub could not anchor to a line keep their detail here.
    const unanchored = findings
      .map((f, i) => ({ f, i }))
      .filter(({ i }) => !links[i] && findings[i].detail);
    if (unanchored.length) {
      lines.push("");
      for (const { f, i } of unanchored) {
        lines.push(`**${i + 1}. ${f.title}** ${f.detail}`);
      }
    }
  }

  for (const note of notes) lines.push("", `> ${note}`);

  const tokens = usage?.total_tokens ? ` · ${formatCount(usage.total_tokens)} tokens` : "";
  lines.push(
    "",
    `<sub>AI-generated by ${model} in one call · ${seconds}s${tokens} · [workflow run](${runUrl})</sub>`,
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
      const error = new Error(`GitHub ${method} ${path}: HTTP ${response.status} ${text.slice(0, 300)}`);
      error.status = response.status;
      throw error;
    }
    return text ? JSON.parse(text) : null;
  };
}

async function main() {
  const env = process.env;
  if (!env.ZHIPU_API_KEY) {
    console.log("::notice::ZHIPU_API_KEY is not set, so the GLM review was skipped.");
    return;
  }

  const model = env.GLM_MODEL || "glm-5.3";
  const github = makeGithub(env.GITHUB_TOKEN);
  const pull = `/repos/${env.GITHUB_REPOSITORY}/pulls/${env.PR_NUMBER}`;
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

  const system = readFileSync(new URL("../ai-review/instructions.md", import.meta.url), "utf8");
  const user =
    "Review this pull request diff. Every added (+) or unchanged context line is " +
    "prefixed with its line number in the new file and a tab; removed (-) lines " +
    `have no number.\n\n${prompt}`;

  let review;
  try {
    const { content, usage } = await askGlm({ apiKey: env.ZHIPU_API_KEY, model, system, user });
    review = { ...parseReview(content), usage };
  } catch (error) {
    await github("POST", `${pull}/reviews`, {
      commit_id: env.HEAD_SHA,
      event: "COMMENT",
      body: [
        MARKER,
        `### 🤖 ${model} review`,
        "",
        `> ⚠️ **The review did not complete:** ${error.message}`,
        "",
        `<sub>${model} · ${elapsed()}s · [workflow run](${env.RUN_URL})</sub>`,
      ].join("\n"),
    });
    console.log(`::warning::GLM review did not complete: ${error.message}`);
    return;
  }

  // Anchor each finding to its line when GitHub will accept it there.
  const inline = [];
  review.findings.forEach((finding, index) => {
    if (finding.line && commentable.get(finding.path)?.has(finding.line)) {
      inline.push({ index, comment: { path: finding.path, line: finding.line, side: "RIGHT", body: renderComment(finding, model) } });
    }
  });

  let created;
  try {
    created = await github("POST", `${pull}/reviews`, {
      commit_id: env.HEAD_SHA,
      event: "COMMENT",
      body: `${MARKER}\nPosting the ${model} review…`,
      comments: inline.map((entry) => entry.comment),
    });
  } catch (error) {
    if (error.status !== 422 || inline.length === 0) throw error;
    // A line GitHub rejects fails the whole review; fall back to the table only.
    notes.push("Inline comments could not be placed on the diff, so the findings are listed here only.");
    inline.length = 0;
    created = await github("POST", `${pull}/reviews`, {
      commit_id: env.HEAD_SHA,
      event: "COMMENT",
      body: `${MARKER}\nPosting the ${model} review…`,
    });
  }

  const links = [];
  if (inline.length) {
    const posted = await github("GET", `${pull}/reviews/${created.id}/comments?per_page=100`);
    for (const entry of inline) {
      const match = posted.find(
        (c) => c.path === entry.comment.path && (c.line ?? c.original_line) === entry.comment.line && !c.used,
      );
      if (match) {
        match.used = true;
        links[entry.index] = match.html_url;
      }
    }
  }

  await github("PUT", `${pull}/reviews/${created.id}`, {
    body: renderBody({
      model,
      summary: review.summary,
      findings: review.findings,
      links,
      notes,
      usage: review.usage,
      seconds: elapsed(),
      runUrl: env.RUN_URL,
    }),
  });
  console.log(`Posted review ${created.id}: ${review.findings.length} finding(s), ${inline.length} inline, ${elapsed()}s.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    // Advisory: report and exit 0 so the PR never shows a red check for this.
    console.log(`::warning::GLM review step failed: ${error.message}`);
  });
}

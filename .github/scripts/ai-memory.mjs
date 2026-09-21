// SCRUM-112 — the reviewer's memory, written by the reviewer.
//
// Everything in .github/ai-review/memory.md used to be typed there by hand,
// after a human noticed a lesson. That is where the reviewer's repeated
// mistakes came from: it re-reported what the team already knew was
// deliberate, and it missed facts nobody got round to writing down.
//
// A merged pull request is the moment the lesson exists — the review has been
// written, CI has passed or failed and been fixed, and a human has accepted
// the result. So on every merge this asks GLM what that pull request taught
// the reviewer, and opens a pull request when the answer is anything.
//
// It never writes to `main`. A lesson influences every future review, so a
// human reads it first; CODEOWNERS already requires Jin Hong's approval under
// `.github/`. See ADR 0008.

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { askGlm, makeGithub, MAX_MEMORY_CHARS, MEMORY_PATH } from "./ai-review.mjs";

/** The branch every memory proposal lives on, so they replace rather than pile up. */
export const MEMORY_BRANCH = "ai-review/memory";

// Guards on what GLM may hand back. A memory that is wiped, gutted or stripped
// of its own rules would quietly degrade every later review, so these are
// checked in code — asking for them in the prompt is not the same as enforcing
// them.
const REQUIRED_HEADING = "# GLM reviewer memory";
const REQUIRED_RULES = "Rules for a lesson:";
/** A rewrite may prune, but losing this much of the file is a wipe, not an edit. */
const MIN_KEPT_RATIO = 0.6;

const MAX_REVIEW_CHARS = 12_000;
const MAX_BODY_CHARS = 4_000;
const MAX_STAT_CHARS = 3_000;
const GLM_TIMEOUT_MS = 10 * 60 * 1000;

const INSTRUCTIONS = `You keep the memory of an automated code reviewer for one project.

The reviewer reads that memory before every pull request, after CONTRIBUTING.md
and CLAUDE.md. You are given the memory as it stands and one pull request that
has just been merged. Decide whether that pull request taught the reviewer
anything, and if so hand back the complete memory file with the lesson in it.

What belongs in the memory:
- A fact about this project that the code does not show, and why it is so: a
  deliberate choice a reviewer would otherwise report as a defect, a trap that
  has already cost someone hours, or a correction to a wrong call the reviewer
  made on this very pull request.
- State the fact and its reason. Never write "do not report X" — a lesson
  explains what is deliberate, and must never teach the reviewer to stay quiet
  about a real defect.
- Date it and cite the pull request it came from, like the entries already there.

What does not:
- Anything a reviewer can read in the diff, the tests or the story files.
- A restatement of CONTRIBUTING.md or CLAUDE.md.
- A finding from the review that was simply correct and then fixed. That is the
  system working, not a lesson.
- Praise, summaries of what the pull request did, or process narration.

Most merged pull requests teach nothing. Saying so is the normal answer, and a
memory that grows on every merge is a worse memory.

You are rewriting the whole file, not appending to it. Delete a lesson that has
stopped being true — a gap that is now closed, a workaround that is now gone —
and merge a new lesson into an existing entry when they are about the same
thing. Keep the existing headings, the file's opening paragraph and its "Rules
for a lesson" block exactly as they are.

The file must stay under ${MAX_MEMORY_CHARS} characters. If adding a lesson
would break that, drop the least useful old one and say so in your note.

Answer with JSON only, in a \`\`\`json fence:

{"learned": false, "note": "one line saying what you considered and why it is not a lesson"}

or

{"learned": true, "note": "one line naming the lesson", "memory": "the complete file, from its heading to its last line"}`;

/** GLM's reply, as JSON in a fence or bare. Returns null when it isn't usable. */
export function parseProposal(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*\n([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  let parsed;
  try {
    parsed = JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  return {
    learned: parsed.learned === true,
    note: typeof parsed.note === "string" ? parsed.note.trim().replace(/\s+/g, " ") : "",
    memory: typeof parsed.memory === "string" ? parsed.memory : "",
  };
}

/**
 * Whether a proposal may become a pull request. Returns the memory to write,
 * or a reason it was refused — the caller logs the reason either way, so a
 * rejected rewrite is visible in the run instead of silently doing nothing.
 */
export function checkProposal({ proposal, current }) {
  if (!proposal) return { accept: false, reason: "GLM returned no usable JSON." };
  if (!proposal.learned) {
    return { accept: false, reason: `Nothing learned: ${proposal.note || "no reason given"}` };
  }
  if (!proposal.note) return { accept: false, reason: "The proposal has no note saying what it learned." };

  const memory = proposal.memory.replace(/\r\n/g, "\n").trim();
  if (!memory) return { accept: false, reason: "The proposal is marked learned but carries no memory." };
  if (memory.length > MAX_MEMORY_CHARS) {
    return {
      accept: false,
      reason: `The proposed memory is ${memory.length} characters, over the ${MAX_MEMORY_CHARS} the reviewer reads.`,
    };
  }
  if (!memory.startsWith(REQUIRED_HEADING)) {
    return { accept: false, reason: `The proposed memory does not start with "${REQUIRED_HEADING}".` };
  }
  if (!memory.includes(REQUIRED_RULES)) {
    return { accept: false, reason: `The proposed memory dropped its "${REQUIRED_RULES}" block.` };
  }
  const floor = Math.floor(current.trim().length * MIN_KEPT_RATIO);
  if (memory.length < floor) {
    return {
      accept: false,
      reason: `The proposed memory is ${memory.length} characters against ${current.trim().length} now, below the ${floor} floor: that is a wipe, not an edit.`,
    };
  }
  if (memory === current.replace(/\r\n/g, "\n").trim()) {
    return { accept: false, reason: "The proposed memory is identical to the current one." };
  }
  return { accept: true, memory: `${memory}\n`, note: proposal.note };
}

/** What GLM is shown about the merged pull request. */
export function buildMemoryPrompt({ current, pending, pr, review, ci, stat }) {
  const parts = [
    `# The memory as it stands (${MEMORY_PATH})`,
    current,
    `# The pull request that just merged`,
    `#${pr.number} ${pr.title}`,
    `Branch: ${pr.branch} · merged by ${pr.mergedBy ?? "unknown"} · author ${pr.author ?? "unknown"}`,
    "",
    "## Its description",
    (pr.body || "(none)").slice(0, MAX_BODY_CHARS),
    "",
    "## Files it changed",
    stat.slice(0, MAX_STAT_CHARS) || "(none)",
  ];
  if (review) {
    parts.push("", "## The review it received", review.slice(0, MAX_REVIEW_CHARS));
  }
  parts.push("", "## What CI did", ci || "No CI result was found for this pull request.");
  if (pending) {
    parts.push(
      "",
      "## Note",
      "The memory above already carries lessons from an earlier proposal that has not been merged yet. Keep them unless they are wrong.",
    );
  }
  return parts.join("\n");
}

/** A one-line account of CI: what matters is whether it failed on the way, and at what. */
export function summariseCi(runs) {
  if (!runs.length) return "";
  const failed = runs.filter((run) => run.conclusion === "failure");
  if (!failed.length) return `CI passed on every commit of this pull request (${runs.length} run(s)).`;
  const names = [...new Set(failed.map((run) => run.name))].join(", ");
  return (
    `CI failed ${failed.length} time(s) on the way to the merge, in: ${names}. ` +
    `It passed in the end. A failure that a reviewer could have predicted from a fact about this project is worth a lesson; ` +
    `an ordinary mistake in the pull request's own new code is not.`
  );
}

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

async function main() {
  const env = process.env;
  const prNumber = Number(env.PR_NUMBER);
  const repo = env.GITHUB_REPOSITORY;

  if (!env.ZHIPU_API_KEY) {
    // Not an error: the reviewer itself is optional until the secret exists.
    console.log("ZHIPU_API_KEY is not set, so the reviewer cannot be taught. Skipping.");
    return;
  }

  const github = makeGithub(env.GITHUB_TOKEN);
  const model = env.GLM_MODEL || "glm-5.3";

  git("fetch", "--no-tags", "--force", "origin", "main");
  const mainMemory = git("show", `origin/main:${MEMORY_PATH}`);
  let pending = "";
  try {
    git("fetch", "--no-tags", "--force", "origin", MEMORY_BRANCH);
    pending = git("show", `FETCH_HEAD:${MEMORY_PATH}`);
  } catch {
    // No proposal is open; the memory on main is the whole story.
  }
  const current = pending || mainMemory;

  const pr = await github("GET", `/repos/${repo}/pulls/${prNumber}`);
  const comments = await github("GET", `/repos/${repo}/issues/${prNumber}/comments?per_page=100`);
  const review = comments.find((comment) => comment.body?.includes("<!-- glm-review -->"))?.body ?? "";

  const checks = await github("GET", `/repos/${repo}/commits/${pr.head.sha}/check-runs?per_page=100`);
  const ci = summariseCi(checks.check_runs ?? []);

  const stat = git("diff", "--stat", `${pr.base.sha}..${pr.head.sha}`);

  const user = buildMemoryPrompt({
    current,
    pending: Boolean(pending),
    pr: {
      number: prNumber,
      title: pr.title,
      body: pr.body,
      branch: pr.head.ref,
      author: pr.user?.login,
      mergedBy: pr.merged_by?.login,
    },
    review,
    ci,
    stat,
  });

  const answer = await askGlm({
    apiKey: env.ZHIPU_API_KEY,
    model,
    system: INSTRUCTIONS,
    user,
    timeoutMs: GLM_TIMEOUT_MS,
  });

  const verdict = checkProposal({ proposal: parseProposal(answer.content), current });
  if (!verdict.accept) {
    console.log(`No memory change for #${prNumber}: ${verdict.reason}`);
    return;
  }

  // Build the proposal as one commit on top of main, so the pull request's
  // diff is always the memory as it would be after merging, and an earlier
  // unmerged proposal is carried forward rather than duplicated.
  git("checkout", "-B", MEMORY_BRANCH, "origin/main");
  writeFileSync(MEMORY_PATH, verdict.memory);
  if (!git("status", "--porcelain", MEMORY_PATH)) {
    console.log(`No memory change for #${prNumber}: the file on main already says this.`);
    return;
  }

  git("config", "user.name", "github-actions[bot]");
  git("config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com");
  git("add", MEMORY_PATH);
  git("commit", "-m", `SCRUM-112 Teach the reviewer what #${prNumber} showed\n\n${verdict.note}`);
  git("push", "--force-with-lease", "origin", MEMORY_BRANCH);

  const open = await github(
    "GET",
    `/repos/${repo}/pulls?head=${repo.split("/")[0]}:${MEMORY_BRANCH}&state=open`,
  );
  const body = [
    `The reviewer learned something from #${prNumber}:`,
    "",
    `> ${verdict.note}`,
    "",
    `Proposed by \`.github/scripts/ai-memory.mjs\` (SCRUM-112) after #${prNumber} merged. The diff is the whole memory as it would read on \`main\`.`,
    "",
    "Read the lesson before merging — it shapes every later review. A lesson that is wrong, or that would teach the reviewer to stay quiet about a real defect, should be edited on this branch or the pull request closed.",
    "",
    "GitHub does not run checks on a pull request opened by a workflow token, so this one has none to wait for.",
  ].join("\n");

  if (open.length) {
    await github("PATCH", `/repos/${repo}/pulls/${open[0].number}`, { body });
    console.log(`Updated the open memory pull request #${open[0].number} with the lesson from #${prNumber}.`);
    return;
  }
  const created = await github("POST", `/repos/${repo}/pulls`, {
    title: "SCRUM-112 Reviewer memory",
    head: MEMORY_BRANCH,
    base: "main",
    body,
  });
  console.log(`Opened memory pull request #${created.number} with the lesson from #${prNumber}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    // Failing to learn must never look like a broken build: the memory simply
    // stays as it was.
    console.log(`::warning::The reviewer could not be taught from this merge: ${error.message}`);
  });
}

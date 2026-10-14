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
// human reads it first; CODEOWNERS already requires a teammate's approval
// under `.github/`. See ADR 0008.

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { askGlm, extractStoryKeys, makeGithub, MARKER, MAX_MEMORY_CHARS, MEMORY_PATH } from "./ai-review.mjs";

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
 * The memory as a list of entries. A heading or a bullet starts one, a blank
 * line ends one, and every other line continues the entry above — so a
 * paragraph is one entry however it is wrapped. Whitespace is collapsed, so
 * re-wrapping is not a change but altering one word is.
 */
export function memoryEntries(text) {
  const entries = [];
  let open = false;
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    if (!line.trim()) {
      open = false;
      continue;
    }
    // A heading needs a space after its hashes, so a citation such as "#33"
    // wrapped onto the start of a line still continues its entry.
    const heading = /^\s*#{1,6}\s/.test(line);
    const starts = heading || /^\s*[-*]\s/.test(line);
    if (open && !starts) entries[entries.length - 1] += ` ${line.trim()}`;
    else entries.push(line.trim());
    // A heading is one line; anything else may run on.
    open = !heading;
  }
  return entries.map((entry) => entry.replace(/\s+/g, " "));
}

/** Today's date in Singapore, where the team works, as YYYY-MM-DD. */
export function singaporeDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" }).format(now);
}

/**
 * Whether a proposal may become a pull request. Returns the memory to write,
 * or a reason it was refused — the caller logs the reason either way, so a
 * rejected rewrite is visible in the run instead of silently doing nothing.
 */
export function checkProposal({ proposal, current, prNumber }) {
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
      tooLong: memory.length,
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
  // The whole file comes back, so every entry the model had no business
  // touching is at risk of a silent edit — the first live run turned an
  // unrelated migration name's underscore into a hyphen. An entry may be kept
  // exactly, deleted whole, or added or rewritten while citing this pull request.
  const before = new Set(memoryEntries(current));
  // Not a substring test: "#6" must not count as citing #67.
  const cites = new RegExp(`#${prNumber}(?!\\d)`);
  const altered = memoryEntries(memory).filter((entry) => !before.has(entry) && !cites.test(entry));
  if (altered.length) {
    return {
      accept: false,
      reason: `The proposal changes ${altered.length} entry(s) without citing #${prNumber}, starting with: "${altered[0].slice(0, 120)}"`,
    };
  }
  if (memory === current.replace(/\r\n/g, "\n").trim()) {
    return { accept: false, reason: "The proposed memory is identical to the current one." };
  }
  return { accept: true, memory: `${memory}\n`, note: proposal.note };
}

/** A diff stat from the pull request's file list: one line per file. */
export function renderFileStat(files) {
  return files
    .map((file) => `${file.filename} | +${file.additions} -${file.deletions}${file.status === "modified" ? "" : ` (${file.status})`}`)
    .join("\n");
}

/** What GLM is shown about the merged pull request. */
export function buildMemoryPrompt({ current, pending, pr, review, ci, stat, today }) {
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
    "",
    "## Dating and citing",
    `Today is ${today}. Date a lesson you add with it, and cite #${pr.number} in any lesson you add or change. ` +
      "Every other line must come back exactly as it is, character for character: a proposal that alters an entry without citing this pull request is rejected.",
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

/**
 * The follow-up when the only thing wrong with a lesson was its length. GLM
 * rarely prunes unasked, and once the file is near the limit every lesson
 * would otherwise be thrown away — #95's was (SCRUM-152).
 */
export function buildPruneRequest({ length, prNumber }) {
  return [
    "## Your proposal was too long",
    `It was ${length} characters; the reviewer reads at most ${MAX_MEMORY_CHARS}. ` +
      `Keep your lesson and hand back the whole file again, under ${MAX_MEMORY_CHARS} characters. ` +
      `Make room by deleting whole lessons that matter least or have stopped being true, ` +
      `or by shortening one and citing #${prNumber} in it. Name what you removed in your note.`,
  ].join("\n");
}

/**
 * What a refused run logs. "Nothing learned" is the normal answer; a lesson
 * found at any attempt and then refused is not, and a plain log line is how
 * #95's went unnoticed. A prune retry that comes back unparseable or empty
 * must not hide the lesson the first attempt found.
 */
export function refusalLog({ attempts, verdict, prNumber }) {
  const found = attempts.filter((attempt) => attempt?.learned);
  const lost = found.length ? `::warning::A lesson was lost (${found.at(-1).note || "no note"}). ` : "";
  return `${lost}No memory change for #${prNumber}: ${verdict.reason}`;
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
    // Not an error: failing to learn never fails a merge. The review itself
    // fails without the secret, so a missing key is seen there.
    console.log("ZHIPU_API_KEY is not set, so the reviewer cannot be taught. Skipping.");
    return;
  }

  const github = makeGithub(env.GITHUB_TOKEN);
  const model = env.GLM_MODEL || "glm-5.3";

  git("fetch", "--no-tags", "--force", "origin", "main");
  // actions/checkout does not promise an origin/main ref, so pin the fetched
  // commit before the next fetch overwrites FETCH_HEAD.
  const mainSha = git("rev-parse", "FETCH_HEAD");
  const mainMemory = git("show", `${mainSha}:${MEMORY_PATH}`);
  // The branch outlives its pull request: closing a proposal is how a wrong
  // lesson is rejected, and closing does not delete the branch. So its memory
  // counts as pending only while its pull request is still open — otherwise
  // a rejected lesson would come straight back in the next proposal.
  let branchSha = "";
  let branchMemory = "";
  try {
    git("fetch", "--no-tags", "--force", "origin", MEMORY_BRANCH);
    branchSha = git("rev-parse", "FETCH_HEAD");
    branchMemory = git("show", `${branchSha}:${MEMORY_PATH}`);
  } catch {
    // No proposal branch yet.
  }
  const open = await github("GET", `/repos/${repo}/pulls?head=${repo.split("/")[0]}:${MEMORY_BRANCH}&state=open`);
  const pending = open.length ? branchMemory : "";
  const current = pending || mainMemory;

  const pr = await github("GET", `/repos/${repo}/pulls/${prNumber}`);
  // A manual run names its pull request by hand; only a merge teaches anything.
  if (!pr.merged_at) {
    console.log(`::warning::#${prNumber} is not merged, so it has nothing to teach. Skipping.`);
    return;
  }
  const comments = await github("GET", `/repos/${repo}/issues/${prNumber}/comments?per_page=100`);
  const review = comments.find((comment) => comment.body?.includes(MARKER))?.body ?? "";

  // Every run on the branch, not just the head commit: required checks make a
  // merged head green by definition, so the failures on the way — the ones
  // worth learning from — only show in the history.
  const runs = await github(
    "GET",
    `/repos/${repo}/actions/runs?event=pull_request&branch=${encodeURIComponent(pr.head.ref)}&per_page=100`,
  );
  const ci = summariseCi((runs.workflow_runs ?? []).filter((run) => run.status === "completed"));

  // From the API, not git: branches are deleted once merged, so the pull
  // request's head commit is usually no longer anywhere the runner can fetch.
  const files = await github("GET", `/repos/${repo}/pulls/${prNumber}/files?per_page=100`);
  const stat = renderFileStat(files);

  const today = singaporeDate();
  const user = buildMemoryPrompt({
    today,
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

  const ask = (prompt) =>
    askGlm({ apiKey: env.ZHIPU_API_KEY, model, system: INSTRUCTIONS, user: prompt, timeoutMs: GLM_TIMEOUT_MS });

  const attempts = [parseProposal((await ask(user)).content)];
  let verdict = checkProposal({ proposal: attempts[0], current, prNumber });
  if (verdict.tooLong) {
    console.log(`The lesson from #${prNumber} came back at ${verdict.tooLong} characters; asking GLM to prune.`);
    attempts.push(parseProposal((await ask(`${user}\n\n${buildPruneRequest({ length: verdict.tooLong, prNumber })}`)).content));
    verdict = checkProposal({ proposal: attempts[1], current, prNumber });
  }
  if (!verdict.accept) {
    console.log(refusalLog({ attempts, verdict, prNumber }));
    return;
  }

  // Build the proposal as one commit on top of main, so the pull request's
  // diff is always the memory as it would be after merging, and an earlier
  // unmerged proposal is carried forward rather than duplicated.
  git("checkout", "-B", MEMORY_BRANCH, mainSha);
  writeFileSync(MEMORY_PATH, verdict.memory);
  if (!git("status", "--porcelain", MEMORY_PATH)) {
    console.log(`No memory change for #${prNumber}: the file on main already says this.`);
    return;
  }

  git("config", "user.name", "github-actions[bot]");
  git("config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com");
  git("add", MEMORY_PATH);
  // Filed under the story the lesson came from, so Jira shows it where it
  // was learned; SCRUM-112 only when that pull request named no story.
  const keys = extractStoryKeys(pr.head.ref, pr.title, pr.body).join(" ") || "SCRUM-112";
  git("commit", "-m", `${keys} Teach the reviewer what #${prNumber} showed\n\n${verdict.note}`);
  // Replace exactly the branch this run read, and nothing a human pushed to it
  // since. An empty expectation means "the branch must not exist yet".
  git("push", `--force-with-lease=${MEMORY_BRANCH}:${branchSha}`, "origin", `HEAD:refs/heads/${MEMORY_BRANCH}`);
  const body = [
    `The reviewer learned something from #${prNumber}:`,
    "",
    `> ${verdict.note}`,
    "",
    `Proposed by \`.github/scripts/ai-memory.mjs\` (SCRUM-112) after #${prNumber} merged. The diff is the whole memory as it would read on \`main\`.`,
    "",
    "Read the lesson before merging — it shapes every later review. A lesson that is wrong, or that would teach the reviewer to stay quiet about a real defect, should be edited on this branch or the pull request closed.",
    "",
    "This pull request was opened by a workflow, so GitHub holds its checks until someone with write access clicks **Approve and run**. One click and they run as usual.",
    "",
    "Merge it with **Create a merge commit**, like every pull request into `main`.",
  ].join("\n");

  if (open.length) {
    await github("PATCH", `/repos/${repo}/pulls/${open[0].number}`, { title: `${keys} Reviewer memory from #${prNumber}`, body });
    console.log(`Updated the open memory pull request #${open[0].number} with the lesson from #${prNumber}.`);
    return;
  }
  const created = await github("POST", `/repos/${repo}/pulls`, {
    title: `${keys} Reviewer memory from #${prNumber}`,
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

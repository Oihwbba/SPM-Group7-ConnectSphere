// SCRUM-196 — every test case cites tests that exist.
//
// `docs/testing/SCRUM-n.md` traces each acceptance criterion to the tests that
// automate it: an "Automated by" line names a test file and, after a `›`, the
// titles of its tests. When a test is renamed or a spec deleted, nothing
// noticed: on 2026-10-19 SCRUM-171 cited a deleted spec and a renamed test, and
// the GLM review only reads the PR's own stories. This reads every citation in
// every test-case document and fails CI on each one that names a file or a
// title no test has.
//
// Titles are read from the test files' syntax tree, so a title in a comment or
// in test data doesn't count. A citation may shorten a title with "…" and may
// write a template's placeholder (`${x}`, `%s`, `$x`); a title built from a
// template may stand for any value. Either side's placeholders match anything.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const ts = createRequire(import.meta.url)("typescript");

export const DOCS_DIR = "docs/testing";
export const TEST_DIRS = ["tests", "e2e"];

/** Stands for a part of a title only known when the test runs, or a part a citation leaves out. */
export const ANY = "\u0000";

const TEST_FUNCTIONS = new Set(["it", "test", "describe"]);
const TEST_FILE = /\.(test|spec)\.tsx?$/;

/** The function a call starts from: `it`, `it.each(rows)`, `test.describe.serial`. */
function calleeRoot(expression) {
  for (;;) {
    if (ts.isIdentifier(expression)) return expression.text;
    if (ts.isPropertyAccessExpression(expression)) expression = expression.expression;
    else if (ts.isCallExpression(expression)) expression = expression.expression;
    else if (ts.isTaggedTemplateExpression(expression)) expression = expression.tag;
    else return null;
  }
}

function usesEach(expression) {
  for (;;) {
    if (ts.isPropertyAccessExpression(expression)) {
      if (expression.name.text === "each") return true;
      expression = expression.expression;
    } else if (ts.isCallExpression(expression)) expression = expression.expression;
    else if (ts.isTaggedTemplateExpression(expression)) expression = expression.tag;
    else return false;
  }
}

function titleText(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) return node.head.text + node.templateSpans.map((span) => ANY + span.literal.text).join("");
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) return titleText(node.left) + titleText(node.right);
  if (ts.isParenthesizedExpression(node)) return titleText(node.expression);
  return ANY;
}

/** Every it/test/describe title in a test file, with `ANY` where it is only known at run time. */
export function testTitles(source, fileName = "test.ts") {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const titles = [];
  const visit = (node) => {
    if (ts.isCallExpression(node) && node.arguments.length > 0 && TEST_FUNCTIONS.has(calleeRoot(node.expression))) {
      // `it.each(rows)` itself takes the rows; its title is on the call it returns.
      const takesRows = ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "each";
      const [first] = node.arguments;
      if (!takesRows && !ts.isArrowFunction(first) && !ts.isFunctionExpression(first)) {
        let title = titleText(first);
        // .each fills `%s` and `$name` from each row.
        if (usesEach(node.expression)) title = title.replace(/%[sdifjo#]|\$[A-Za-z_][\w.]*/g, ANY);
        if (title !== ANY) titles.push(title);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return titles;
}

const CITED_PLACEHOLDER = /\s*(?:…|\.\.\.|%[sdifjo#]|\$\{[^}]*\}|\$[A-Za-z_][\w.]*)\s*/g;

/** A title or citation as a pattern: whitespace made single, every placeholder one `ANY`. */
function pattern(text, placeholders) {
  let out = text.replace(/\s+/g, " ").trim();
  if (placeholders) out = out.replace(placeholders, ANY);
  out = out.replace(new RegExp(`\\s*${ANY}\\s*`, "g"), ANY);
  return out.replace(new RegExp(`${ANY}+`, "g"), ANY);
}

/** Whether some text fits both patterns, `ANY` in either matching any run of characters. */
function overlap(a, b) {
  // reach[j] after row i: a[i..] and b[j..] can still be made to agree.
  let next = new Uint8Array(b.length + 1);
  next[b.length] = 1;
  for (let j = b.length - 1; j >= 0 && b[j] === ANY; j--) next[j] = 1;
  for (let i = a.length - 1; i >= 0; i--) {
    const row = new Uint8Array(b.length + 1);
    row[b.length] = a[i] === ANY ? next[b.length] : 0;
    for (let j = b.length - 1; j >= 0; j--) {
      if (a[i] === ANY) row[j] = next[j] || row[j + 1];
      else if (b[j] === ANY) row[j] = row[j + 1] || next[j];
      else row[j] = a[i] === b[j] ? next[j + 1] : 0;
    }
    next = row;
  }
  return next[0] === 1;
}

/**
 * Whether a cited title names a test title. A citation with no ":" that ends in
 * a case id, such as "SCRUM-124 … TC-124-01", names a test by its key and case
 * wherever they appear in the title.
 */
export function titleMatches(cited, title) {
  const byCase = !cited.includes(":") && /^(SCRUM-\d+\b.*)?TC-\d+-\d+$/.test(cited.trim());
  const want = pattern(byCase ? `${ANY}${cited}${ANY}` : cited, CITED_PLACEHOLDER);
  const have = pattern(title);
  if (!want.includes(ANY) && !have.includes(ANY)) return want === have;
  return overlap(want, have);
}

/**
 * The citations in one "Automated by" paragraph: each quoted title, or bare
 * case id, after a test file and its `›`. Prose ends a file's list: a quote
 * after a sentence ends, or inside parentheses that name no file of their own,
 * is text, not a citation.
 */
export function citationsIn(paragraph) {
  const found = [];
  const scopes = [{ file: null, listing: false, quoted: false }];
  const token = /`([^`]+)`|"([^"]*)"|(\()|(\))|(›)|\b(TC-\d+-\d+)\b|(\.)(?=\s+[A-Z]|\s*$)/g;
  for (let match; (match = token.exec(paragraph)); ) {
    const scope = scopes[scopes.length - 1];
    const [, code, quoted, open, close, arrow, caseId, stop] = match;
    if (code !== undefined) {
      if (TEST_FILE.test(code)) Object.assign(scope, { file: code, listing: false, quoted: false });
    } else if (open) scopes.push({ file: null, listing: false, quoted: false });
    else if (close) {
      if (scopes.length > 1) scopes.pop();
    } else if (arrow) {
      if (scope.file) Object.assign(scope, { listing: true, quoted: false });
    } else if (stop) Object.assign(scope, { file: null, listing: false, quoted: false });
    else if (!scope.listing) continue;
    else if (quoted !== undefined) {
      found.push({ file: scope.file, cited: quoted, kind: "title", offset: match.index });
      scope.quoted = true;
    } else if (caseId && !scope.quoted) found.push({ file: scope.file, cited: caseId, kind: "case", offset: match.index });
  }
  return found;
}

/**
 * Every citation in the documents that names a missing file or a title its
 * file has no test for. `titlesOf(file)` is that file's titles, or null when
 * the file doesn't exist.
 */
export function brokenCitations(docs, titlesOf) {
  const broken = [];
  let checked = 0;
  for (const { path, text } of docs) {
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].startsWith("**Automated by")) continue;
      let end = i + 1;
      while (end < lines.length && lines[end].trim() !== "" && !/^(#|\||\*\*)/.test(lines[end])) end++;
      const paragraph = lines.slice(i, end).join("\n");
      for (const citation of citationsIn(paragraph)) {
        checked++;
        const line = i + 1 + (paragraph.slice(0, citation.offset).match(/\n/g) ?? []).length;
        const titles = titlesOf(citation.file);
        const problem =
          titles === null
            ? "the file does not exist"
            : citation.kind === "case"
              ? titles.some((title) => new RegExp(`\\b${citation.cited}\\b`).test(title))
                ? null
                : "no test title in the file names this case"
              : titles.some((title) => titleMatches(citation.cited, title))
                ? null
                : "no test in the file has this title";
        if (problem) broken.push({ doc: path, line, file: citation.file, cited: citation.cited, kind: citation.kind, problem });
      }
      i = end - 1;
    }
  }
  return { checked, broken };
}

/** How a broken citation is reported: where it is, what it cites, and what is wrong. */
export function formatBroken({ doc, line, file, cited, kind, problem }) {
  return `${doc}:${line}: \`${file}\` › ${kind === "case" ? cited : `"${cited}"`}: ${problem}`;
}

function testFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return testFiles(path);
    return TEST_FILE.test(entry.name) ? [path] : [];
  });
}

function main() {
  const titles = new Map(TEST_DIRS.flatMap(testFiles).map((file) => [file, testTitles(readFileSync(file, "utf8"), file)]));
  const docs = readdirSync(DOCS_DIR)
    .filter((name) => /^SCRUM-\d+\.md$/.test(name))
    .sort()
    .map((name) => ({ path: join(DOCS_DIR, name).replace(/\\/g, "/"), text: readFileSync(join(DOCS_DIR, name), "utf8") }));
  const { checked, broken } = brokenCitations(docs, (file) => titles.get(file) ?? null);
  for (const citation of broken) {
    console.log(formatBroken(citation));
    if (process.env.GITHUB_ACTIONS) console.log(`::error file=${citation.doc},line=${citation.line}::${formatBroken(citation).replace(/\r?\n/g, " ")}`);
  }
  console.log(`Test-case citations checked: ${checked}, in ${docs.length} documents. Broken: ${broken.length}.`);
  if (broken.length > 0) {
    console.log("Rename the citation to the test's title, or cite the test that now covers the case (docs/testing/README.md).");
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

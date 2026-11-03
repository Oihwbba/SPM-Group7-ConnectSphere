import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";

// SCRUM-236 AC5 — every test case follows the template in
// docs/testing/README.md, and the README's index matches the documents.
// Read from the files themselves, so a case added without its summary row,
// or a document left out of the index, turns this red (SCRUM-271: TC-236-05
// was checked by hand).
const DIR = "docs/testing";
const linesOf = (path: string) => readFileSync(path, "utf8").split(/\r?\n/);
const docs = readdirSync(DIR)
  .filter((name) => /^SCRUM-\d+\.md$/.test(name))
  .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
const readme = linesOf(`${DIR}/README.md`);

/**
 * The story's own criteria a cell or scenario names: "AC 1, AC 2", "AC 5, 6"
 * or "AC 1–AC 10". Another story's criterion, such as "SCRUM-34 AC 6", isn't
 * this case's.
 */
function criteria(text: string) {
  const own = text.replace(/SCRUM-\d+ AC ?\d+/g, "");
  const found = new Set<number>();
  const from = own.indexOf("AC");
  if (from < 0) return [];
  for (const [, a, b] of own
    .slice(from)
    .matchAll(/(\d+)(?:\s*[–-]\s*(?:AC ?)?(\d+))?/g)) {
    for (let n = Number(a); n <= Number(b ?? a); n++) found.add(n);
  }
  return [...found].sort((x, y) => x - y);
}

/** Whether text says Manual, leaving out the quoted test titles it cites. */
const saysManual = (text: string) =>
  /\bmanual\b/i.test(text.replace(/"[^"]*"/g, ""));

/** Each case in a document: its heading's id, its table rows, and the lines after the table. */
function casesIn(lines: string[]) {
  const cases = [];
  for (let i = 0; i < lines.length; i++) {
    const id = lines[i].match(/^### (TC-\d+-\d+)\s*$/)?.[1];
    if (!id) continue;
    let end = lines.findIndex((l, j) => j > i && /^#{1,3} /.test(l));
    if (end < 0) end = lines.length;
    const body = lines.slice(i + 1, end);
    const field = (name: string) =>
      body
        .find((l) => new RegExp(`^\\| *${name} *\\|`).test(l))
        ?.split("|")[2]
        ?.trim();
    cases.push({
      id,
      caseId: field("Test Case ID"),
      scenario: field("Test Scenario") ?? "",
      notes: body.filter((l) => !l.startsWith("|")).join("\n"),
      first: body.find((l) => l.trim() !== "") ?? "",
    });
  }
  return cases;
}

/** A document's summary table: each case's criterion and Automated cells. */
function summaryRows(lines: string[]) {
  const rows = new Map<string, { criterion: string; automated: string }>();
  for (const line of lines) {
    const id = line.match(/^\| \[(TC-\d+-\d+)\]\(#tc-\d+-\d+\) \|/)?.[1];
    if (!id) continue;
    const cells = line.split("|").map((c) => c.trim());
    rows.set(id, { criterion: cells[3], automated: cells[4] });
  }
  return rows;
}

/** Everything in one document that breaks the template, one line per problem. */
function templateProblems(lines: string[]) {
  const problems: string[] = [];
  const rows = summaryRows(lines);
  const cases = casesIn(lines);
  for (const c of cases) {
    // An id is never reused, so a retired, superseded or moved case keeps a
    // short note saying where it went instead of the table.
    if (c.caseId === undefined) {
      if (!/^(\*\*)?(Retired|Superseded|Moved)\b/.test(c.first)) {
        problems.push(`${c.id}: no Test Case ID row`);
      }
      continue;
    }
    if (c.caseId !== c.id)
      problems.push(`${c.id}: its Test Case ID row says ${c.caseId}`);
    if (!/^\*\*(Automated by|Retired)/m.test(c.notes))
      problems.push(`${c.id}: no Automated by line`);
    if (rows.size === 0) continue;
    const row = rows.get(c.id);
    if (!row) {
      problems.push(`${c.id}: no row in the summary table`);
      continue;
    }
    const named = c.scenario.match(/^\[[^\]]*\]\s*([^:]*):/)?.[1] ?? "";
    if (criteria(row.criterion).join() !== criteria(named).join()) {
      problems.push(
        `${c.id}: the summary row says "${row.criterion}", the scenario "${named}"`,
      );
    }
    if (saysManual(row.automated) !== saysManual(c.notes)) {
      problems.push(
        `${c.id}: Manual in only one of the summary row and the case`,
      );
    }
  }
  for (const id of rows.keys()) {
    if (!cases.some((c) => c.id === id))
      problems.push(`${id}: a summary row with no case`);
  }
  return problems;
}

describe("SCRUM-236 AC5 — every test case follows the README template", () => {
  for (const doc of docs) {
    it(`SCRUM-271 [AC3], SCRUM-236 [AC5] TC-236-05: ${doc} follows the template, and each summary row agrees with its case`, () => {
      expect(templateProblems(linesOf(`${DIR}/${doc}`))).toEqual([]);
    });
  }

  it("SCRUM-271 [AC3], SCRUM-236 [AC5] TC-236-05: the README lists every test-case document, with its number of cases", () => {
    const listed = new Map<string, number>();
    for (const line of readme) {
      const row = line.match(
        /^\| \[(SCRUM-\d+)\]\(SCRUM-\d+\.md\) \|[^|]*\| (\d+) \|/,
      );
      if (row) listed.set(`${row[1]}.md`, Number(row[2]));
    }
    const counted = new Map(
      docs.map((doc) => [
        doc,
        linesOf(`${DIR}/${doc}`).filter((l) => /^### TC-\d+-\d+\s*$/.test(l))
          .length,
      ]),
    );
    expect(Object.fromEntries(listed)).toEqual(Object.fromEntries(counted));
  });

  it("SCRUM-271 [AC3], SCRUM-236 [AC5] TC-236-05: the README shows how a test of several stories, a case with no criterion, a task's test of another story's case and an uncited test are titled", () => {
    const rules = readme.join("\n");
    // SCRUM-72 [AC6] TC-72-05, SCRUM-74 [AC4] TC-74-04: …
    expect(rules).toMatch(
      /`SCRUM-\d+ \[AC\d+\] TC-\d+-\d+, SCRUM-\d+ \[AC\d+\] TC-\d+-\d+: …`/,
    );
    // SCRUM-207 TC-207-16: …
    expect(rules).toMatch(/`SCRUM-\d+ TC-\d+-\d+: …`/);
    // SCRUM-226 [AC2], SCRUM-155 [AC5, AC6] TC-155-17: …
    expect(rules).toMatch(
      /`SCRUM-\d+ \[AC\d+\], SCRUM-\d+ \[AC\d+(, AC\d+)*\] TC-\d+-\d+: …`/,
    );
    // SCRUM-178 [AC1]: …
    expect(rules).toMatch(/`SCRUM-\d+ \[AC\d+\]: …`/);
  });
});

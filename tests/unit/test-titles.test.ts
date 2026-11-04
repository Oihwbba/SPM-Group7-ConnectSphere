import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import ts from "typescript";

import {
  ANY,
  citationsIn,
  titleMatches,
} from "../../.github/scripts/check-citations.mjs";

// SCRUM-236 AC1–AC3 and SCRUM-232 AC1, AC3 — every unit, integration and e2e
// test is titled after its story, criteria and case, by the grammar in
// docs/testing/README.md. Read from the test files and the test-case
// documents, so a new test with a wrong or missing prefix turns this red
// (SCRUM-273: TC-236-01 to TC-236-03 were checked by hand in #313, and the
// e2e titles in #302).

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? walk(`${dir}/${e.name}`)
      : /\.(test|spec)\.tsx?$/.test(e.name)
        ? [`${dir}/${e.name}`]
        : [],
  );

type Test = {
  file: string;
  line: number;
  title: string;
  describes: string[];
  todo: boolean;
};

function calleeRoot(node: ts.Expression): string | null {
  for (;;) {
    if (ts.isIdentifier(node)) return node.text;
    if (ts.isPropertyAccessExpression(node) || ts.isCallExpression(node))
      node = node.expression;
    else if (ts.isTaggedTemplateExpression(node)) node = node.tag;
    else return null;
  }
}

function titleText(node: ts.Node): string {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    return node.text;
  if (ts.isTemplateExpression(node)) {
    return (
      node.head.text +
      node.templateSpans.map((s) => ANY + s.literal.text).join("")
    );
  }
  if (ts.isBinaryExpression(node))
    return titleText(node.left) + titleText(node.right);
  return ANY;
}

/** Every it and test in a file, with the describe titles around it. */
function testsIn(file: string): Test[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const found: Test[] = [];
  const visit = (node: ts.Node, describes: string[]) => {
    if (ts.isCallExpression(node) && node.arguments.length > 0) {
      const fn = calleeRoot(node.expression);
      const callee = node.expression.getText(source);
      const [first, body] = node.arguments;
      // Only a call with a title: not `it.each(rows)` itself, nor Playwright's
      // `test.use({ … })` or `test.beforeEach(() => …)`.
      const titled =
        ts.isStringLiteral(first) ||
        ts.isNoSubstitutionTemplateLiteral(first) ||
        ts.isTemplateExpression(first) ||
        ts.isBinaryExpression(first);
      if ((fn === "it" || fn === "test" || fn === "describe") && titled) {
        let title = titleText(first);
        if (callee.includes(".each"))
          title = title.replace(/%[sdifjo#]|\$[A-Za-z_][\w.]*/g, ANY);
        // Vitest's describe, and Playwright's test.describe and test.describe.serial.
        if (/(^|\.)describe\b/.test(callee)) {
          node.arguments
            .slice(1)
            .forEach((a) => visit(a, [...describes, title]));
          return;
        }
        const todo = callee.endsWith(".todo");
        if (
          todo ||
          (body && (ts.isArrowFunction(body) || ts.isFunctionExpression(body)))
        ) {
          const line =
            source.getLineAndCharacterOfPosition(node.getStart(source)).line +
            1;
          found.push({ file, line, title, describes, todo });
          return;
        }
      }
    }
    ts.forEachChild(node, (child) => visit(child, describes));
  };
  visit(source, []);
  return found;
}

// The title grammar: groups of SCRUM-n [ACx, ACy] TC-n-xx, TC-n-yy, joined by ", ".
const GROUP = String.raw`SCRUM-\d+(?: \[AC\d+(?:, AC\d+)*\])?(?: (?:TC-\d+-\d+|${ANY})(?:, TC-\d+-\d+)*)?`;
const PREFIX = new RegExp(String.raw`^(${GROUP}(?:, ${GROUP})*): `);

function groupsOf(title: string) {
  const prefix = title.match(PREFIX)?.[1];
  if (!prefix) return null;
  const group =
    /SCRUM-(\d+)((?: \[AC\d+(?:, AC\d+)*\])?)([^,]*(?:, TC-\d+-\d+)*)/g;
  return [...prefix.matchAll(group)].map(([, story, acs, rest]) => ({
    story: Number(story),
    acs: [...acs.matchAll(/AC(\d+)/g)].map((m) => Number(m[1])),
    cases: [...rest.matchAll(/TC-(\d+)-\d+/g)].map((m) => ({
      id: m[0],
      story: Number(m[1]),
    })),
    templated: rest.includes(ANY),
  }));
}

/** The story's own criteria a cell or scenario names, as in test-case-docs.test.ts. */
function criteria(text: string) {
  const own = text.replace(/SCRUM-\d+ AC ?\d+/g, "");
  const found = new Set<number>();
  const from = own.indexOf("AC");
  if (from < 0) return found;
  for (const [, a, b] of own
    .slice(from)
    .matchAll(/(\d+)(?:\s*[–-]\s*(?:AC ?)?(\d+))?/g)) {
    for (let n = Number(a); n <= Number(b ?? a); n++) found.add(n);
  }
  return found;
}

const DOCS = readdirSync("docs/testing").filter((n) =>
  /^SCRUM-\d+\.md$/.test(n),
);
const docLines = new Map(
  DOCS.map((n) => [
    n,
    readFileSync(`docs/testing/${n}`, "utf8").split(/\r?\n/),
  ]),
);

/** Each documented case: its criteria, and whether it was retired or superseded. */
const cases = new Map<string, { acs: Set<number>; retired: boolean }>();
for (const lines of docLines.values()) {
  const rows = new Map(
    lines.flatMap((l) => {
      const id = l.match(/^\| \[(TC-\d+-\d+)\]\(#/)?.[1];
      return id ? [[id, l] as const] : [];
    }),
  );
  lines.forEach((line, i) => {
    const id = line.match(/^### (TC-\d+-\d+)\s*$/)?.[1];
    if (!id) return;
    const body = lines.slice(i + 1, i + 12);
    const first = body.find((l) => l.trim() !== "") ?? "";
    const scenario =
      body.find((l) => /^\| *Test Scenario/.test(l))?.split("|")[2] ?? "";
    const named = scenario.match(/^\s*\[[^\]]*\]\s*([^:]*):/)?.[1] ?? "";
    cases.set(id, {
      acs: criteria(rows.get(id)?.split("|")[3] ?? named),
      retired:
        /^(\*\*)?(Retired|Superseded|Moved)\b/.test(first) ||
        /\| *Retired/.test(rows.get(id) ?? ""),
    });
  });
}

const tests = [...walk("tests"), ...walk("e2e")].flatMap(testsIn);

/** The cases whose Automated by line cites each test. */
const citedBy = new Map<Test, Set<string>>();
for (const lines of docLines.values()) {
  let current = "";
  for (const line of lines) {
    current = line.match(/^### (TC-\d+-\d+)/)?.[1] ?? current;
    if (!line.startsWith("**Automated by")) continue;
    for (const c of citationsIn(line)) {
      for (const t of tests.filter((t) => t.file === c.file)) {
        const names =
          c.kind === "case"
            ? new RegExp(`\\b${c.cited}\\b`).test(t.title)
            : titleMatches(c.cited, t.title);
        if (names) citedBy.set(t, (citedBy.get(t) ?? new Set()).add(current));
      }
    }
  }
}

// The tests that belong to no story or chore, so keep plain titles, as #313
// listed them. A new one is added here with its reason.
const PLAIN = new Set([
  // Shared UI helpers several stories use.
  "tests/unit/app-error.test.tsx › says the page couldn't load, gives the reference and offers to try again",
  "tests/unit/app-error.test.tsx › leaves out the reference line when there is none",
  "tests/unit/date-picker.test.ts › lays a month out in Monday-first weeks, with blanks before the 1st",
  "tests/unit/date-picker.test.ts › starts a month that begins on a Monday with no blanks",
  "tests/unit/date-picker.test.ts › knows February's length, including leap years",
  "tests/unit/request-form.test.tsx › disables today's slots that began before now",
  "tests/unit/request-form.test.tsx › keeps later slots today, and every slot on a later day",
  "tests/unit/request-form.test.tsx › keeps the slot starting at this very minute, and disables nothing before a date is chosen",
  "tests/unit/venue-availability.test.ts › names an approved booking by its times only — never the other organisation's event",
  "tests/unit/venue-availability.test.ts › names recorded unavailability with its reason",
  // Generic permission-table checks with no single story.
  "tests/unit/auth.test.ts › lets an organiser create events",
  "tests/unit/auth.test.ts › lets Technical Support list and review equipment requests",
  "tests/unit/auth.test.ts › lets a user read only their own notifications",
  // Exit paths and a pass-through under no story's describe.
  "tests/unit/events.test.ts › [Exit path] createDraftEvent rethrows an unexpected (non-permission) error instead of swallowing it",
  "tests/unit/events.test.ts › [Exit path] submitEventRequest rethrows an unexpected (non-permission, non-SubmitEventError) error instead of swallowing it",
  "tests/unit/organiser-attendee-events-access.test.ts › [Positive] the fetched events are passed to the client list, with no coordinator flag",
  // Registration-state boundaries SCRUM-72, SCRUM-74 and SCRUM-75 all rely on.
  "tests/unit/registration-state.test.ts › Boundary: zero registrations against zero capacity is zero remaining, not negative",
  "tests/unit/registration-state.test.ts › Precedence: a manual close wins over an otherwise-full event",
  "tests/unit/registration-state.test.ts › Precedence: not-yet-open wins over full (nobody could have filled it yet)",
  "tests/unit/registration-state.test.ts › is true only for OPEN",
  "tests/unit/registration-state.test.ts › is the event start when no closing time is set",
  "tests/unit/registration-state.test.ts › is the closing time when it comes before the start",
  "tests/unit/registration-state.test.ts › is the start when the closing time comes after it",
  "tests/unit/registration-state.test.ts › is the closing time when no start is set",
  "tests/unit/registration-state.test.ts › is null when neither is set",
]);

const where = (t: Test) =>
  `${t.file}:${t.line} "${t.title.replaceAll(ANY, "${…}")}"`;

describe("SCRUM-236 — every test is titled after its story, criteria and case", () => {
  it("SCRUM-273 [AC1], SCRUM-236 [AC1] TC-236-01, SCRUM-232 [AC1]: a test its own story's doc cites names its story, criteria and case", () => {
    const wrong = tests
      // A title built wholly at run time, such as SCRUM-70's `${who} sees …`,
      // only has its prefix once it runs.
      .filter((t) => citedBy.has(t) && !t.title.startsWith(ANY))
      .filter((t) => {
        const groups = groupsOf(t.title);
        if (!groups) return true;
        // A test cited only by another story's case keeps its own story's
        // title, as #313 agreed, so it needn't name that case.
        const own = [...citedBy.get(t)!].filter((id) =>
          groups.some((g) => id.startsWith(`TC-${g.story}-`)),
        );
        return (
          own.length > 0 &&
          !groups.some((g) => g.cases.length > 0 || g.templated)
        );
      })
      .map(where);
    expect(wrong).toEqual([]);
  });

  it("SCRUM-273 [AC2], SCRUM-236 [AC2] TC-236-02: no title names a case under another story's key, a case that doesn't exist or was retired, or a criterion its case doesn't cover", () => {
    const wrong: string[] = [];
    for (const t of tests) {
      for (const g of groupsOf(t.title) ?? []) {
        for (const c of g.cases) {
          const known = cases.get(c.id);
          const why =
            c.story !== g.story
              ? `${c.id} sits under SCRUM-${g.story}`
              : !known
                ? `${c.id} has no test case`
                : known.retired
                  ? `${c.id} is retired or superseded`
                  : g.acs.length > 0 &&
                      known.acs.size > 0 &&
                      !g.acs.some((a) => known.acs.has(a))
                    ? `[AC${g.acs.join(", AC")}] isn't a criterion of ${c.id}`
                    : null;
          if (why) wrong.push(`${where(t)}: ${why}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it("SCRUM-273 [AC3], SCRUM-236 [AC3] TC-236-03, SCRUM-232 [AC3]: a test no doc cites carries its story's or chore's key, in its title or its describe, unless #313 left it plain", () => {
    const wrong = tests
      .filter((t) => !citedBy.has(t) && !t.todo)
      .filter(
        (t) => ![t.title, ...t.describes].some((s) => /SCRUM-\d+/.test(s)),
      )
      .filter((t) => !PLAIN.has(`${t.file} › ${t.title}`))
      .map(where);
    expect(wrong).toEqual([]);
  });
});

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, it, expect } from "vitest";

import {
  ANY,
  brokenCitations,
  citationsIn,
  formatBroken,
  testTitles,
  titleMatches,
} from "../../.github/scripts/check-citations.mjs";

const SCRIPT = resolve(".github/scripts/check-citations.mjs");

/** One test-case document whose only line is an Automated by paragraph. */
const doc = (automatedBy: string, path = "docs/testing/SCRUM-9.md") => ({
  path,
  text: `# SCRUM-9\n\n### TC-9-01\n\n**Automated by:** ${automatedBy}\n`,
});
const filesWith = (files: Record<string, string[]>) => (file: string) => files[file] ?? null;

// SCRUM-196 — every test case cites tests and files that exist. The fixtures
// cite epics (SCRUM-6, SCRUM-9), which have no test cases of their own, so no
// fixture reads as a real case.
describe("check-citations — SCRUM-196", () => {
  describe("which titles match a citation", () => {
    it("SCRUM-196 [AC1, AC4] TC-196-01: a citation of a title, word for word, matches it and no other", () => {
      const title = "SCRUM-9 [AC1] TC-9-01: a booking is refused";

      expect(titleMatches(title, title)).toBe(true);
      expect(titleMatches(title, "SCRUM-9 [AC1] TC-9-01: a booking is refused twice")).toBe(false);
      expect(titleMatches("SCRUM-9 [AC1] TC-9-01: a booking", title)).toBe(false);
    });

    it("SCRUM-196 [AC1, AC4] TC-196-02: a title shortened with … matches, wherever the … is, while its words still must", () => {
      const title = "SCRUM-9 [AC1, AC2] TC-9-01, TC-9-02: a booking is refused and nothing is written";

      expect(titleMatches("SCRUM-9 [AC1, AC2] TC-9-01, TC-9-02: a booking is refused …", title)).toBe(true);
      expect(titleMatches("… TC-9-02 …", title)).toBe(true);
      expect(titleMatches("SCRUM-9 [AC1, AC2] TC-9-01, TC-9-02: … nothing is written", title)).toBe(true);
      expect(titleMatches("SCRUM-9 [AC1, AC2] TC-9-01, TC-9-02: a booking is accepted …", title)).toBe(false);
      expect(titleMatches("… TC-9-03 …", title)).toBe(false);
    });

    it("SCRUM-196 [AC1, AC4] TC-196-03: a citation by key and case alone matches a title naming both", () => {
      const title = "SCRUM-6 [AC2] TC-6-02, SCRUM-9 [AC1] TC-9-01: a booking is refused";

      expect(titleMatches("SCRUM-9 … TC-9-01", title)).toBe(true);
      expect(titleMatches("TC-9-01", title)).toBe(true);
      expect(titleMatches("SCRUM-9 … TC-9-02", title)).toBe(false);
    });

    it("SCRUM-196 [AC1, AC4] TC-196-04: a templated title matches a citation of one of its values, and a citation keeping its placeholders", () => {
      const [title] = testTitles("it(`SCRUM-9 [AC3] ${tc}: ${path} refuses an overnight event`, () => {});");

      expect(title).toBe(`SCRUM-9 [AC3] ${ANY}: ${ANY} refuses an overnight event`);
      expect(titleMatches("SCRUM-9 [AC3] TC-9-04: a draft refuses an overnight event", title)).toBe(true);
      expect(titleMatches("SCRUM-9 [AC3] ${tc}: ${path} refuses an overnight event", title)).toBe(true);
      expect(titleMatches("SCRUM-9 [AC3] TC-9-04: … refuses an overnight event", title)).toBe(true);
      expect(titleMatches("SCRUM-9 [AC3] TC-9-04: a draft accepts an overnight event", title)).toBe(false);
    });

    it("SCRUM-196 [AC1, AC4] TC-196-04: an .each title's %s and $name stand for its rows, cited as written or as a value", () => {
      const titles = testTitles(
        [
          'it.each(["a", "b"])("SCRUM-9 [AC1] TC-9-01: %s is refused", () => {});',
          'it.each(rows)("SCRUM-9 [AC2] TC-9-02: a draft with $rule is refused", () => {});',
          'describe.each(rows)("$path — SCRUM-9", () => {});',
          'it("SCRUM-9 [AC3] TC-9-03: costs $total, not more", () => {});',
        ].join("\n"),
      );

      expect(titles).toEqual([
        `SCRUM-9 [AC1] TC-9-01: ${ANY} is refused`,
        `SCRUM-9 [AC2] TC-9-02: a draft with ${ANY} is refused`,
        `${ANY} — SCRUM-9`,
        "SCRUM-9 [AC3] TC-9-03: costs $total, not more",
      ]);
      expect(titleMatches("SCRUM-9 [AC1] TC-9-01: %s is refused", titles[0])).toBe(true);
      expect(titleMatches("SCRUM-9 [AC1] TC-9-01: an empty name is refused", titles[0])).toBe(true);
      expect(titleMatches("SCRUM-9 [AC2] TC-9-02: a draft with $rule is refused", titles[1])).toBe(true);
    });
  });

  describe("which titles a test file has", () => {
    it("SCRUM-196 [AC1] TC-196-05: titles come from it, test and describe calls, and not from comments, strings or hooks", () => {
      const source = [
        "// it(\"SCRUM-9 [AC1] TC-9-01: only in a comment\", () => {});",
        'const row = { name: "SCRUM-9 [AC1] TC-9-02: only in test data" };',
        'test.describe.serial("SCRUM-9: the booking page", () => {',
        "  test.beforeEach(async () => {});",
        '  test.describe.configure({ mode: "serial" });',
        '  test("SCRUM-9 [AC1] TC-9-03: " + "a booking is refused", async () => {});',
        '  it.skip("SCRUM-9 [AC2] TC-9-04: a skipped test still has its title", () => {});',
        "});",
      ].join("\n");

      expect(testTitles(source)).toEqual([
        "SCRUM-9: the booking page",
        "SCRUM-9 [AC1] TC-9-03: a booking is refused",
        "SCRUM-9 [AC2] TC-9-04: a skipped test still has its title",
      ]);
    });
  });

  describe("which quotes in a document are citations", () => {
    it("SCRUM-196 [AC1] TC-196-06: each quoted title, or case id right after a test file's ›, is a citation of that file; a case id after a title is prose", () => {
      const cited = citationsIn(
        '**Automated by:** `tests/unit/a.test.ts` › TC-9-07; `tests/unit/a.test.ts` › "first", "second" and TC-9-08; `e2e/b.spec.ts` › the two "third" tests',
      );

      expect(cited.map(({ file, cited, kind }) => [file, cited, kind])).toEqual([
        ["tests/unit/a.test.ts", "TC-9-07", "case"],
        ["tests/unit/a.test.ts", "first", "title"],
        ["tests/unit/a.test.ts", "second", "title"],
        ["e2e/b.spec.ts", "third", "title"],
      ]);
    });

    it("SCRUM-196 [AC1] TC-196-06: a quote in prose, after a sentence ends or in parentheses with no file of their own, is not a citation", () => {
      const cited = citationsIn(
        [
          '**Automated by:** `tests/unit/a.test.ts` › "first" (the "Venue Staff" row). The notice reads',
          '"Venue unavailable" and names the venue (`tests/unit/b.test.ts` › "second"), so TC-9-02 is',
          'covered; `tests/unit/c.test.ts` › "third", which also checks TC-9-03.',
        ].join("\n"),
      );

      expect(cited.map(({ file, cited }) => [file, cited])).toEqual([
        ["tests/unit/a.test.ts", "first"],
        ["tests/unit/b.test.ts", "second"],
        ["tests/unit/c.test.ts", "third"],
      ]);
    });
  });

  describe("what is reported", () => {
    it("SCRUM-196 [AC1, AC2, AC4] TC-196-07: a title no test in the cited file has is reported with its document, line and citation", () => {
      const { checked, broken } = brokenCitations(
        [doc('`tests/unit/a.test.ts` › "SCRUM-9 [AC1] TC-9-01: a booking is refused", "SCRUM-9 [AC1] TC-9-01: a renamed test"')],
        filesWith({
          "tests/unit/a.test.ts": ["SCRUM-9 [AC1] TC-9-01: a booking is refused"],
          "tests/unit/b.test.ts": ["SCRUM-9 [AC1] TC-9-01: a renamed test"],
        }),
      );

      expect(checked).toBe(2);
      expect(broken).toEqual([
        {
          doc: "docs/testing/SCRUM-9.md",
          line: 5,
          file: "tests/unit/a.test.ts",
          cited: "SCRUM-9 [AC1] TC-9-01: a renamed test",
          kind: "title",
          problem: "no test in the file has this title",
        },
      ]);
      expect(formatBroken(broken[0])).toBe(
        'docs/testing/SCRUM-9.md:5: `tests/unit/a.test.ts` › "SCRUM-9 [AC1] TC-9-01: a renamed test": no test in the file has this title',
      );
    });

    it("SCRUM-196 [AC1, AC2, AC4] TC-196-07: a case id no title in the cited file names is reported", () => {
      const { broken } = brokenCitations([doc("`tests/unit/a.test.ts` › TC-9-02")], filesWith({ "tests/unit/a.test.ts": ["SCRUM-9 [AC1] TC-9-01: x"] }));

      expect(broken.map(formatBroken)).toEqual([
        "docs/testing/SCRUM-9.md:5: `tests/unit/a.test.ts` › TC-9-02: no test title in the file names this case",
      ]);
    });

    it("SCRUM-196 [AC1, AC2, AC4] TC-196-08: a cited file that doesn't exist is reported, on the line it is cited", () => {
      const text = [
        "# SCRUM-9",
        "",
        '**Automated by:** `tests/unit/a.test.ts` › "SCRUM-9 [AC1] TC-9-01: x";',
        '`e2e/deleted.spec.ts` › "SCRUM-9 [AC1] TC-9-01: y"',
        "",
        "**Expected:** the booking is refused.",
      ].join("\n");
      const { checked, broken } = brokenCitations(
        [{ path: "docs/testing/SCRUM-9.md", text }],
        filesWith({ "tests/unit/a.test.ts": ["SCRUM-9 [AC1] TC-9-01: x"] }),
      );

      expect(checked).toBe(2);
      expect(broken.map(formatBroken)).toEqual([
        'docs/testing/SCRUM-9.md:4: `e2e/deleted.spec.ts` › "SCRUM-9 [AC1] TC-9-01: y": the file does not exist',
      ]);
    });

    it("SCRUM-196 [AC1] TC-196-08: only Automated by paragraphs are read, so a file named in a step or note is not a citation", () => {
      const text = [
        "# SCRUM-9",
        "",
        '1. Open `e2e/old.spec.ts` › "a title in a step".',
        "",
        '**Automated by:** `tests/unit/a.test.ts` › "x"',
        '**Expected:** like `e2e/old.spec.ts` › "another".',
      ].join("\n");

      const { checked, broken } = brokenCitations([{ path: "docs/testing/SCRUM-9.md", text }], filesWith({ "tests/unit/a.test.ts": ["x"] }));

      expect({ checked, broken }).toEqual({ checked: 1, broken: [] });
    });
  });

  describe("the check in CI", () => {
    let dir: string | undefined;
    afterEach(() => {
      if (dir) rmSync(dir, { recursive: true, force: true });
      dir = undefined;
    });

    /** Runs the script in a repo holding these files; its output and exit code. */
    const run = (files: Record<string, string>) => {
      dir = mkdtempSync(join(tmpdir(), "citations-"));
      for (const [path, text] of Object.entries(files)) {
        mkdirSync(join(dir, path, ".."), { recursive: true });
        writeFileSync(join(dir, path), text);
      }
      try {
        const out = execFileSync(process.execPath, [SCRIPT], { cwd: dir, encoding: "utf8", env: { ...process.env, GITHUB_ACTIONS: "true" } });
        return { status: 0, out };
      } catch (error) {
        const { status, stdout } = error as { status: number; stdout: string };
        return { status, out: stdout };
      }
    };

    it("SCRUM-196 [AC2] TC-196-09: a broken citation fails the run, naming the document, line and citation, as an error on the document", () => {
      const result = run({
        "docs/testing/SCRUM-9.md": doc('`tests/unit/a.test.ts` › "SCRUM-9 [AC1] TC-9-01: a renamed test"').text,
        "tests/unit/a.test.ts": 'it("SCRUM-9 [AC1] TC-9-01: a booking is refused", () => {});\n',
      });

      expect(result.status).toBe(1);
      expect(result.out).toContain(
        'docs/testing/SCRUM-9.md:5: `tests/unit/a.test.ts` › "SCRUM-9 [AC1] TC-9-01: a renamed test": no test in the file has this title',
      );
      expect(result.out).toContain("::error file=docs/testing/SCRUM-9.md,line=5::");
      expect(result.out).toContain("Test-case citations checked: 1, in 1 documents. Broken: 1.");
    });

    it("SCRUM-196 [AC2] TC-196-09: with every citation found, the run passes", () => {
      const result = run({
        "docs/testing/SCRUM-9.md": doc('`e2e/a.spec.ts` › "SCRUM-9 [AC1] TC-9-01: a booking is refused"').text,
        "docs/testing/README.md": doc('`e2e/missing.spec.ts` › "the index is not a test-case document"').text,
        "e2e/a.spec.ts": 'test("SCRUM-9 [AC1] TC-9-01: a booking is refused", async () => {});\n',
        "tests/unit/b.test.ts": "",
      });

      expect(result).toEqual({ status: 0, out: "Test-case citations checked: 1, in 1 documents. Broken: 0.\n" });
    });

    it("SCRUM-196 [AC2] TC-196-10: CI runs the check on every pull request, before the tests", () => {
      const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
      const scripts = JSON.parse(readFileSync("package.json", "utf8")).scripts;

      expect(workflow).toMatch(/^on:\r?\n(?:[ \t].*\r?\n)*?[ \t]+pull_request:/m);
      expect(scripts["check:citations"]).toBe("node .github/scripts/check-citations.mjs");
      expect(workflow.indexOf("run: npm run check:citations")).toBeGreaterThan(-1);
      expect(workflow.indexOf("run: npm run check:citations")).toBeLessThan(workflow.indexOf("run: npm run test:coverage"));
      expect(scripts.verify).toContain("npm run check:citations");
    });
  });
});

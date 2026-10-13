import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, it, expect } from "vitest";

// SCRUM-146 — every story key the code cites must still mean something. A key
// with no file in docs/backlog was deleted from Jira; a file titled
// "[MERGED INTO …]", "[SUPERSEDED BY …]" and so on is retired, and may only be
// cited where the citation says so, as in "SCRUM-33 merged in". This keeps
// stale keys from coming back once they are cleaned up (AC5, AC6).

const ROOT = process.cwd();
const BACKLOG = join(ROOT, "docs", "backlog");
const SCANNED_DIRS = ["app", "lib", "components", "tests", "e2e"];
const SCANNED_FILES = [
  "prisma/schema.prisma",
  "prisma/seed.ts",
  "auth.ts",
  "auth.config.ts",
  "proxy.ts",
];
const CODE = /\.(?:[cm]?[jt]sx?|prisma)$/;
/**
 * What excuses a retired key: words about the key itself, straight after it,
 * as in "SCRUM-33 merged in" or "SCRUM-33 (superseded by SCRUM-27)". A word
 * elsewhere on the line, such as "duplicate rows are refused", doesn't.
 */
const SAYS_SO =
  /^[\s,(]*(?:is |was |has been )?(?:merged in|superseded by|replaced by|duplicate of|covered by|not needed|dropped)/i;

/**
 * Lines that may cite a stale key, each with why, matched on their trimmed
 * text. An exception covers only the lines it names, and it expires: the test
 * below fails once a named line is gone, so the change that fixes a reference
 * also removes its exception, and the key can't come back unnoticed.
 */
const ALLOWED: Record<string, { lines: string[]; why: string }> = {
  "tests/unit/ai-review.test.ts": {
    lines: [
      'expect(extractStoryKeys("SCRUM-1-2-3-4-5-6-7-8", "", "")).toHaveLength(6);',
      'file("app/(app)/x.ts", "// SCRUM-310 is a different story"),',
      'stories: ["SCRUM-31", "SCRUM-999"],',
      'expect(body).toContain("No `docs/backlog` file on `main` for SCRUM-999");',
    ],
    why: "made-up keys in tests of the reviewer's key parsing",
  },
};

/**
 * "SCRUM-41/42/43" cites SCRUM-41, SCRUM-42 and SCRUM-43, each with the text
 * that follows the citation.
 */
function citedKeys(line: string): { key: string; after: string }[] {
  return [...line.matchAll(/\bSCRUM-(\d+(?:\/\d+)*)\b/g)].flatMap((match) =>
    match[1].split("/").map((n) => ({
      key: `SCRUM-${n}`,
      after: line.slice(match.index + match[0].length),
    })),
  );
}

type KeyStatus = { kind: "live" } | { kind: "retired"; tag: string };

/** Every key docs/backlog knows: one file per item, plus the epics in the index. */
function backlogKeys(): Map<string, KeyStatus> {
  const keys = new Map<string, KeyStatus>();
  for (const file of readdirSync(BACKLOG).filter((f) =>
    /^SCRUM-\d+\.md$/.test(f),
  )) {
    const title =
      readFileSync(join(BACKLOG, file), "utf8")
        .split(/\r?\n/)
        .find((line) => line.startsWith("# ")) ?? "";
    const tag = title.match(
      /^# SCRUM-\d+ - (\[(?:MERGED INTO|SUPERSEDED BY|DUPLICATE OF|COVERED BY|NOT NEEDED)[^\]]*\])/,
    );
    keys.set(
      file.replace(/\.md$/, ""),
      tag ? { kind: "retired", tag: tag[1] } : { kind: "live" },
    );
  }
  for (const epic of readFileSync(join(BACKLOG, "README.md"), "utf8").matchAll(
    /^## (SCRUM-\d+) - /gm,
  )) {
    keys.set(epic[1], { kind: "live" });
  }
  return keys;
}

/** The stale references in one file's text, as "line: reason". */
function staleReferences(
  text: string,
  file: string,
  keys: Map<string, KeyStatus>,
): string[] {
  const allowed = new Set(ALLOWED[file]?.lines ?? []);
  const found: string[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (allowed.has(line.trim())) return;
    for (const { key, after } of citedKeys(line)) {
      const status = keys.get(key);
      if (!status)
        found.push(
          `${file}:${i + 1}: ${key} isn't in docs/backlog (deleted from Jira, or the sync is overdue)`,
        );
      else if (status.kind === "retired" && !SAYS_SO.test(after))
        found.push(
          `${file}:${i + 1}: ${key} is ${status.tag}; cite the story that replaced it, or say so right after the key ("${key} merged in")`,
        );
    }
  });
  return found;
}

function codeFiles(): string[] {
  const files = SCANNED_FILES.filter((f) => existsSync(join(ROOT, f)));
  for (const dir of SCANNED_DIRS) {
    for (const entry of readdirSync(join(ROOT, dir), {
      recursive: true,
    }) as string[]) {
      if (CODE.test(entry))
        files.push(
          relative(ROOT, join(ROOT, dir, entry))
            .split(sep)
            .join("/"),
        );
    }
  }
  return files.filter((f) => f !== "tests/unit/story-keys.test.ts");
}

describe("SCRUM-146 story keys in the code", () => {
  const keys = backlogKeys();

  it("SCRUM-146 [AC5, AC6]: the code cites no deleted key, and no merged one without saying so", () => {
    const stale = codeFiles().flatMap((file) =>
      staleReferences(readFileSync(join(ROOT, file), "utf8"), file, keys),
    );
    expect(stale).toEqual([]);
  });

  it("SCRUM-146 [AC5]: every allowed line is still in its file, so a fixed one's exception is removed", () => {
    const expired = Object.entries(ALLOWED).flatMap(([file, { lines }]) => {
      const present = new Set(
        existsSync(join(ROOT, file))
          ? readFileSync(join(ROOT, file), "utf8")
              .split(/\r?\n/)
              .map((line) => line.trim())
          : [],
      );
      return lines
        .filter((line) => !present.has(line))
        .map(
          (line) =>
            `${file} no longer has the line ${line}: delete it from ALLOWED`,
        );
    });
    expect(expired).toEqual([]);
  });

  it("SCRUM-146 [AC5]: the check catches a deleted key and an unexplained merged one", () => {
    const planted = new Map<string, KeyStatus>([
      ["SCRUM-27", { kind: "live" }],
      ["SCRUM-33", { kind: "retired", tag: "[MERGED INTO SCRUM-27]" }],
    ]);
    expect(
      staleReferences("// SCRUM-27 lists requests", "x.ts", planted),
    ).toEqual([]);
    expect(
      staleReferences("// SCRUM-12345 does this", "x.ts", planted),
    ).toHaveLength(1);
    expect(
      staleReferences("// SCRUM-33 views reservations", "x.ts", planted),
    ).toHaveLength(1);
    expect(
      staleReferences("// SCRUM-27 (SCRUM-33 merged in)", "x.ts", planted),
    ).toEqual([]);
    expect(
      staleReferences("// SCRUM-33 (superseded by SCRUM-27)", "x.ts", planted),
    ).toEqual([]);
    expect(
      staleReferences(
        "// SCRUM-33: duplicate rows are refused",
        "x.ts",
        planted,
      ),
    ).toHaveLength(1);
    expect(
      staleReferences("// SCRUM-33 lists; SCRUM-27 merged in", "x.ts", planted),
    ).toHaveLength(1);
  });

  it("SCRUM-146 [AC5]: the check reads every key of a slash list, and an exception covers only its own line", () => {
    const planted = new Map<string, KeyStatus>([
      ["SCRUM-27", { kind: "live" }],
      ["SCRUM-31", { kind: "live" }],
      ["SCRUM-33", { kind: "retired", tag: "[MERGED INTO SCRUM-27]" }],
    ]);
    expect(
      staleReferences("// SCRUM-27/31 reserve equipment", "x.ts", planted),
    ).toEqual([]);
    expect(
      staleReferences("// SCRUM-27/31/33 reserve equipment", "x.ts", planted),
    ).toHaveLength(1);
    expect(
      staleReferences("// SCRUM-27/12345/54321", "x.ts", planted),
    ).toHaveLength(2);
    const file = "tests/unit/ai-review.test.ts";
    const exempt = ALLOWED[file].lines[2];
    expect(staleReferences(exempt, file, planted)).toEqual([]);
    expect(
      staleReferences(`${exempt}\n// SCRUM-999 elsewhere`, file, planted),
    ).toHaveLength(1);
  });

  it("SCRUM-146 [AC1]: the Notifications page cites SCRUM-48", () => {
    expect(
      readFileSync(join(ROOT, "app/(app)/notifications/page.tsx"), "utf8"),
    ).toContain("SCRUM-48");
  });

  it("SCRUM-146 [AC2]: My Registrations cites SCRUM-76", () => {
    expect(
      readFileSync(join(ROOT, "app/(app)/registrations/page.tsx"), "utf8"),
    ).toContain("SCRUM-76");
  });

  it("SCRUM-146 [AC3]: the Venue Catalogue placeholder cites SCRUM-34", () => {
    expect(
      readFileSync(join(ROOT, "app/(app)/venues/page.tsx"), "utf8"),
    ).toContain('scrumId="SCRUM-34"');
  });
});

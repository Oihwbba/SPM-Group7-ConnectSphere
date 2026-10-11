import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, it, expect } from "vitest";

// SCRUM-146 — every story key the code cites must still mean something. A key
// with no file in docs/backlog was deleted from Jira; a file titled
// "[MERGED INTO …]", "[SUPERSEDED BY …]" and so on is retired, and may only be
// cited on a line that says so. This keeps stale keys from coming back once
// they are cleaned up (AC5, AC6).

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
const SAYS_SO =
  /merged|superseded|replaced|duplicate|covered by|not needed|dropped/i;

/**
 * Keys that may be cited although they are stale, each with why. Remove an
 * entry as soon as its reason stops being true.
 */
const ALLOWED: Record<string, { keys: string[]; why: string }> = {
  "tests/unit/ai-review.test.ts": {
    keys: ["SCRUM-1", "SCRUM-310", "SCRUM-999"],
    why: "made-up keys in tests of the reviewer's key parsing",
  },
  "app/(app)/notifications/page.tsx": {
    keys: ["SCRUM-51"],
    why: "the placeholder page #153 (SCRUM-48) replaces",
  },
  "prisma/schema.prisma": {
    keys: ["SCRUM-42", "SCRUM-43", "SCRUM-47"],
    why: "the EventChangeRequest header #162 (SCRUM-41) rewrites",
  },
};

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
  const allowed = new Set(ALLOWED[file]?.keys ?? []);
  const found: string[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    for (const match of line.matchAll(/\bSCRUM-\d+\b/g)) {
      const key = match[0];
      if (allowed.has(key)) continue;
      const status = keys.get(key);
      if (!status)
        found.push(
          `${file}:${i + 1}: ${key} isn't in docs/backlog (deleted from Jira, or the sync is overdue)`,
        );
      else if (status.kind === "retired" && !SAYS_SO.test(line))
        found.push(
          `${file}:${i + 1}: ${key} is ${status.tag}; cite the story that replaced it, or say it was merged`,
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

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";

// SCRUM-197 AC4 — the README points to the AI-usage and ownership documents.
// Read from the file itself, so dropping either link turns this red
// (SCRUM-271: TC-197-04 was checked by hand).
const readme = readFileSync("README.md", "utf8").replace(/\r\n/g, "\n");

function section(heading: string) {
  const start = readme.indexOf(`\n## ${heading}\n`);
  return readme.slice(start, readme.indexOf("\n## ", start + 1));
}

/** The entries listed directly under `docs/` in Project layout's tree. */
function docsEntries() {
  const tree = section("Project layout").split("\n");
  const entries: string[] = [];
  for (let i = tree.indexOf("docs/") + 1; i < tree.length; i++) {
    const entry = tree[i].match(/^ {2}(\S+)/);
    if (!entry) break;
    entries.push(entry[1]);
  }
  return entries;
}

describe("SCRUM-197 AC4 — the README points to both documents", () => {
  it("SCRUM-271 [AC2], SCRUM-197 [AC4] TC-197-04: Start here links docs/ai-usage.md and docs/ownership.md, and both exist", () => {
    const startHere = section("Start here");
    expect(startHere).toContain("](docs/ai-usage.md)");
    expect(startHere).toContain("](docs/ownership.md)");
    expect(existsSync("docs/ai-usage.md")).toBe(true);
    expect(existsSync("docs/ownership.md")).toBe(true);
  });

  it("SCRUM-271 [AC2], SCRUM-197 [AC4] TC-197-04: Project layout lists ai-usage.md and ownership.md under docs/", () => {
    expect(docsEntries()).toEqual(
      expect.arrayContaining(["ai-usage.md", "ownership.md"]),
    );
  });
});

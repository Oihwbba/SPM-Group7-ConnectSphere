import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// SCRUM-164 AC5 — the product overview names every role. Read from the file
// itself, so removing a role's row turns this red.
const overview = readFileSync("docs/product-context.md", "utf8");
const whoUsesIt = overview.slice(
  overview.indexOf("## Who uses it"),
  overview.indexOf("\n## ", overview.indexOf("## Who uses it") + 1),
);
const rows = whoUsesIt
  .split("\n")
  .map((line) => line.match(/^\| \*\*(.+?)\*\* \|/)?.[1])
  .filter(Boolean);

describe("SCRUM-164 AC5 — the product overview", () => {
  it("SCRUM-164 [AC5] TC-164-06: the product overview lists all seven roles", () => {
    expect(rows).toEqual([
      "Event Organiser",
      "Event Coordinator",
      "Venue Staff",
      "Technical Support Staff",
      "Attendee",
      "Event Coordinator Lead",
      "Safety Officer",
    ]);
  });
});

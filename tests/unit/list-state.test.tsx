import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ListState } from "@/components/events/list-state";

// SCRUM-209 (GLM review of #282) — an Arrangements section whose list isn't
// read yet, or couldn't be, says so instead of claiming nothing was requested.
// Test cases: docs/testing/SCRUM-209.md.
describe("SCRUM-209 — a section's list while it loads", () => {
  const render = (state: "loading" | "ready" | "failed") =>
    renderToStaticMarkup(
      <ListState state={state} what="equipment requests">
        No equipment requested yet.
      </ListState>,
    );

  it("SCRUM-209 [AC2] TC-209-13: while the list loads, it says Loading…, not that nothing was requested", () => {
    const html = render("loading");
    expect(html).toContain("Loading…");
    expect(html).toContain('role="status"');
    expect(html).not.toContain("No equipment requested yet.");
  });

  it("SCRUM-209 [AC2] TC-209-13: a list that couldn't be read says so", () => {
    const html = render("failed");
    expect(html).toContain("Couldn&#x27;t load the equipment requests.");
    expect(html).toContain('role="alert"');
    expect(html).not.toContain("No equipment requested yet.");
  });

  it("SCRUM-209 [AC2] TC-209-13: once read and empty, it says nothing was requested", () => {
    expect(render("ready")).toContain("No equipment requested yet.");
  });
});

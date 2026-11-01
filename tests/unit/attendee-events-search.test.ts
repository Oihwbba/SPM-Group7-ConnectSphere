import { describe, it, expect } from "vitest";

import { filterBrowsableEvents } from "@/app/(app)/events/attendee-events-client";

// SCRUM-72 review — keyword search over the attendee browse list. Pure, so no
// mocking: the list it narrows is already SCRUM-72's Confirmed-only list.
const events = [
  { name: "Career Fair", description: "Meet employers on campus." },
  { name: "Wine Tasting Evening", description: null },
  { name: "Summer Camp", description: "Outdoor CAREER workshops for teens." },
];

describe("filterBrowsableEvents — SCRUM-72 review", () => {
  it("SCRUM-72 [AC1] TC-72-08: [Positive] keeps events whose name contains the keyword", () => {
    expect(filterBrowsableEvents(events, "wine").map((e) => e.name)).toEqual([
      "Wine Tasting Evening",
    ]);
  });

  it("SCRUM-72 [AC1] TC-72-08: [Positive] matches the description too, ignoring upper/lower case", () => {
    expect(filterBrowsableEvents(events, "Career").map((e) => e.name)).toEqual([
      "Career Fair",
      "Summer Camp",
    ]);
  });

  it("SCRUM-72 [AC1] TC-72-08: [Positive] a blank or whitespace keyword keeps every event", () => {
    expect(filterBrowsableEvents(events, "   ")).toEqual(events);
  });

  it("SCRUM-72: [Negative] a keyword nothing contains returns no events", () => {
    expect(filterBrowsableEvents(events, "zzz")).toEqual([]);
  });

  it("SCRUM-72 [AC1] TC-72-08: [Boundary] trims surrounding spaces before matching", () => {
    expect(
      filterBrowsableEvents(events, "  tasting ").map((e) => e.name),
    ).toEqual(["Wine Tasting Evening"]);
  });
});

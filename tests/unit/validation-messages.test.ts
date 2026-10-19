import { describe, it, expect } from "vitest";

import { requestFieldValues } from "@/lib/schemas/clarification";

// SCRUM-132 AC4 — a validation error says which field to fix and how, never
// Zod's generic "String must contain at least 1 character(s)".
describe("SCRUM-132 validation messages", () => {
  const dates = requestFieldValues.pick({ startAt: true, endAt: true });

  it("SCRUM-132 [AC4] TC-132-08: an empty start or end names the field and asks for a date and time", () => {
    const parsed = dates.safeParse({ startAt: "", endAt: "" });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.flatten().fieldErrors).toEqual({
      startAt: ["Choose the start date and time."],
      endAt: ["Choose the end date and time."],
    });
  });

  it("SCRUM-132 [AC4] TC-132-08: a start and end that are given pass this check", () => {
    expect(
      dates.safeParse({
        startAt: "2031-06-01T01:00:00.000Z",
        endAt: "2031-06-01T05:00:00.000Z",
      }).success,
    ).toBe(true);
  });
});

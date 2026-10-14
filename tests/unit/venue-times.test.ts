import { describe, it, expect } from "vitest";

import { venueTimesSchema } from "@/lib/schemas/venue";

// SCRUM-159 AC1 — a venue's setup and turnaround time are each a whole number
// of minutes from 0 to 1,440; anything else is refused and the field named.
// The database refuses the same values (tests/integration/setup-turnaround.test.ts).
describe("venueTimesSchema — SCRUM-159", () => {
  it("SCRUM-159 [AC1] TC-159-01: whole minutes from 0 to 1,440 are accepted, including both ends and form strings", () => {
    for (const [setupMinutes, turnaroundMinutes] of [
      [0, 0],
      [30, 45],
      [1440, 1440],
      ["30", "45"],
    ]) {
      expect(
        venueTimesSchema.parse({ setupMinutes, turnaroundMinutes }),
      ).toEqual({
        setupMinutes: Number(setupMinutes),
        turnaroundMinutes: Number(turnaroundMinutes),
      });
    }
  });

  it("SCRUM-159 [AC1] TC-159-02: a negative, too-large, fractional, blank or non-numeric setup time is refused against the setup field only", () => {
    const message =
      "Setup time must be a whole number of minutes from 0 to 1,440.";
    for (const setupMinutes of [-1, 1441, 30.5, "", "abc", null, undefined]) {
      const result = venueTimesSchema.safeParse({
        setupMinutes,
        turnaroundMinutes: 45,
      });

      expect(result.success).toBe(false);
      expect(result.error?.flatten().fieldErrors).toEqual({
        setupMinutes: [message],
      });
    }
  });

  it("SCRUM-159 [AC1] TC-159-02: a turnaround time out of range is refused against the turnaround field, with its own name", () => {
    const result = venueTimesSchema.safeParse({
      setupMinutes: 30,
      turnaroundMinutes: 1441,
    });

    expect(result.error?.flatten().fieldErrors).toEqual({
      turnaroundMinutes: [
        "Turnaround time must be a whole number of minutes from 0 to 1,440.",
      ],
    });
  });
});

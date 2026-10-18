import { describe, it, expect } from "vitest";

import {
  describeChanges,
  eventUpdateFrom,
  isImpactful,
  outdatesSafetyCheck,
} from "@/lib/change-application";

// SCRUM-128 — turning an approved change request into the event's new values,
// and what it touches. Test cases: docs/testing/SCRUM-128.md.

const change = (fieldName: string, newValue: string | null, isMajor = false) => ({
  fieldName,
  newValue,
  isMajor,
});

describe("eventUpdateFrom — SCRUM-128 AC2", () => {
  it("SCRUM-128 [AC2] TC-128-02: reads the start and end back as dates, the attendance as a number, text as text, and a cleared field as empty", () => {
    expect(
      eventUpdateFrom([
        change("startAt", "2032-05-02T02:00:00.000Z", true),
        change("endAt", "2032-05-02T04:00:00.000Z", true),
        change("expectedAttendance", "80", true),
        change("description", "A longer talk."),
        change("programme", null),
      ]),
    ).toEqual({
      startAt: new Date("2032-05-02T02:00:00.000Z"),
      endAt: new Date("2032-05-02T04:00:00.000Z"),
      expectedAttendance: 80,
      description: "A longer talk.",
      programme: null,
    });
  });
});

describe("isImpactful and outdatesSafetyCheck — SCRUM-128 AC4–AC6", () => {
  it("SCRUM-128 [AC4, AC6] TC-128-04: a change is impactful when any field SCRUM-41 marked major changed", () => {
    expect(isImpactful([change("description", "x"), change("expectedAttendance", "9", true)])).toBe(true);
    expect(isImpactful([change("description", "x"), change("name", "y")])).toBe(false);
  });

  it("SCRUM-128 [AC4] TC-128-04: an impactful change, or one to the layout or accessibility needs, outdates a safety check; other edits don't", () => {
    expect(outdatesSafetyCheck([change("venueRequirements", "x", true)])).toBe(true);
    expect(outdatesSafetyCheck([change("preferredLayout", "Banquet")])).toBe(true);
    expect(outdatesSafetyCheck([change("accessibilityNeeds", "Ramp")])).toBe(true);
    expect(outdatesSafetyCheck([change("description", "x"), change("programme", "y")])).toBe(false);
  });
});

describe("describeChanges — SCRUM-128 AC4, AC10", () => {
  it("SCRUM-128 [AC10] TC-128-09: names each field once, the start and end together as the date and time", () => {
    expect(
      describeChanges([
        change("startAt", "a", true),
        change("endAt", "b", true),
        change("expectedAttendance", "9", true),
      ]),
    ).toBe("Date and time, Expected attendance");
  });
});

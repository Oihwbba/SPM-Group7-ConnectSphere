import { describe, expect, it } from "vitest";

import {
  createDraftEventSchema,
  submitEventRequestSchema,
} from "@/lib/schemas/event";

const futureStart = new Date(Date.now() + 86_400_000).toISOString();
const futureEnd = new Date(Date.now() + 90_000_000).toISOString();
const pastStart = new Date(Date.now() - 86_400_000).toISOString();

const validSubmitInput = {
  name: "Planning Summit",
  purpose: "Annual planning",
  description: "A cross-functional planning event.",
  startAt: futureStart,
  endAt: futureEnd,
  expectedAttendance: 30,
  venueRequirements: "Seminar room",
  accessibilityNeeds: "Wheelchair access",
  preferredLayout: "Classroom",
  equipmentRequirements: "Projector",
  registrationNotes: "Staff check-in",
};

describe("event schemas", () => {
  describe("createDraftEventSchema", () => {
    it("defaults optional arrays and timezone while accepting Date instances", () => {
      const parsed = createDraftEventSchema.parse({
        name: " Draft workshop ",
        startAt: new Date(futureStart),
        endAt: new Date(futureEnd),
        expectedAttendance: "25",
      });

      expect(parsed.name).toBe("Draft workshop");
      expect(parsed.requiredFacilities).toEqual([]);
      expect(parsed.timezone).toBe("Asia/Singapore");
      expect(parsed.expectedAttendance).toBe(25);
    });

    it.each([
      ["startAt", "not-a-date", futureEnd, "Invalid start date format."],
      ["startAt", pastStart, futureEnd, "Proposed date cannot be in the past."],
      ["endAt", futureStart, "not-a-date", "Invalid end date format."],
      [
        "endAt",
        futureEnd,
        futureStart,
        "Proposed end date and time must be strictly after the start date and time.",
      ],
    ])("reports invalid draft %s values", (_field, startAt, endAt, message) => {
      const result = createDraftEventSchema.safeParse({
        name: "Draft workshop",
        startAt,
        endAt,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.map((issue) => issue.message)).toContain(message);
      }
    });

    it.each(["", null, undefined])(
      "treats empty draft attendance value %s as omitted",
      (expectedAttendance) => {
        const result = createDraftEventSchema.safeParse({
          name: "Draft workshop",
          expectedAttendance,
        });

        expect(result.success).toBe(true);
        if (result.success) expect(result.data.expectedAttendance).toBeUndefined();
      },
    );
  });

  describe("submitEventRequestSchema", () => {
    it("trims fields, defaults arrays and timezone, and coerces attendance", () => {
      const parsed = submitEventRequestSchema.parse({
        ...validSubmitInput,
        name: " Planning Summit ",
        expectedAttendance: "40",
      });

      expect(parsed.name).toBe("Planning Summit");
      expect(parsed.requiredFacilities).toEqual([]);
      expect(parsed.timezone).toBe("Asia/Singapore");
      expect(parsed.expectedAttendance).toBe(40);
    });

    it.each([
      ["startAt", "not-a-date", futureEnd, "Invalid start date format."],
      ["startAt", pastStart, futureEnd, "Proposed date cannot be in the past."],
      ["endAt", futureStart, "not-a-date", "Invalid end date format."],
      [
        "endAt",
        futureEnd,
        futureStart,
        "Proposed end date and time must be strictly after the start date and time.",
      ],
    ])("reports invalid submit %s values", (_field, startAt, endAt, message) => {
      const result = submitEventRequestSchema.safeParse({
        ...validSubmitInput,
        startAt,
        endAt,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.map((issue) => issue.message)).toContain(message);
      }
    });

    it.each(["", null, undefined])(
      "requires attendance when submit value is %s",
      (expectedAttendance) => {
        const result = submitEventRequestSchema.safeParse({
          ...validSubmitInput,
          expectedAttendance,
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.flatten().fieldErrors.expectedAttendance).toContain(
            "Attendance must be a positive whole number.",
          );
        }
      },
    );
  });
});

import { describe, it, expect, vi } from "vitest";

import {
  firstStepWithError,
  getInitialFormData,
  REENTER_PERIOD_MESSAGE,
  storedAcrossTwoDays,
} from "@/app/(app)/events/create-event-dialog";
import { joinEventPeriod } from "@/lib/datetime";

// SCRUM-190 AC3 — how the request form reopens a saved request. The actions
// and the router are never reached: the stored request is given directly.
vi.mock("@/app/(app)/events/actions", () => ({
  createDraftEvent: vi.fn(),
  submitEventRequest: vi.fn(),
  getFormCatalogues: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

// Saved before the one-day rule: 09:00 SGT on 3 Mar 2036 to 17:00 SGT on 4 Mar.
const twoDays = {
  id: "evt_1",
  name: "Two-day summit",
  startAt: new Date("2036-03-03T01:00:00.000Z"),
  endAt: new Date("2036-03-04T09:00:00.000Z"),
};

describe("reopening a request saved across two days — SCRUM-190 AC3", () => {
  it.each(["DRAFT", "REJECTED"])(
    "SCRUM-190 [AC3] TC-190-12: a %s request saved across two days opens with no date or times, and keeps everything else",
    (status) => {
      const form = getInitialFormData({ ...twoDays, status });

      expect(form).toMatchObject({
        name: "Two-day summit",
        eventDate: "",
        startTime: "",
        endTime: "",
      });
      expect(storedAcrossTwoDays({ ...twoDays, status })).toBe(true);
    },
  );

  it("SCRUM-190 [AC3] TC-190-12: so saving it can't move the end onto the start's day: no period is sent until one is chosen", () => {
    const form = getInitialFormData({ ...twoDays, status: "DRAFT" });

    expect(
      joinEventPeriod({
        date: form.eventDate,
        startTime: form.startTime,
        endTime: form.endTime,
      }),
    ).toEqual({ startAt: undefined, endAt: undefined });
  });

  it("SCRUM-190 [AC3] TC-190-12: the Organiser is told why the date and times are empty", () => {
    expect(REENTER_PERIOD_MESSAGE).toBe(
      "Events now take place within one day. Please choose the date and times again.",
    );
  });

  it("SCRUM-190 [AC3] TC-190-12: a draft within one Singapore day opens with its date and times", () => {
    const oneDay = {
      ...twoDays,
      status: "DRAFT",
      endAt: new Date("2036-03-03T09:00:00.000Z"),
    };

    expect(getInitialFormData(oneDay)).toMatchObject({
      eventDate: "2036-03-03",
      startTime: "09:00",
      endTime: "17:00",
    });
    expect(storedAcrossTwoDays(oneDay)).toBe(false);
  });

  it("SCRUM-190 [AC3] TC-190-12: a request that can't be edited still shows the period it was saved with", () => {
    const submitted = { ...twoDays, status: "SUBMITTED" };

    expect(getInitialFormData(submitted)).toMatchObject({
      eventDate: "2036-03-03",
      startTime: "09:00",
      endTime: "17:00",
    });
    expect(storedAcrossTwoDays(submitted)).toBe(false);
  });
});

describe("the step that shows a refused field — SCRUM-263 AC2", () => {
  it.each([
    ["name", 1],
    ["purpose", 1],
    ["description", 1],
    ["startAt", 2],
    ["endAt", 2],
    ["expectedAttendance", 2],
    ["venueRequirements", 3],
    ["preferredLayout", 3],
    ["accessibilityNeeds", 3],
    ["equipmentRequirements", 4],
    ["registrationRequired", 5],
    ["registrationNotes", 5],
    ["programme", 5],
    ["specialRequests", 5],
  ])("SCRUM-263 [AC2] TC-263-05: an error on %s opens step %i", (field, step) => {
    expect(firstStepWithError({ [field]: ["Refused."] })).toBe(step);
  });

  it("SCRUM-263 [AC2] TC-263-05: errors on several steps open the earliest", () => {
    expect(
      firstStepWithError({
        specialRequests: ["Refused."],
        equipmentRequirements: ["Refused."],
      }),
    ).toBe(4);
  });

  it("SCRUM-263 [AC2] TC-263-05: with no field to show, the form stays where it is", () => {
    expect(firstStepWithError({})).toBeNull();
    expect(firstStepWithError({ name: [] })).toBeNull();
    expect(firstStepWithError({ id: ["Refused."] })).toBeNull();
  });
});

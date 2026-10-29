import { describe, it, expect } from "vitest";
import type { ZodTypeAny } from "zod";

import { joinEventPeriod, sgDate, splitEventPeriod } from "@/lib/datetime";
import { changeRequestChangesSchema } from "@/lib/schemas/change-request";
import { clarificationChangesSchema } from "@/lib/schemas/clarification";
import {
  createDraftEventSchema,
  eventPeriodError,
  submitEventRequestSchema,
} from "@/lib/schemas/event";
import { eventDetailsEditSchema } from "@/lib/schemas/event-edit";

// SCRUM-190 — an event takes place within one day, Singapore time. Every
// instant here is fixed and years ahead, so no case depends on the clock.
const END_NOT_AFTER_START = "The end time must be after the start time.";
const NOT_ONE_DAY =
  "An event starts and ends on the same day. Choose one date with a start and an end time.";

// 3 March 2036 in Singapore (UTC+8).
const at = (utc: string) => new Date(`2036-03-${utc}Z`);
const NINE_AM = at("03T01:00:00.000"); // 09:00 SGT, 3 Mar
const FIVE_PM = at("03T09:00:00.000"); // 17:00 SGT, 3 Mar
const ELEVEN_PM = at("03T15:00:00.000"); // 23:00 SGT, 3 Mar
const ONE_TO_MIDNIGHT = at("03T15:59:00.000"); // 23:59 SGT, 3 Mar
const MIDNIGHT = at("03T16:00:00.000"); // 00:00 SGT, 4 Mar
const ONE_AM_NEXT_DAY = at("03T17:00:00.000"); // 01:00 SGT, 4 Mar
const TEN_AM_NEXT_DAY = at("04T02:00:00.000"); // 10:00 SGT, 4 Mar
const FIVE_PM_NEXT_DAY = at("04T09:00:00.000"); // 17:00 SGT, 4 Mar

describe("eventPeriodError — SCRUM-190 AC2, AC3", () => {
  it("SCRUM-190 [AC2] TC-190-03: an end equal to the start is refused as an invalid time range", () => {
    expect(eventPeriodError(NINE_AM, NINE_AM)).toBe(END_NOT_AFTER_START);
  });

  it("SCRUM-190 [AC2] TC-190-03: an end one minute after the start is accepted", () => {
    expect(
      eventPeriodError(NINE_AM, new Date(NINE_AM.getTime() + 60_000)),
    ).toBeNull();
  });

  it("SCRUM-190 [AC2] TC-190-04: an end before the start is refused as an invalid time range", () => {
    expect(eventPeriodError(FIVE_PM, NINE_AM)).toBe(END_NOT_AFTER_START);
  });

  it("SCRUM-190 [AC2] TC-190-03: an unreadable start or end is an invalid time range, never a valid one", () => {
    expect(eventPeriodError(new Date("soon"), FIVE_PM)).toBe(END_NOT_AFTER_START);
    expect(eventPeriodError(NINE_AM, new Date("later"))).toBe(END_NOT_AFTER_START);
  });

  it("SCRUM-190 [AC1, AC3] TC-190-05: an event ending at 23:59 SGT on the day it starts is within one day", () => {
    expect(eventPeriodError(NINE_AM, ONE_TO_MIDNIGHT)).toBeNull();
  });

  it("SCRUM-190 [AC1, AC3] TC-190-05: an event ending at midnight SGT ends on the next day and is refused", () => {
    expect(eventPeriodError(NINE_AM, MIDNIGHT)).toBe(NOT_ONE_DAY);
  });

  it("SCRUM-190 [AC1, AC3] TC-190-05: an event running from one day into the next is refused", () => {
    expect(eventPeriodError(NINE_AM, FIVE_PM_NEXT_DAY)).toBe(NOT_ONE_DAY);
  });

  it("SCRUM-190 [AC1] TC-190-05: the day is Singapore's: 23:00 to 01:00 SGT falls on one UTC date but two Singapore days, and is refused", () => {
    expect(ELEVEN_PM.toISOString().slice(0, 10)).toBe(
      ONE_AM_NEXT_DAY.toISOString().slice(0, 10),
    );
    expect(eventPeriodError(ELEVEN_PM, ONE_AM_NEXT_DAY)).toBe(NOT_ONE_DAY);
  });

  it("SCRUM-190 [AC1] TC-190-05: the day is Singapore's: 01:00 to 10:00 SGT spans two UTC dates but one Singapore day, and is accepted", () => {
    expect(ONE_AM_NEXT_DAY.toISOString().slice(0, 10)).not.toBe(
      TEN_AM_NEXT_DAY.toISOString().slice(0, 10),
    );
    expect(eventPeriodError(ONE_AM_NEXT_DAY, TEN_AM_NEXT_DAY)).toBeNull();
  });
});

describe("the request form's date and times — SCRUM-190 AC1", () => {
  it("SCRUM-190 [AC1] TC-190-01: one date with a start and an end time is read as Singapore time", () => {
    expect(
      joinEventPeriod({ date: "2036-03-03", startTime: "09:00", endTime: "17:00" }),
    ).toEqual({
      startAt: "2036-03-03T01:00:00.000Z",
      endAt: "2036-03-03T09:00:00.000Z",
    });
  });

  it("SCRUM-190 [AC1, AC3] TC-190-10: without the date there is no start or end, so a draft saves without them", () => {
    expect(
      joinEventPeriod({ date: "", startTime: "09:00", endTime: "17:00" }),
    ).toEqual({ startAt: undefined, endAt: undefined });
    expect(
      joinEventPeriod({ date: "2036-03-03", startTime: "", endTime: "17:00" }),
    ).toEqual({ startAt: undefined, endAt: "2036-03-03T09:00:00.000Z" });
  });

  it("SCRUM-190 [AC1] TC-190-02: a stored period is shown as its Singapore date and times", () => {
    expect(splitEventPeriod(ONE_AM_NEXT_DAY, TEN_AM_NEXT_DAY)).toEqual({
      date: "2036-03-04",
      startTime: "01:00",
      endTime: "10:00",
    });
  });

  it("SCRUM-190 [AC1, AC3] TC-190-10: a draft with no date or times shows empty fields", () => {
    expect(splitEventPeriod(null, null)).toEqual({
      date: "",
      startTime: "",
      endTime: "",
    });
  });

  it("SCRUM-190 [AC1] TC-190-02: a draft with only an end keeps that end's date", () => {
    expect(splitEventPeriod(null, FIVE_PM)).toEqual({
      date: "2036-03-03",
      startTime: "",
      endTime: "17:00",
    });
  });

  it("SCRUM-190 [AC1] TC-190-05: an instant's date is the Singapore one", () => {
    expect(sgDate(MIDNIGHT)).toBe("2036-03-04");
    expect(sgDate(ONE_TO_MIDNIGHT)).toBe("2036-03-03");
  });
});

/** The messages a schema reports against the end. */
function endErrors(schema: ZodTypeAny, input: object): string[] {
  const parsed = schema.safeParse(input);
  if (parsed.success) return [];
  const { fieldErrors } = parsed.error.flatten();
  return (fieldErrors as Record<string, string[] | undefined>).endAt ?? [];
}

const submission = {
  name: "Board Meeting",
  purpose: "Quarterly review",
  description: "Board and guests.",
  expectedAttendance: 20,
  venueRequirements: "A boardroom",
  accessibilityNeeds: "Step-free access",
  preferredLayout: "Boardroom",
  equipmentRequirements: "One screen",
  registrationRequired: "no",
};

const edit = {
  eventId: "evt_1",
  name: "Board Meeting",
  expectedAttendance: "20",
};

// AC3: the same rule wherever an event's date or time is set after the form.
describe.each([
  { tc: "TC-190-06", path: "submitting (SCRUM-14)", schema: submitEventRequestSchema, base: submission },
  { tc: "TC-190-10", path: "saving a draft (SCRUM-15)", schema: createDraftEventSchema, base: { name: "Draft" } },
  { tc: "TC-190-07", path: "a clarification answer (SCRUM-108)", schema: clarificationChangesSchema, base: {} },
  { tc: "TC-190-08", path: "a change request (SCRUM-41 AC4)", schema: changeRequestChangesSchema, base: {} },
  { tc: "TC-190-09", path: "the Coordinator's edit (SCRUM-25 AC3)", schema: eventDetailsEditSchema, base: edit },
])("$path — SCRUM-190 AC3", ({ tc, path, schema, base }) => {
  const period = (startAt: Date, endAt: Date) => ({
    ...base,
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
  });

  it(`SCRUM-190 [AC3] TC-190-06, TC-190-07, TC-190-08, TC-190-09, TC-190-10: SCRUM-190 [AC3] ${tc}: ${path} refuses an event running into the next day`, () => {
    expect(endErrors(schema, period(NINE_AM, FIVE_PM_NEXT_DAY))).toEqual([NOT_ONE_DAY]);
  });

  it(`SCRUM-190 [AC2, AC3] TC-190-04: ${path} refuses an end before the start`, () => {
    expect(endErrors(schema, period(FIVE_PM, NINE_AM))).toEqual([END_NOT_AFTER_START]);
  });

  it(`SCRUM-190 [AC3] TC-190-05: ${path} accepts a period within one Singapore day`, () => {
    expect(schema.safeParse(period(NINE_AM, ONE_TO_MIDNIGHT)).success).toBe(true);
  });
});

describe("saving a draft — SCRUM-190 AC3", () => {
  it("SCRUM-190 [AC3] TC-190-10: a draft can still be saved without a date or times", () => {
    expect(createDraftEventSchema.safeParse({ name: "Draft" }).success).toBe(true);
  });
});

import { describe, it, expect } from "vitest";

import {
  INVALID_TIME_RANGE_MESSAGE,
  isArrivingFor,
  replacementToKeep,
  searchPeriod,
  venueSearchSchema,
} from "@/lib/schemas/venue-search";

// SCRUM-38 — reading a venue search from the URL, and the period it asks
// about. Expected periods are Singapore wall time (+08:00), from the criteria.
const sg = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00+08:00`);
const TODAY = "2031-05-20";

describe("searchPeriod — SCRUM-38 AC2", () => {
  it("SCRUM-38 [AC2] TC-38-04: with no date or time, there is no period and availability isn't checked", () => {
    expect(searchPeriod({}, TODAY)).toEqual({ period: null });
  });

  it("SCRUM-38 [AC2] TC-38-04: a date alone is that whole day", () => {
    expect(searchPeriod({ date: "2031-06-03" }, TODAY)).toEqual({
      period: {
        startAt: sg("2031-06-03", "00:00"),
        endAt: sg("2031-06-04", "00:00"),
      },
    });
  });

  it("SCRUM-38 [AC2] TC-38-04: a time range alone is that time today", () => {
    expect(searchPeriod({ from: "14:00", to: "16:30" }, TODAY)).toEqual({
      period: { startAt: sg(TODAY, "14:00"), endAt: sg(TODAY, "16:30") },
    });
  });

  it("SCRUM-38 [AC2] TC-38-04: a date and a time range together", () => {
    expect(
      searchPeriod({ date: "2031-06-03", from: "09:00", to: "11:00" }, TODAY),
    ).toEqual({
      period: {
        startAt: sg("2031-06-03", "09:00"),
        endAt: sg("2031-06-03", "11:00"),
      },
    });
  });

  it("SCRUM-38 [AC2] TC-38-04: a start without an end runs to midnight, and an end without a start runs from it", () => {
    expect(searchPeriod({ date: "2031-12-31", from: "20:00" }, TODAY)).toEqual({
      period: {
        startAt: sg("2031-12-31", "20:00"),
        endAt: sg("2032-01-01", "00:00"),
      },
    });
    expect(searchPeriod({ date: "2031-06-03", to: "08:00" }, TODAY)).toEqual({
      period: {
        startAt: sg("2031-06-03", "00:00"),
        endAt: sg("2031-06-03", "08:00"),
      },
    });
  });
});

describe("searchPeriod over several days — SCRUM-38 AC2", () => {
  it("SCRUM-38 [AC2] TC-38-04: a start and end date and time span the days between", () => {
    expect(
      searchPeriod(
        {
          date: "2031-06-03",
          from: "18:00",
          endDate: "2031-06-05",
          to: "12:00",
        },
        TODAY,
      ),
    ).toEqual({
      period: {
        startAt: sg("2031-06-03", "18:00"),
        endAt: sg("2031-06-05", "12:00"),
      },
    });
  });

  it("SCRUM-38 [AC2] TC-38-04: two dates without times run from the start of the first day to the end of the last", () => {
    expect(
      searchPeriod({ date: "2031-06-03", endDate: "2031-06-05" }, TODAY),
    ).toEqual({
      period: {
        startAt: sg("2031-06-03", "00:00"),
        endAt: sg("2031-06-06", "00:00"),
      },
    });
  });

  it("SCRUM-38 [AC2] TC-38-04: an end date alone is that whole day", () => {
    expect(searchPeriod({ endDate: "2031-06-05" }, TODAY)).toEqual({
      period: {
        startAt: sg("2031-06-05", "00:00"),
        endAt: sg("2031-06-06", "00:00"),
      },
    });
  });

  it("SCRUM-38 [AC6] TC-38-07: an end date before the start date is refused", () => {
    expect(
      searchPeriod({ date: "2031-06-05", endDate: "2031-06-03" }, TODAY),
    ).toEqual({ error: INVALID_TIME_RANGE_MESSAGE });
  });

  it("SCRUM-38 [AC6] TC-38-07: across days, an end time earlier in the day than the start is fine", () => {
    expect(
      searchPeriod(
        {
          date: "2031-06-03",
          from: "18:00",
          endDate: "2031-06-04",
          to: "09:00",
        },
        TODAY,
      ),
    ).toEqual({
      period: {
        startAt: sg("2031-06-03", "18:00"),
        endAt: sg("2031-06-04", "09:00"),
      },
    });
  });
});

describe("searchPeriod — SCRUM-38 AC6", () => {
  it.each([
    ["equal to the start", "15:00"],
    ["before the start", "14:00"],
  ])(
    "SCRUM-38 [AC6] TC-38-07: an end %s is refused as an invalid time range",
    (_, to) => {
      expect(
        searchPeriod({ date: "2031-06-03", from: "15:00", to }, TODAY),
      ).toEqual({ error: INVALID_TIME_RANGE_MESSAGE });
    },
  );

  it("SCRUM-38 [AC6] TC-38-07: an end one minute after the start is searched", () => {
    expect(
      searchPeriod({ date: "2031-06-03", from: "15:00", to: "15:01" }, TODAY),
    ).toEqual({
      period: {
        startAt: sg("2031-06-03", "15:00"),
        endAt: sg("2031-06-03", "15:01"),
      },
    });
  });

  it("SCRUM-38 [AC6] TC-38-07: the message says the time range is invalid", () => {
    expect(INVALID_TIME_RANGE_MESSAGE).toBe(
      "The time range is invalid: the end must be after the start.",
    );
  });
});

describe("choosing an event in the search — SCRUM-38 AC1", () => {
  it("SCRUM-38 [AC1] TC-38-01, TC-38-18: opened from the event, or with the event just chosen, the search is arriving for it", () => {
    expect(isArrivingFor("evt_1", {})).toBe(true);
    expect(isArrivingFor("evt_1", { searched: "1" })).toBe(true);
    expect(
      isArrivingFor("evt_1", { searched: "1", searchedFor: "evt_2" }),
    ).toBe(true);
  });

  it("SCRUM-38 [AC1] TC-38-01, TC-38-18: searching again for the same event isn't arriving, so the Coordinator's values count", () => {
    expect(
      isArrivingFor("evt_1", { searched: "1", searchedFor: "evt_1" }),
    ).toBe(false);
  });

  it("SCRUM-38 [AC1] TC-38-02, TC-38-18: a replacement is kept for the event it was opened for", () => {
    expect(replacementToKeep({ event: "evt_1", replace: "bkg_1" })).toBe(
      "bkg_1",
    );
    expect(
      replacementToKeep({
        event: "evt_1",
        replace: "bkg_1",
        searched: "1",
        searchedFor: "evt_1",
      }),
    ).toBe("bkg_1");
  });

  it("SCRUM-38 [AC1] TC-38-18: choosing another event leaves the replacement behind", () => {
    expect(
      replacementToKeep({
        event: "evt_2",
        replace: "bkg_1",
        searched: "1",
        searchedFor: "evt_1",
      }),
    ).toBeUndefined();
  });
});

describe("venueSearchSchema — SCRUM-38", () => {
  it("SCRUM-38 [AC2, AC11, AC13] TC-38-04, TC-38-12: reads every criterion and filter, with several facilities and features", () => {
    expect(
      venueSearchSchema.parse({
        event: "evt_1",
        replace: "bkg_1",
        searched: "1",
        searchedFor: "evt_0",
        date: "2031-06-03",
        from: "09:00",
        to: "11:00",
        location: "  Block A ",
        attendance: "40",
        facility: ["projector", "stage"],
        access: "hearing-loop",
        layout: "theatre",
      }),
    ).toEqual({
      event: "evt_1",
      replace: "bkg_1",
      searched: "1",
      searchedFor: "evt_0",
      date: "2031-06-03",
      from: "09:00",
      to: "11:00",
      location: "Block A",
      attendance: 40,
      facility: ["projector", "stage"],
      access: ["hearing-loop"],
      layout: "theatre",
    });
  });

  it("SCRUM-38 [AC2, AC11] TC-38-04, TC-38-12: blank fields are left out, and only the first of a repeated single field counts", () => {
    expect(
      venueSearchSchema.parse({
        date: "",
        from: " ",
        location: ["Block B", "Block C"],
        attendance: "",
        facility: ["", "projector"],
      }),
    ).toEqual({
      location: "Block B",
      facility: ["projector"],
      access: [],
    });
  });

  it.each([
    ["date", "03/06/2031", "Enter a valid date."],
    ["date", "2031-02-31", "Enter a valid date."],
    ["endDate", "2031-13-01", "Enter a valid date."],
    ["from", "9am", "Enter a valid start time."],
    ["to", "24:00", "Enter a valid end time."],
    ["attendance", "0", "Attendance must be greater than zero."],
    ["attendance", "2.5", "Attendance must be a whole number."],
    ["attendance", "many", "Attendance must be a whole number."],
  ])(
    "SCRUM-38 [AC2, AC12] TC-38-04, TC-38-13: refuses %s %j",
    (field, value, message) => {
      const result = venueSearchSchema.safeParse({ [field]: value });
      expect(result.success).toBe(false);
      expect(result.error?.flatten().fieldErrors).toEqual({
        [field]: [message],
      });
    },
  );
});

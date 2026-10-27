import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import {
  liveAnswer,
  LIVE_CHECK_FAILED_MESSAGE,
  neededInSearch,
  RequestForm,
  searchedAttendance,
  venuesForLayout,
} from "@/app/(app)/bookings/new/request-form";
import { eventBookingPeriod } from "@/lib/schemas/booking";
import {
  HALF_HOUR_TIMES,
  isPastSlot,
  timesEvery,
} from "@/components/app/date-time-field";

// SCRUM-50 — what a coordinator sees before submitting. The server action is
// never called here, so its dependencies are stubbed out.
vi.mock("@/app/(app)/bookings/actions", () => ({
  submitBookingRequest: vi.fn(),
  checkVenueAvailability: vi.fn(),
}));
// SCRUM-40: the form's suitability panel records judgements through this.
vi.mock("@/app/(app)/venues/suitability-actions", () => ({
  recordSuitabilityJudgement: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const venue = {
  id: "ven_1",
  name: "Seminar Room",
  capacity: 60,
  facilities: ["projector"],
  accessibilityFeatures: ["wheelchair-access"],
  supportedLayouts: ["classroom"],
};
const event = {
  id: "evt_1",
  name: "Approved — Research Symposium",
  startAt: new Date("2035-03-10T01:00:00.000Z"),
  endAt: new Date("2035-03-10T05:00:00.000Z"),
  expectedAttendance: 120,
  venueRequirements: null,
  preferredLayout: null,
  accessibilityNeeds: null,
  organiserId: "usr_organiser",
  coordinatorId: "usr_coordinator",
  status: "PLANNING" as const,
};

describe("RequestForm — SCRUM-50", () => {
  it("SCRUM-50: a coordinator with no approved events is told why, instead of shown a form that cannot succeed", () => {
    const html = renderToStaticMarkup(
      <RequestForm events={[]} venues={[venue]} />,
    );

    expect(html).toContain("No approved events yet");
    expect(html).not.toContain("Submit request");
  });

  it("SCRUM-50 [AC1]: with an approved event, the form asks for venue, times, attendance, facilities, layout and other details", () => {
    const html = renderToStaticMarkup(
      <RequestForm events={[event]} venues={[venue]} />,
    );

    for (const label of [
      "Event",
      "Venue",
      "Start",
      "End",
      "Expected attendance",
      "Room layout",
      "Required facilities",
      "Other details for Venue Staff",
    ]) {
      expect(html).toContain(label);
    }
    expect(html).toContain("Submit request");
  });

  it("SCRUM-50 [AC1] TC-50-12: the room layout is asked for before the venue", () => {
    const html = renderToStaticMarkup(
      <RequestForm events={[event]} venues={[venue]} />,
    );

    expect(html.indexOf("Room layout")).toBeGreaterThan(-1);
    expect(html.indexOf("Room layout")).toBeLessThan(html.indexOf("Venue"));
  });

  it("SCRUM-162 [AC4] TC-162-05: the period and attendance can be changed for this venue: the times are editable and the attendance is a whole number from 1", () => {
    const html = renderToStaticMarkup(
      <RequestForm events={[event]} venues={[venue]} />,
    );

    for (const id of ["start", "end", "attendance"]) {
      expect(html).not.toMatch(
        new RegExp(`<input[^>]*id="${id}"[^>]*readOnly`, "i"),
      );
    }
    // The times are picked with the app's date and time picker, enabled.
    for (const id of ["start", "end"]) {
      expect(html).toMatch(new RegExp(`<button[^>]*id="${id}"`, "i"));
      expect(html).not.toMatch(
        new RegExp(`<button[^>]*id="${id}"[^>]* disabled=""`, "i"),
      );
    }
    expect(html).toMatch(/<input[^>]*type="number"[^>]*id="attendance"[^>]*min="1"[^>]*step="1"/);
  });

  it("SCRUM-188 [AC1] TC-188-01: choosing an event fills in its start and end to the minute", () => {
    const html = renderToStaticMarkup(
      <RequestForm
        events={[
          {
            ...event,
            startAt: new Date("2035-03-10T09:10:00+08:00"),
            endAt: new Date("2035-03-10T12:45:00+08:00"),
          },
        ]}
        venues={[venue]}
        initialEventId={event.id}
      />,
    );

    // The picker's minute column only renders when open, so that the fields
    // take any minute is proven in the browser (e2e/bookings.spec.ts, 12:44).
    expect(html).toMatch(
      /<button[^>]*id="start"[^>]*data-value="2035-03-10T09:10"/,
    );
    expect(html).toMatch(
      /<button[^>]*id="end"[^>]*data-value="2035-03-10T12:45"/,
    );
    expect(html).toContain("exactly as the event has them");
    expect(html).not.toContain("half hour");
  });

  it("SCRUM-50 [AC1]: required facilities are toggle pills, none chosen until the coordinator picks", () => {
    const html = renderToStaticMarkup(
      <RequestForm events={[event]} venues={[venue]} />,
    );

    expect(html).toMatch(
      /<button[^>]*aria-pressed="false"[^>]*>projector<\/button>/,
    );
  });
});

describe("SCRUM-50 [AC3, AC4, AC5] TC-50-13: liveAnswer, the live check", () => {
  it("SCRUM-50 [AC3] TC-50-13: a free venue reads free, and a taken one names its clashes", () => {
    expect(
      liveAnswer({ ok: true, data: { available: true, clashes: [] } }),
    ).toEqual({
      state: "free",
    });
    expect(
      liveAnswer({
        ok: true,
        data: { available: false, clashes: ["already booked"] },
      }),
    ).toEqual({ state: "taken", clashes: ["already booked"] });
  });

  it("SCRUM-50 [AC5] TC-50-13: a refusal about the period is invalid, which disables Submit", () => {
    for (const field of ["startAt", "endAt"]) {
      expect(
        liveAnswer({
          ok: false,
          error: "Bad period.",
          fieldErrors: { [field]: ["Bad period."] },
        }),
      ).toEqual({ state: "invalid", message: "Bad period." });
    }
  });

  it("SCRUM-50 TC-50-13: a check that failed, or was refused for another reason, is an error that leaves Submit to the server", () => {
    expect(liveAnswer(null)).toEqual({
      state: "error",
      message: LIVE_CHECK_FAILED_MESSAGE,
    });
    expect(liveAnswer({ ok: false, error: "Venue not found." })).toEqual({
      state: "error",
      message: "Venue not found.",
    });
    expect(
      liveAnswer({
        ok: false,
        error: "Choose a venue.",
        fieldErrors: { venueId: ["Choose a venue."] },
      }),
    ).toEqual({ state: "error", message: "Choose a venue." });
  });
});

describe("venuesForLayout — SCRUM-50", () => {
  const hall = { id: "hall", supportedLayouts: ["theatre", "banquet"] };
  const room = { id: "room", supportedLayouts: ["classroom", "theatre"] };

  it("SCRUM-50 [AC1] TC-50-12: once a layout is chosen, only venues that support it are offered", () => {
    expect(venuesForLayout([hall, room], "banquet")).toEqual([hall]);
    expect(venuesForLayout([hall, room], "theatre")).toEqual([hall, room]);
    expect(venuesForLayout([hall, room], "boardroom")).toEqual([]);
  });

  it("SCRUM-50 [AC1] TC-50-12: with no layout preference, every venue is offered", () => {
    expect(venuesForLayout([hall, room], "")).toEqual([hall, room]);
  });
});

describe("the half-hour time grid — SCRUM-163", () => {
  it("offers every half hour of the day, and nothing in between", () => {
    expect(HALF_HOUR_TIMES).toHaveLength(48);
    expect(HALF_HOUR_TIMES.slice(0, 3)).toEqual(["00:00", "00:30", "01:00"]);
    expect(HALF_HOUR_TIMES.at(-1)).toBe("23:30");
  });
});

describe("the quarter-hour time grid — SCRUM-161", () => {
  it("SCRUM-161 [AC1] TC-161-16: unavailability can start and end on any quarter hour, and nothing in between", () => {
    const quarters = timesEvery(15);
    expect(quarters).toHaveLength(96);
    expect(quarters.slice(0, 5)).toEqual([
      "00:00",
      "00:15",
      "00:30",
      "00:45",
      "01:00",
    ]);
    expect(quarters).toContain("09:45");
    expect(quarters).not.toContain("09:50");
    expect(quarters.at(-1)).toBe("23:45");
  });
});

describe("SCRUM-188 [AC1]: eventBookingPeriod", () => {
  const sg = (wall: string) => new Date(`${wall}:00+08:00`);

  it("SCRUM-188 [AC1] TC-188-01: the period is exactly the event's start and end, not rounded to the half hour", () => {
    expect(
      eventBookingPeriod({
        startAt: sg("2035-03-10T09:10"),
        endAt: sg("2035-03-10T12:45"),
      }),
    ).toEqual({
      startAt: sg("2035-03-10T09:10"),
      endAt: sg("2035-03-10T12:45"),
    });
    // One minute either side of a half hour, and an end just before midnight,
    // which rounding would have carried into the next day.
    expect(
      eventBookingPeriod({
        startAt: sg("2035-03-10T09:29"),
        endAt: sg("2035-03-10T23:59"),
      }),
    ).toEqual({
      startAt: sg("2035-03-10T09:29"),
      endAt: sg("2035-03-10T23:59"),
    });
  });

  it("SCRUM-188 [AC1] TC-188-01: an event's times given as ISO strings come back as the same instants", () => {
    expect(
      eventBookingPeriod({
        startAt: "2035-03-10T01:31:00.000Z",
        endAt: "2035-03-10T04:44:00.000Z",
      }),
    ).toEqual({
      startAt: new Date("2035-03-10T01:31:00.000Z"),
      endAt: new Date("2035-03-10T04:44:00.000Z"),
    });
  });

  it("SCRUM-50 [AC1] TC-50-15: an event without both dates has no period yet", () => {
    expect(
      eventBookingPeriod({ startAt: null, endAt: sg("2035-03-10T09:00") }),
    ).toBeNull();
    expect(
      eventBookingPeriod({ startAt: sg("2035-03-10T09:00"), endAt: null }),
    ).toBeNull();
  });
});

describe("isPastSlot — no picking a time that has already passed today", () => {
  const now = "2035-03-10T14:10";

  it("disables today's slots that began before now", () => {
    expect(isPastSlot("2035-03-10", "14:00", now)).toBe(true);
    expect(isPastSlot("2035-03-10", "09:30", now)).toBe(true);
  });

  it("keeps later slots today, and every slot on a later day", () => {
    expect(isPastSlot("2035-03-10", "14:30", now)).toBe(false);
    expect(isPastSlot("2035-03-11", "00:00", now)).toBe(false);
  });

  it("keeps the slot starting at this very minute, and disables nothing before a date is chosen", () => {
    expect(isPastSlot("2035-03-10", "14:00", "2035-03-10T14:00")).toBe(false);
    expect(isPastSlot("", "09:00", now)).toBe(false);
  });
});

describe("what venue search carries to the form — SCRUM-38 AC9", () => {
  const hall = {
    id: "ven_hall",
    facilities: ["stage", "sound-system"],
    accessibilityFeatures: ["hearing-loop"],
    supportedLayouts: ["theatre", "banquet"],
  };
  const room = {
    id: "ven_room",
    facilities: ["projector"],
    accessibilityFeatures: ["wheelchair-access"],
    supportedLayouts: ["classroom", "theatre"],
  };

  it("SCRUM-38 [AC9] TC-38-10: the facilities and accessibility features entered come across; ones no venue offers are dropped", () => {
    expect(
      neededInSearch([hall, room], "ven_room", {
        facilities: ["projector", "stage", "jacuzzi"],
        accessibility: ["wheelchair-access", "braille"],
      }),
    ).toEqual({
      facilities: ["projector", "stage"],
      accessibility: ["wheelchair-access"],
      layout: "",
    });
  });

  it("SCRUM-38 [AC9] TC-38-10: the layout comes across only if the venue chosen in search supports it, so that venue isn't dropped", () => {
    const needs = { facilities: [], accessibility: [] };
    expect(
      neededInSearch([hall, room], "ven_room", { ...needs, layout: "theatre" })
        .layout,
    ).toBe("theatre");
    expect(
      neededInSearch([hall, room], "ven_room", { ...needs, layout: "banquet" })
        .layout,
    ).toBe("");
    // With no venue chosen, any layout a venue supports.
    expect(
      neededInSearch([hall, room], undefined, { ...needs, layout: "banquet" })
        .layout,
    ).toBe("banquet");
    expect(
      neededInSearch([hall, room], undefined, { ...needs, layout: "cabaret" })
        .layout,
    ).toBe("");
  });

  it("SCRUM-38 [AC9, AC12] TC-38-10: an attendance lowered in search comes across, from 1 up to the event's", () => {
    // SCRUM-162 AC4: a booking's attendance is a whole number from 1 to the event's.
    expect(searchedAttendance("120", 120)).toBe("120");
    expect(searchedAttendance("20", 120)).toBe("20");
    expect(searchedAttendance("1", 120)).toBe("1");
    expect(searchedAttendance("020", 120)).toBe("20");
    expect(searchedAttendance("20", null)).toBe("20");
  });

  it("SCRUM-38 [AC9, AC12] TC-38-10: an attendance a booking can't have leaves the event's", () => {
    expect(searchedAttendance("121", 120)).toBeUndefined();
    expect(searchedAttendance("0", 120)).toBeUndefined();
    expect(searchedAttendance("-5", 120)).toBeUndefined();
    expect(searchedAttendance("2.5", 120)).toBeUndefined();
    expect(searchedAttendance("many", 120)).toBeUndefined();
    expect(searchedAttendance("", 120)).toBeUndefined();
    expect(searchedAttendance(undefined, 120)).toBeUndefined();
  });

  it("SCRUM-38 [AC9] TC-38-10: the form opens with them chosen, with the attendance searched", () => {
    const html = renderToStaticMarkup(
      <RequestForm
        events={[event]}
        venues={[venue]}
        initialEventId="evt_1"
        initialVenueId="ven_1"
        initialNeeds={{
          facilities: ["projector"],
          accessibility: ["wheelchair-access"],
          layout: "classroom",
          attendance: "60",
        }}
      />,
    );

    expect(html).toMatch(
      /<button[^>]*aria-pressed="true"[^>]*>(?:<svg.*?<\/svg>)?projector<\/button>/,
    );
    expect(html).toMatch(
      /<button[^>]*aria-pressed="true"[^>]*>(?:<svg.*?<\/svg>)?wheelchair-access<\/button>/,
    );
    expect(html).toMatch(/<input[^>]*id="attendance"[^>]*value="60"/);
  });

  it("SCRUM-38 [AC9] TC-38-10: with an attendance over the event's, or none, the form opens with the event's", () => {
    for (const attendance of ["121", undefined]) {
      const html = renderToStaticMarkup(
        <RequestForm
          events={[event]}
          venues={[venue]}
          initialEventId="evt_1"
          initialVenueId="ven_1"
          initialNeeds={{ facilities: [], accessibility: [], attendance }}
        />,
      );
      expect(html).toMatch(/<input[^>]*id="attendance"[^>]*value="120"/);
    }
  });
});

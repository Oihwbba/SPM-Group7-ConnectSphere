import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import {
  layoutOption,
  liveAnswer,
  LIVE_CHECK_FAILED_MESSAGE,
  RequestForm,
  venuesForLayout,
} from "@/app/(app)/bookings/new/request-form";
import { eventBookingPeriod } from "@/lib/schemas/booking";
import { HALF_HOUR_TIMES, isPastSlot } from "@/components/app/date-time-field";

// SCRUM-50 — what a coordinator sees before submitting. The server action is
// never called here, so its dependencies are stubbed out.
vi.mock("@/app/(app)/bookings/actions", () => ({
  submitBookingRequest: vi.fn(),
  checkVenueAvailability: vi.fn(),
}));

const venue = {
  id: "ven_1",
  name: "Seminar Room",
  capacity: 60,
  facilities: ["projector"],
  supportedLayouts: ["classroom"],
};
const event = {
  id: "evt_1",
  name: "Approved — Research Symposium",
  startAt: new Date("2035-03-10T01:00:00.000Z"),
  endAt: new Date("2035-03-10T05:00:00.000Z"),
  expectedAttendance: 120,
  requiredFacilities: [],
  preferredLayout: null,
};

describe("RequestForm — SCRUM-50", () => {
  it("SCRUM-50 — a coordinator with no approved events is told why, instead of shown a form that cannot succeed", () => {
    const html = renderToStaticMarkup(
      <RequestForm events={[]} venues={[venue]} />,
    );

    expect(html).toContain("No approved events yet");
    expect(html).not.toContain("Submit request");
  });

  it("SCRUM-50 AC1 — with an approved event, the form asks for venue, times, attendance, facilities, layout and other details", () => {
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

  it("SCRUM-50 AC1 — the room layout is asked for before the venue", () => {
    const html = renderToStaticMarkup(
      <RequestForm events={[event]} venues={[venue]} />,
    );

    expect(html.indexOf("Room layout")).toBeGreaterThan(-1);
    expect(html.indexOf("Room layout")).toBeLessThan(html.indexOf("Venue"));
  });

  it("SCRUM-50 AC1 — the period and attendance are shown read-only, taken from the event", () => {
    const html = renderToStaticMarkup(
      <RequestForm events={[event]} venues={[venue]} />,
    );

    for (const id of ["start", "end", "attendance"]) {
      expect(html).toMatch(
        new RegExp(`<input[^>]*id="${id}"[^>]*readOnly`, "i"),
      );
    }
  });

  it("SCRUM-50 AC1 — required facilities are toggle pills, none chosen until the coordinator picks", () => {
    const html = renderToStaticMarkup(
      <RequestForm events={[event]} venues={[venue]} />,
    );

    expect(html).toMatch(
      /<button[^>]*aria-pressed="false"[^>]*>projector<\/button>/,
    );
  });
});

describe("SCRUM-50 [AC3, AC4, AC5] TC-50-13: liveAnswer — SCRUM-50 live check", () => {
  it("SCRUM-50 AC3 — a free venue reads free, and a taken one names its clashes", () => {
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

  it("SCRUM-50 AC5 — a refusal about the period is invalid, which disables Submit", () => {
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

  it("SCRUM-50 — a check that failed, or was refused for another reason, is an error that leaves Submit to the server", () => {
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

describe("SCRUM-50 [AC1] TC-50-12: layoutOption — SCRUM-50", () => {
  const options = ["banquet", "classroom", "theatre"];

  it("SCRUM-50 AC1 — the event's preferred layout is pre-selected whatever its case or spacing", () => {
    expect(layoutOption("classroom", options)).toBe("classroom");
    expect(layoutOption("Classroom", options)).toBe("classroom");
    expect(layoutOption("  THEATRE ", options)).toBe("theatre");
  });

  it("SCRUM-50 AC1 — a layout no venue offers, or none at all, pre-selects nothing", () => {
    expect(layoutOption("boardroom", options)).toBe("");
    expect(layoutOption("", options)).toBe("");
    expect(layoutOption(null, options)).toBe("");
    expect(layoutOption(undefined, options)).toBe("");
  });
});

describe("venuesForLayout — SCRUM-50", () => {
  const hall = { id: "hall", supportedLayouts: ["theatre", "banquet"] };
  const room = { id: "room", supportedLayouts: ["classroom", "theatre"] };

  it("SCRUM-50 [AC1] TC-50-12: SCRUM-50 AC1 — once a layout is chosen, only venues that support it are offered", () => {
    expect(venuesForLayout([hall, room], "banquet")).toEqual([hall]);
    expect(venuesForLayout([hall, room], "theatre")).toEqual([hall, room]);
    expect(venuesForLayout([hall, room], "boardroom")).toEqual([]);
  });

  it("SCRUM-50 AC1 — with no layout preference, every venue is offered", () => {
    expect(venuesForLayout([hall, room], "")).toEqual([hall, room]);
  });
});

describe("the half-hour time grid — SCRUM-50", () => {
  it("offers every half hour of the day, and nothing in between", () => {
    expect(HALF_HOUR_TIMES).toHaveLength(48);
    expect(HALF_HOUR_TIMES.slice(0, 3)).toEqual(["00:00", "00:30", "01:00"]);
    expect(HALF_HOUR_TIMES.at(-1)).toBe("23:30");
  });
});

describe("SCRUM-50 [AC1] TC-50-15: eventBookingPeriod — SCRUM-50 AC1", () => {
  // Singapore times: 09:10 to 16:45, and 23:50 crossing midnight.
  const sg = (wall: string) => new Date(`${wall}:00+08:00`);

  it("SCRUM-50 AC1 — the event's start rounds down and its end rounds up, so the period is never shortened", () => {
    expect(
      eventBookingPeriod({
        startAt: sg("2035-03-10T09:10"),
        endAt: sg("2035-03-10T16:45"),
      }),
    ).toEqual({
      startAt: sg("2035-03-10T09:00"),
      endAt: sg("2035-03-10T17:00"),
    });
    expect(
      eventBookingPeriod({
        startAt: sg("2035-03-10T22:00"),
        endAt: sg("2035-03-10T23:50"),
      })?.endAt,
    ).toEqual(sg("2035-03-11T00:00"));
  });

  it("SCRUM-50 AC1 — times already on the half hour are left alone", () => {
    expect(
      eventBookingPeriod({
        startAt: sg("2035-03-10T09:30"),
        endAt: "2035-03-10T09:00:00.000Z",
      }),
    ).toEqual({
      startAt: sg("2035-03-10T09:30"),
      endAt: new Date("2035-03-10T09:00:00.000Z"),
    });
  });

  it("SCRUM-50 AC1 — an event without both dates has no period yet", () => {
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

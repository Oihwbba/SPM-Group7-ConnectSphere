import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import {
  HALF_HOUR_TIMES,
  RequestForm,
  snapToHalfHour,
} from "@/app/(app)/bookings/new/request-form";

// SCRUM-50 — what a coordinator sees before submitting. The server action is
// never called here, so its dependencies are stubbed out.
vi.mock("@/app/(app)/bookings/actions", () => ({
  submitBookingRequest: vi.fn(),
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

  it("SCRUM-50 AC1 — required facilities are toggle pills, none chosen until the coordinator picks", () => {
    const html = renderToStaticMarkup(
      <RequestForm events={[event]} venues={[venue]} />,
    );

    expect(html).toMatch(
      /<button[^>]*aria-pressed="false"[^>]*>projector<\/button>/,
    );
  });
});

describe("the half-hour time grid — SCRUM-50", () => {
  it("offers every half hour of the day, and nothing in between", () => {
    expect(HALF_HOUR_TIMES).toHaveLength(48);
    expect(HALF_HOUR_TIMES.slice(0, 3)).toEqual(["00:00", "00:30", "01:00"]);
    expect(HALF_HOUR_TIMES.at(-1)).toBe("23:30");
  });

  it("rounds a pre-filled start down and end up, so the event's period is never shortened", () => {
    expect(snapToHalfHour("2035-03-10T09:10", "down")).toBe("2035-03-10T09:00");
    expect(snapToHalfHour("2035-03-10T16:45", "up")).toBe("2035-03-10T17:00");
    expect(snapToHalfHour("2035-03-10T23:50", "up")).toBe("2035-03-11T00:00");
  });

  it("leaves a time already on the grid, or an empty value, alone", () => {
    expect(snapToHalfHour("2035-03-10T09:30", "down")).toBe("2035-03-10T09:30");
    expect(snapToHalfHour("2035-03-10T09:30", "up")).toBe("2035-03-10T09:30");
    expect(snapToHalfHour("", "up")).toBe("");
  });
});

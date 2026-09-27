import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { RequestForm } from "@/app/(app)/bookings/new/request-form";

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
    expect(html).toContain("Approved — Research Symposium");
    expect(html).toContain("Seminar Room (holds 60)");
    expect(html).toContain("Submit request");
  });
});

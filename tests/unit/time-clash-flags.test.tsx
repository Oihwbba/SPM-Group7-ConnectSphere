import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { TimeClashFlags } from "@/app/(app)/bookings/time-clash-flags";
import type { TimeClashFlag } from "@/lib/venue-time-clashes";

// SCRUM-160 AC5 — the Venue Staff list of bookings flagged after a setup or
// turnaround change. Test cases: docs/testing/SCRUM-160.md.

const flag: TimeClashFlag = {
  bookingId: "bkg_1",
  status: "APPROVED",
  startAt: new Date("2031-03-10T05:00:00Z"),
  endAt: new Date("2031-03-10T07:00:00Z"),
  venueName: "Exhibition Hall",
  eventName: "Robotics Expo",
  coordinatorName: null,
  flaggedAt: new Date("2031-03-01T00:00:00Z"),
  clashesWith: ['"Career Fair"\'s booking from 10 Mar 2031, 10:00 am SGT to 10 Mar 2031, 12:00 pm SGT'],
};

describe("TimeClashFlags — SCRUM-160 AC5", () => {
  it("SCRUM-160 [AC5] TC-160-11: shows each flagged booking's venue, event, Coordinator, period and what it clashes with", () => {
    const html = renderToStaticMarkup(
      <TimeClashFlags flags={[flag, { ...flag, bookingId: "bkg_2", coordinatorName: "Cody" }]} />,
    );

    expect(html).toContain("Exhibition Hall");
    expect(html).toContain("Robotics Expo");
    expect(html).toContain("Not assigned");
    expect(html).toContain("Cody");
    expect(html).toContain("10 Mar 2031, 1:00 pm SGT to 10 Mar 2031, 3:00 pm SGT");
    expect(html).toContain("Career Fair");
  });

  it("SCRUM-160 [AC5, AC6] TC-160-11: with nothing waiting, the section isn't shown", () => {
    expect(renderToStaticMarkup(<TimeClashFlags flags={[]} />)).toBe("");
  });
});

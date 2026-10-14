import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import {
  BookingQueue,
  matchesSearch,
} from "@/app/(app)/bookings/booking-queue";
import type { PendingBookingRow } from "@/app/(app)/bookings/queries";

// SCRUM-52 / SCRUM-53 — what Venue Staff see. Rendering only: the decision
// action and the router are never reached.
vi.mock("@/app/(app)/bookings/actions", () => ({
  decideBookingRequest: vi.fn(),
  holdBookingRequest: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const row: PendingBookingRow = {
  id: "bkg_1",
  status: "PENDING",
  holdExpiresAt: null,
  holdNote: null,
  holdApprovedAt: null,
  startAt: new Date("2035-03-10T01:00:00.000Z"),
  endAt: new Date("2035-03-10T05:00:00.000Z"),
  setupMinutes: 0,
  turnaroundMinutes: 0,
  requestedAttendance: 250,
  requiredFacilities: ["projector", "stage"],
  requestedLayout: "banquet",
  requestNotes: null,
  createdAt: new Date("2035-01-01T01:00:00.000Z"),
  event: { name: "Approved — Research Symposium" },
  requestedBy: { name: "Cody Coordinator", email: "coordinator@test.local" },
  venue: {
    id: "ven_hall",
    name: "Exhibition Hall",
    location: "Level 1, Block C",
    capacity: 200,
    facilities: ["sound-system", "projector"],
    supportedLayouts: ["banquet"],
    setupMinutes: 0,
    turnaroundMinutes: 0,
  },
  blockers: [],
};

describe("BookingQueue", () => {
  it("SCRUM-52 [AC4] TC-52-06: an empty queue says there is nothing pending rather than rendering nothing", () => {
    const html = renderToStaticMarkup(<BookingQueue queue={[]} canDecide />);

    expect(html).toContain("No pending requests");
    expect(html).not.toContain("Approve");
  });

  it("SCRUM-52 [AC3] TC-52-02: a request is cross-checked against the venue: what it meets and what it does not", () => {
    const html = renderToStaticMarkup(
      <BookingQueue queue={[row]} canDecide={false} />,
    );

    expect(html).toContain("Free for this period");
    expect(html).toContain("250 expected · venue holds 200");
    // Over capacity and a missing facility are both marked as not met.
    expect(html.match(/aria-label="does not meet"/g)).toHaveLength(2);
  });

  it("SCRUM-53 — the Approve and Reject controls render only for a user who may decide", () => {
    const withControls = renderToStaticMarkup(
      <BookingQueue queue={[row]} canDecide />,
    );
    const withoutControls = renderToStaticMarkup(
      <BookingQueue queue={[row]} canDecide={false} />,
    );

    // Match the buttons, not text: the event's own name contains "Approve".
    const buttons = (html: string) =>
      [...html.matchAll(/<button[^>]*>.*?<\/button>/g)].map((m) =>
        m[0].replace(/<[^>]+>/g, "").trim(),
      );
    expect(buttons(withControls)).toEqual(["Reject", "Approve"]);
    expect(buttons(withoutControls)).toEqual([]);
  });

  it("SCRUM-163 [AC7] TC-163-17: a hold Venue Staff haven't approved offers Approve and Reject; once approved it reads 'Approved by Venue Staff – awaiting confirmation' and offers Reject only", () => {
    const hold = {
      ...row,
      status: "HELD" as const,
      holdExpiresAt: new Date("2035-03-05T02:00:00.000Z"),
      holdNote: "Confirm the final headcount.",
    };
    const buttons = (html: string) =>
      [...html.matchAll(/<button[^>]*>.*?<\/button>/g)].map((m) =>
        m[0].replace(/<[^>]+>/g, "").trim(),
      );

    const unapproved = renderToStaticMarkup(
      <BookingQueue queue={[hold]} canDecide canHold />,
    );
    expect(unapproved).toContain("Held until 5 Mar 2035, 10:00 am SGT");
    expect(unapproved).not.toContain("Approved by Venue Staff");
    expect(buttons(unapproved)).toEqual(["Reject", "Approve"]);

    const approved = renderToStaticMarkup(
      <BookingQueue
        queue={[{ ...hold, holdApprovedAt: new Date("2035-03-01T02:00:00.000Z") }]}
        canDecide
        canHold
      />,
    );
    expect(approved).toContain("Held until 5 Mar 2035, 10:00 am SGT");
    expect(approved).toContain(
      "Approved by Venue Staff – awaiting confirmation",
    );
    expect(buttons(approved)).toEqual(["Reject"]);
  });
});

describe("matchesSearch — SCRUM-52 search", () => {
  it("SCRUM-52 [AC1] TC-52-05: matches on event, venue, location, coordinator, email, facility, layout and date, ignoring case", () => {
    for (const query of [
      "research symposium",
      "EXHIBITION",
      "block c",
      "cody",
      "coordinator@test.local",
      "stage",
      "banquet",
      "10 Mar 2035",
    ]) {
      expect(matchesSearch(row, query), query).toBe(true);
    }
  });

  it("SCRUM-52 [AC1] TC-52-05: every word must match somewhere, so extra words narrow the results", () => {
    expect(matchesSearch(row, "hall projector")).toBe(true);
    expect(matchesSearch(row, "hall boardroom")).toBe(false);
  });

  it("SCRUM-52 [AC1] TC-52-05: an empty or blank search shows everything", () => {
    expect(matchesSearch(row, "")).toBe(true);
    expect(matchesSearch(row, "   ")).toBe(true);
  });
});

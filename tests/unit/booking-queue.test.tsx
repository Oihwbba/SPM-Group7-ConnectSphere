import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import {
  BookingDecision,
  BookingDetails,
} from "@/app/(app)/bookings/booking-queue";
import type { PendingBookingRow } from "@/app/(app)/bookings/queries";
import { WorkQueue } from "@/components/queues/work-queue";
import { queueState, type QueueDefaults } from "@/lib/queues";

// SCRUM-52 / SCRUM-53 — what Venue Staff see. Rendering only: the decision
// action and the router are never reached.
vi.mock("@/app/(app)/bookings/actions", () => ({
  decideBookingRequest: vi.fn(),
  holdBookingRequest: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));
// SCRUM-25 AC6: each card carries the event's operational notes.
vi.mock("@/app/(app)/events/edit-actions", () => ({
  getOperationalNotes: vi.fn(() => new Promise(() => {})),
  addOperationalNote: vi.fn(),
}));

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
  requiredAccessibilityFeatures: [],
  requestedLayout: "banquet",
  requestNotes: null,
  createdAt: new Date("2035-01-01T01:00:00.000Z"),
  event: {
    name: "Approved — Research Symposium",
    venueRequirements: "A hall near the lobby,\nwith a stage",
    preferredLayout: "Banquet",
    accessibilityNeeds: "Wheelchair access",
  },
  eventId: "evt_1",
  requestedBy: { name: "Cody Coordinator", email: "coordinator@test.local" },
  venue: {
    id: "ven_hall",
    name: "Exhibition Hall",
    location: "Level 1, Block C",
    capacity: 200,
    facilities: ["sound-system", "projector"],
    accessibilityFeatures: [],
    supportedLayouts: ["banquet"],
    setupMinutes: 0,
    turnaroundMinutes: 0,
    openingHours: [],
  },
  outsideHours: null,
  hoursWarning: null,
  blockers: [],
  competing: [],
  judgement: null,
};

describe("BookingQueue", () => {
  it("SCRUM-170 [AC2] TC-170-02: Venue Staff see the Organiser's venue and accessibility answers on the request, as entered", () => {
    const html = renderToStaticMarkup(
      <BookingDetails booking={row} />,
    );
    const answers = html.slice(
      html.indexOf('data-testid="organiser-venue-answers"'),
    );

    expect(html).toContain("What the Organiser asked for");
    expect(answers).toContain("A hall near the lobby,\nwith a stage");
    expect(answers).toContain("Banquet");
    expect(answers).toContain("Wheelchair access");
  });

  // SCRUM-211: the queue as every queue lists it, four columns, and a row
  // that opens the request; requests are decided only once opened.
  const SOONEST: QueueDefaults = { sort: "event", dir: "asc" };
  const list = (items: Parameters<typeof queueState>[1]) =>
    renderToStaticMarkup(
      <WorkQueue
        title="Booking requests"
        description=""
        base="/bookings"
        state={queueState("/bookings", items, {}, SOONEST)}
        defaults={SOONEST}
      />,
    );

  it("SCRUM-207 TC-207-20, SCRUM-211 [AC1] TC-211-01: the queue is a table of four columns; requests are decided only in their details", () => {
    const html = list([
      {
        id: row.id,
        event: row.event.name,
        eventStart: row.startAt,
        asked: "Exhibition Hall for 250",
        requestedAt: row.createdAt,
        waiting: true,
        badges: [],
      },
    ]);
    const headings = [...html.matchAll(/<th[^>]*>(.*?)<\/th>/g)].map((m) =>
      m[1].replace(/<[^>]+>/g, ""),
    );

    expect(headings).toEqual(["Event", "Event date", "What&#x27;s asked", "Requested"]);
    expect(html).toContain('data-testid="queue-row"');
    expect(html).toContain("Exhibition Hall for 250");
    expect(html).toContain('href="/bookings?open=bkg_1"');
    expect(html).not.toMatch(/>(Approve|Reject|Hold)</);
  });

  it("SCRUM-52 [AC4] TC-52-06, SCRUM-211 [AC2] TC-211-05: an empty queue says there is nothing waiting rather than rendering nothing", () => {
    const html = list([]);

    expect(html).toContain("Nothing waiting. You&#x27;re all caught up.");
    expect(html).not.toContain("Approve");
  });

  it("SCRUM-52 [AC3] TC-52-02: a request is cross-checked against the venue: what it meets and what it does not", () => {
    const html = renderToStaticMarkup(
      <BookingDetails booking={row} />,
    );

    expect(html).toContain("Free for this period");
    expect(html).toContain("250 expected · venue holds 200");
    // Over capacity and a missing facility are both marked as not met.
    expect(html.match(/aria-label="does not meet"/g)).toHaveLength(2);
  });

  it("SCRUM-34 [AC7] TC-34-09: a request outside the venue's opening hours isn't shown as free, and says why", () => {
    const outside = "Exhibition Hall is closed on Saturdays, so it can't be booked then.";

    const html = renderToStaticMarkup(
      <BookingDetails booking={{ ...row, outsideHours: outside }} />,
    );

    expect(html).not.toContain("Free for this period");
    expect(html).toContain("Exhibition Hall is closed on Saturdays, so it can&#x27;t be booked then.");
    // Over capacity, a missing facility and the opening hours are each not met.
    expect(html.match(/aria-label="does not meet"/g)).toHaveLength(3);
  });

  it("SCRUM-159 [AC9] TC-159-18: setup or turnaround outside opening hours is shown as a warning, the venue still free and Approve still offered", () => {
    const warning =
      "The setup time (30 minutes, from 08:30) falls outside Exhibition Hall's opening hours, 09:00–18:00 on Saturdays. You can still hold or approve it.";

    const html = renderToStaticMarkup(
      <BookingDetails booking={{ ...row, hoursWarning: warning }} />,
    );

    expect(html).toContain('data-testid="hours-warning"');
    expect(html).toContain("The setup time (30 minutes, from 08:30) falls outside Exhibition Hall&#x27;s opening hours");
    expect(html).toContain("Free for this period");
    // Only capacity and the missing facility are not met; the warning isn't.
    expect(html.match(/aria-label="does not meet"/g)).toHaveLength(2);
    expect(
      renderToStaticMarkup(
        <BookingDecision booking={{ ...row, hoursWarning: warning }} canDecide nextHref="/bookings"
        listHref="/bookings" />,
      ),
    ).toMatch(/<button[^>]*>.*?Approve<\/button>/);
  });

  it("SCRUM-53, SCRUM-211 [AC3] TC-211-06: the decision controls render only for a user who may decide, positive first, Reject last", () => {
    const withControls = renderToStaticMarkup(
      <BookingDecision booking={row} canDecide nextHref="/bookings"
        listHref="/bookings" />,
    );
    const withHold = renderToStaticMarkup(
      <BookingDecision booking={row} canDecide canHold nextHref="/bookings"
        listHref="/bookings" />,
    );
    const withoutControls = renderToStaticMarkup(
      <BookingDecision booking={row} canDecide={false} nextHref="/bookings"
        listHref="/bookings" />,
    );

    // Match the buttons, not text: the event's own name contains "Approve".
    const buttons = (html: string) =>
      [...html.matchAll(/<button[^>]*>.*?<\/button>/g)].map((m) =>
        m[0].replace(/<[^>]+>/g, "").trim(),
      );
    expect(buttons(withControls)).toEqual(["Approve", "Reject"]);
    expect(buttons(withHold)).toEqual(["Approve", "Hold", "Reject"]);
    expect(buttons(withoutControls)).toEqual([]);
  });

  it("SCRUM-211 [AC3] TC-211-16: a decided request shows how it was decided, above the same buttons, all disabled; a pending one's are enabled", () => {
    const buttonTags = (html: string) => [...html.matchAll(/<button[^>]*>/g)].map((m) => m[0]);
    const pendingHtml = renderToStaticMarkup(
      <BookingDecision booking={row} canDecide canHold nextHref="/bookings" listHref="/bookings" />,
    );
    const decidedHtml = renderToStaticMarkup(
      <BookingDecision
        booking={{ ...row, status: "APPROVED" }}
        canDecide
        canHold
        decided="Approved by Vera Venue on 1 Mar 2035, 9:00 am SGT."
        nextHref="/bookings"
        listHref="/bookings"
      />,
    );

    expect(decidedHtml).toMatch(
      /data-testid="decided-note"[^>]*>Approved by Vera Venue on 1 Mar 2035, 9:00 am SGT\.</,
    );
    expect(decidedHtml).toContain(">Decided</h2>");
    expect(buttonTags(decidedHtml)).toHaveLength(3);
    expect(buttonTags(decidedHtml).every((tag) => tag.includes('disabled=""'))).toBe(true);
    expect(pendingHtml).not.toContain('data-testid="decided-note"');
    expect(buttonTags(pendingHtml)).toHaveLength(3);
    expect(buttonTags(pendingHtml).some((tag) => tag.includes('disabled=""'))).toBe(false);
  });

  it("SCRUM-211 [AC3] TC-211-17: the decision buttons sit side by side in one row, with no card behind them", () => {
    const html = renderToStaticMarkup(
      <BookingDecision booking={row} canDecide canHold nextHref="/bookings" listHref="/bookings" />,
    );
    const panel = html.match(/<div[^>]*data-testid="booking-decision"[^>]*>/)?.[0] ?? "";
    expect(panel).not.toMatch(/bg-card|border/);
    // The buttons' row: a flex row, not a column.
    const buttonRow = html.match(/<div class="([^"]*)"><button/)?.[1] ?? "";
    expect(buttonRow.split(" ")).toContain("flex");
    expect(buttonRow).not.toContain("flex-col");
    for (const tag of html.match(/<button[^>]*>/g) ?? []) {
      expect(tag).toContain("flex-1");
    }
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

    const decision = (booking: PendingBookingRow) =>
      renderToStaticMarkup(
        <BookingDecision booking={booking} canDecide canHold nextHref="/bookings"
        listHref="/bookings" />,
      );
    const unapproved = renderToStaticMarkup(<BookingDetails booking={hold} />);
    expect(unapproved).toContain("Held until 5 Mar 2035, 10:00 am SGT");
    expect(unapproved).not.toContain("Approved by Venue Staff");
    expect(buttons(decision(hold))).toEqual(["Approve", "Reject"]);

    const approvedHold = { ...hold, holdApprovedAt: new Date("2035-03-01T02:00:00.000Z") };
    const approved = renderToStaticMarkup(<BookingDetails booking={approvedHold} />);
    expect(approved).toContain("Held until 5 Mar 2035, 10:00 am SGT");
    expect(approved).toContain(
      "Approved by Venue Staff – awaiting confirmation",
    );
    expect(buttons(decision(approvedHold))).toEqual(["Reject"]);
  });
});

describe("competing requests on the card — SCRUM-134 AC1", () => {
  const competing = [
    {
      id: "bkg_0",
      startAt: new Date("2035-03-10T02:00:00.000Z"),
      endAt: new Date("2035-03-10T03:00:00.000Z"),
      createdAt: new Date("2034-12-31T01:00:00.000Z"),
      eventName: "Earlier Expo",
      earlier: true,
    },
    {
      id: "bkg_2",
      startAt: new Date("2035-03-10T04:00:00.000Z"),
      endAt: new Date("2035-03-10T06:00:00.000Z"),
      createdAt: new Date("2035-01-02T01:00:00.000Z"),
      eventName: "Later Fair",
      earlier: false,
    },
  ];

  it("SCRUM-134 [AC1, AC2] TC-134-01: a pending request lists each competing request with its submission time, the earlier marked to be decided first", () => {
    const html = renderToStaticMarkup(
      <BookingDetails booking={{ ...row, competing }} />,
    );

    expect(html).toContain('data-testid="competing-requests"');
    expect(html).toContain("“Earlier Expo”, submitted 31 Dec 2034, 9:00 am SGT — earlier, so decide it first");
    expect(html).toContain("“Later Fair”, submitted 2 Jan 2035, 9:00 am SGT — later");
  });

  it("SCRUM-134 [AC1] TC-134-01: a request with no competitors shows no competing list", () => {
    const html = renderToStaticMarkup(<BookingDetails booking={row} />);

    expect(html).not.toContain("Competing requests");
  });
});

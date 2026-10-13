import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { SuitabilityPanel } from "@/app/(app)/bookings/new/suitability-panel";
import { BookingQueue } from "@/app/(app)/bookings/booking-queue";
import type { PendingBookingRow } from "@/app/(app)/bookings/queries";

// SCRUM-40 AC5, AC6, AC8–AC10 — what the request form and the review queue
// show. Rendered to static markup: the interactions run in e2e/venues.spec.ts.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/(app)/venues/suitability-actions", () => ({
  recordSuitabilityJudgement: vi.fn(),
}));
vi.mock("@/app/(app)/bookings/actions", () => ({
  decideBookingRequest: vi.fn(),
}));

const boardroom = {
  capacity: 14,
  facilities: ["whiteboard"],
  accessibilityFeatures: [],
  supportedLayouts: ["boardroom"],
};
const needs = {
  attendance: 40,
  facilities: ["projector"],
  accessibilityFeatures: ["wheelchair-access"],
  layout: "classroom",
};
const judgement = {
  suitable: true,
  note: "Overflow room next door.",
  recordedByName: "Cody Coordinator",
  recordedAt: new Date("2035-01-02T02:00:00Z"),
};

const render = (props: Partial<Parameters<typeof SuitabilityPanel>[0]> = {}) =>
  renderToStaticMarkup(
    <SuitabilityPanel
      eventId="evt_1"
      venueId="ven_boardroom"
      venue={boardroom}
      needs={needs}
      judgement={null}
      canJudge={false}
      {...props}
    />,
  );

describe("SuitabilityPanel — SCRUM-40", () => {
  it("SCRUM-40 [AC6] TC-40-06: a Not suitable venue lists every reason", () => {
    const html = render();

    expect(html).toContain('data-suitable="false"');
    expect(html).toContain("Not suitable");
    for (const reason of [
      "Capacity 14 &lt; attendance 40",
      "Missing facility: projector",
      "No wheelchair access; event needs wheelchair access",
      "Classroom layout not supported",
    ]) {
      expect(html).toContain(reason);
    }
  });

  it("SCRUM-40 [AC5] TC-40-05: a Suitable venue shows no reasons", () => {
    const html = render({
      needs: { attendance: 10, facilities: [], accessibilityFeatures: [], layout: null },
    });

    expect(html).toContain('data-suitable="true"');
    expect(html).not.toContain("suitability-reason");
  });

  it("SCRUM-40 [AC8] TC-40-08: the judgement is shown beside the automatic result and is the one that counts", () => {
    const html = render({ judgement });

    expect(html).toContain('data-suitable="false"');
    expect(html).toContain('data-counts="true"');
    expect(html).toContain("Coordinator&#x27;s judgement:");
    expect(html).toContain("Overflow room next door.");
    expect(html).toContain("This is the result that counts for this event.");
  });

  it("SCRUM-40 [AC8] TC-40-09: only the assigned Coordinator is offered to record a judgement", () => {
    expect(render({ canJudge: true })).toContain("Record your judgement");
    expect(render({ canJudge: true, judgement })).toContain("Change your judgement");
    expect(render({ canJudge: false })).not.toContain("your judgement");
  });

  it("SCRUM-40 [AC9] TC-40-10: it says it is advisory", () => {
    expect(render()).toContain("Advisory only");
  });
});

describe("BookingQueue — SCRUM-40 AC10", () => {
  const row: PendingBookingRow = {
    id: "bkg_1",
    status: "PENDING",
    holdExpiresAt: null,
    holdNote: null,
    eventId: "evt_1",
    startAt: new Date("2035-03-10T01:00:00.000Z"),
    endAt: new Date("2035-03-10T05:00:00.000Z"),
    requestedAttendance: 40,
    requiredFacilities: [],
    requiredAccessibilityFeatures: ["wheelchair-access"],
    requestedLayout: null,
    requestNotes: null,
    createdAt: new Date("2035-01-01T01:00:00.000Z"),
    event: { name: "Board Dinner" },
    requestedBy: { name: "Cody Coordinator", email: "coordinator@test.local" },
    venue: {
      id: "ven_boardroom",
      name: "Executive Boardroom",
      location: "Level 12",
      capacity: 14,
      facilities: [],
      accessibilityFeatures: [],
      supportedLayouts: [],
    },
    blockers: [],
    judgement: null,
  };

  it("SCRUM-40 [AC10] TC-40-11: Venue Staff see the Coordinator's judgement and note on the request", () => {
    const html = renderToStaticMarkup(
      <BookingQueue
        queue={[
          {
            ...row,
            judgement: {
              eventId: "evt_1",
              venueId: "ven_boardroom",
              suitable: false,
              note: "Too small, but the client insists.",
              recordedAt: new Date("2035-01-02T02:00:00Z"),
              recordedByName: "Cody Coordinator",
            },
          },
        ]}
        canDecide
      />,
    );

    expect(html).toContain("queue-judgement");
    expect(html).toContain("Not suitable");
    expect(html).toContain("Too small, but the client insists.");
  });

  it("SCRUM-40 [AC10] TC-40-11: without a judgement it says none was recorded, and the accessibility needed is shown", () => {
    const html = renderToStaticMarkup(<BookingQueue queue={[row]} canDecide />);

    expect(html).toContain("None recorded");
    expect(html).toContain("Accessibility needed");
    expect(html).toContain("wheelchair-access");
  });
});

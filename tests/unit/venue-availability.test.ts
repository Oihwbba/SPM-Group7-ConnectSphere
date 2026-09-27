import { describe, it, expect, vi } from "vitest";

import { describeBlocker, findVenueBlockers } from "@/lib/venue-availability";

// SCRUM-50 AC3 / SCRUM-53 AC3 — what makes a venue unavailable. The query is
// checked against a stub; the same rule is exercised against real rows in
// tests/integration/bookings.test.ts.
const period = {
  startAt: new Date("2030-06-01T06:00:00.000Z"),
  endAt: new Date("2030-06-01T08:00:00.000Z"),
};

function stubDb(bookings: unknown[], unavailability: unknown[]) {
  return {
    booking: { findMany: vi.fn().mockResolvedValue(bookings) },
    venueUnavailability: {
      findMany: vi.fn().mockResolvedValue(unavailability),
    },
  };
}

describe("findVenueBlockers", () => {
  it("SCRUM-50 AC3 — asks only for APPROVED bookings that overlap the period — a pending request blocks nobody", async () => {
    const db = stubDb([], []);

    await findVenueBlockers(db as never, "ven_1", period);

    expect(db.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          venueId: "ven_1",
          status: "APPROVED",
          startAt: { lt: period.endAt },
          endAt: { gt: period.startAt },
        },
      }),
    );
    expect(db.venueUnavailability.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          venueId: "ven_1",
          startAt: { lt: period.endAt },
          endAt: { gt: period.startAt },
        },
      }),
    );
  });

  it("SCRUM-50 AC3 — merges bookings and unavailability, earliest first", async () => {
    const late = {
      id: "bkg_late",
      startAt: new Date("2030-06-01T07:30:00.000Z"),
      endAt: new Date("2030-06-01T09:00:00.000Z"),
    };
    const early = {
      id: "vun_early",
      startAt: new Date("2030-06-01T05:00:00.000Z"),
      endAt: new Date("2030-06-01T06:30:00.000Z"),
      reason: "MAINTENANCE",
    };

    const blockers = await findVenueBlockers(
      stubDb([late], [early]) as never,
      "ven_1",
      period,
    );

    expect(blockers).toEqual([
      { kind: "unavailability", ...early },
      { kind: "booking", ...late },
    ]);
  });
});

describe("describeBlocker", () => {
  it("names an approved booking by its times only — never the other organisation's event", () => {
    expect(describeBlocker({ kind: "booking", id: "b", ...period })).toBe(
      "already booked from 1 Jun 2030, 2:00 pm to 1 Jun 2030, 4:00 pm",
    );
  });

  it("names recorded unavailability with its reason", () => {
    expect(
      describeBlocker({
        kind: "unavailability",
        id: "u",
        ...period,
        reason: "CLOSURE",
      }),
    ).toBe(
      "unavailable (closure) from 1 Jun 2030, 2:00 pm to 1 Jun 2030, 4:00 pm",
    );
  });
});

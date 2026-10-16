import { describe, it, expect, vi, beforeEach } from "vitest";

import { matchesFilters, searchVenues } from "@/lib/venue-search";
import { findVenueBlockers } from "@/lib/venue-availability";

// SCRUM-38 — the search itself, against a stubbed database. Whether a venue
// is free is findVenueBlockers' rule (tested in venue-availability.test.ts);
// these pin that search asks it about the right occupied period and keeps
// only the venues it clears. tests/integration/venue-search.test.ts runs the
// whole search against real rows.
vi.mock("@/lib/venue-availability", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/venue-availability")>()),
  findVenueBlockers: vi.fn(),
}));
const mockBlockers = vi.mocked(findVenueBlockers);

const venue = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  name: id,
  location: "Level 1, Block A",
  capacity: 60,
  facilities: ["projector", "whiteboard"],
  accessibilityFeatures: ["wheelchair-access"],
  supportedLayouts: ["classroom", "theatre"],
  setupMinutes: 0,
  turnaroundMinutes: 0,
  ...overrides,
});

function stubDb(venues: unknown[], bookings: unknown[] = []) {
  return {
    venue: { findMany: vi.fn().mockResolvedValue(venues) },
    booking: { findMany: vi.fn().mockResolvedValue(bookings) },
  };
}

const noFilters = { facilities: [], accessibilityFeatures: [] };
const NOW = new Date("2031-05-01T00:00:00.000Z");
const period = {
  startAt: new Date("2031-06-03T08:15:00.000Z"),
  endAt: new Date("2031-06-03T09:00:00.000Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockBlockers.mockResolvedValue([]);
});

describe("matchesFilters — SCRUM-38 AC11–AC13", () => {
  const room = venue("ven_room");

  it("SCRUM-38 [AC11] TC-38-12: with no filter on, every venue passes", () => {
    expect(matchesFilters(room, noFilters)).toBe(true);
  });

  it("SCRUM-38 [AC12] TC-38-13: capacity equal to the attendance fits; one below it doesn't", () => {
    expect(matchesFilters(room, { ...noFilters, attendance: 60 })).toBe(true);
    expect(matchesFilters(room, { ...noFilters, attendance: 61 })).toBe(false);
  });

  it("SCRUM-38 [AC13] TC-38-12: several facilities must all be there", () => {
    expect(
      matchesFilters(room, { ...noFilters, facilities: ["projector"] }),
    ).toBe(true);
    expect(
      matchesFilters(room, {
        ...noFilters,
        facilities: ["projector", "whiteboard"],
      }),
    ).toBe(true);
    expect(
      matchesFilters(room, {
        ...noFilters,
        facilities: ["projector", "stage"],
      }),
    ).toBe(false);
  });

  it("SCRUM-38 [AC13] TC-38-12: several accessibility features must all be there", () => {
    expect(
      matchesFilters(room, {
        ...noFilters,
        accessibilityFeatures: ["wheelchair-access"],
      }),
    ).toBe(true);
    expect(
      matchesFilters(room, {
        ...noFilters,
        accessibilityFeatures: ["wheelchair-access", "hearing-loop"],
      }),
    ).toBe(false);
  });

  it("SCRUM-38 [AC11] TC-38-12: a layout the venue supports passes; one it doesn't is filtered out", () => {
    expect(matchesFilters(room, { ...noFilters, layout: "theatre" })).toBe(
      true,
    );
    expect(matchesFilters(room, { ...noFilters, layout: "banquet" })).toBe(
      false,
    );
  });

  it("SCRUM-38 [AC11] TC-38-12: filters apply together: failing any one filters the venue out", () => {
    const all = {
      attendance: 60,
      facilities: ["projector"],
      accessibilityFeatures: ["wheelchair-access"],
      layout: "classroom",
    };
    expect(matchesFilters(room, all)).toBe(true);
    expect(matchesFilters(room, { ...all, attendance: 61 })).toBe(false);
    expect(matchesFilters(room, { ...all, layout: "banquet" })).toBe(false);
  });
});

describe("searchVenues — SCRUM-38", () => {
  it("SCRUM-38 [AC2, AC7] TC-38-04, TC-38-08: asks only for active venues at the location picked, in name order", async () => {
    const db = stubDb([]);

    await searchVenues(
      db as never,
      { period: null, location: "Level 1, Block A", filters: noFilters },
      NOW,
    );

    expect(db.venue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true, location: "Level 1, Block A" },
        orderBy: { name: "asc" },
      }),
    );
  });

  it("SCRUM-38 [AC7] TC-38-08: without a location, still only active venues", async () => {
    const db = stubDb([]);

    await searchVenues(db as never, { period: null, filters: noFilters }, NOW);

    expect(db.venue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
  });

  it("SCRUM-38 [AC2] TC-38-04: with no period, availability isn't checked", async () => {
    const db = stubDb([venue("ven_a")]);

    const results = await searchVenues(
      db as never,
      { period: null, filters: noFilters },
      NOW,
    );

    expect(results.map((r) => r.id)).toEqual(["ven_a"]);
    expect(mockBlockers).not.toHaveBeenCalled();
  });

  it("SCRUM-38 [AC3] TC-38-05: each venue is checked over the occupied period a booking would have there, with its own setup and turnaround", async () => {
    const db = stubDb([
      venue("ven_a", { setupMinutes: 30, turnaroundMinutes: 45 }),
      venue("ven_b"),
    ]);

    await searchVenues(db as never, { period, filters: noFilters }, NOW);

    expect(mockBlockers).toHaveBeenCalledWith(
      db,
      "ven_a",
      {
        startAt: new Date("2031-06-03T07:45:00.000Z"),
        endAt: new Date("2031-06-03T09:45:00.000Z"),
      },
      NOW,
    );
    expect(mockBlockers).toHaveBeenCalledWith(db, "ven_b", period, NOW);
  });

  it("SCRUM-38 [AC3] TC-38-05: a venue with anything in the way is excluded; one with nothing is kept", async () => {
    const db = stubDb([venue("ven_taken"), venue("ven_free")]);
    mockBlockers.mockImplementation(async (_db, venueId) =>
      venueId === "ven_taken"
        ? [{ kind: "booking", id: "bkg_1", ...period }]
        : [],
    );

    const results = await searchVenues(
      db as never,
      { period, filters: noFilters },
      NOW,
    );

    expect(results.map((r) => r.id)).toEqual(["ven_free"]);
  });

  it("SCRUM-38 [AC11] TC-38-12: a venue the filters rule out isn't checked for availability", async () => {
    const db = stubDb([venue("ven_small", { capacity: 10 }), venue("ven_big")]);

    const results = await searchVenues(
      db as never,
      { period, filters: { ...noFilters, attendance: 40 } },
      NOW,
    );

    expect(results.map((r) => r.id)).toEqual(["ven_big"]);
    expect(mockBlockers).toHaveBeenCalledTimes(1);
  });

  it("SCRUM-38 [AC8] TC-38-09: each result carries its name, location and capacity, and nothing about setup", async () => {
    const db = stubDb([venue("ven_a", { setupMinutes: 30 })]);

    const [result] = await searchVenues(
      db as never,
      { period: null, filters: noFilters },
      NOW,
    );

    expect(result).toEqual({
      id: "ven_a",
      name: "ven_a",
      location: "Level 1, Block A",
      capacity: 60,
      facilities: ["projector", "whiteboard"],
      accessibilityFeatures: ["wheelchair-access"],
      supportedLayouts: ["classroom", "theatre"],
      alreadyRequested: false,
    });
  });

  it("SCRUM-38 [AC9] TC-38-10: opened from an event, a venue it has a Pending, Held or Approved booking at is marked already requested", async () => {
    const db = stubDb(
      [venue("ven_asked"), venue("ven_other")],
      [{ venueId: "ven_asked" }],
    );

    const results = await searchVenues(
      db as never,
      { period: null, filters: noFilters, eventId: "evt_1" },
      NOW,
    );

    expect(db.booking.findMany).toHaveBeenCalledWith({
      where: {
        eventId: "evt_1",
        venueId: { in: ["ven_asked", "ven_other"] },
        OR: [
          { status: { in: ["PENDING", "APPROVED"] } },
          { status: "HELD", holdExpiresAt: { gt: NOW } },
        ],
      },
      select: { venueId: true },
    });
    expect(results.map((r) => [r.id, r.alreadyRequested])).toEqual([
      ["ven_asked", true],
      ["ven_other", false],
    ]);
  });

  it("SCRUM-38 [AC9] TC-38-10: opened on its own, nothing is marked already requested and bookings aren't read", async () => {
    const db = stubDb([venue("ven_a")]);

    const results = await searchVenues(
      db as never,
      { period: null, filters: noFilters },
      NOW,
    );

    expect(results[0].alreadyRequested).toBe(false);
    expect(db.booking.findMany).not.toHaveBeenCalled();
  });
});

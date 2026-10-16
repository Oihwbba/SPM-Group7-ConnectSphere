import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  EVENT_NOT_BOOKABLE_MESSAGE,
  REPLACED_BOOKING_NOT_FOUND_MESSAGE,
  SEARCH_EVENT_NOT_FOUND_MESSAGE,
  getFilterOptions,
  getSearchEvent,
} from "@/app/(app)/venues/search/queries";
import { EVENT_NOT_SCHEDULED_FOR_SEARCH_MESSAGE } from "@/lib/schemas/venue-search";

// SCRUM-38 AC1 — what search knows when it is opened from an event or a
// flagged booking, and who may open it. The database is mocked;
// tests/integration/venue-search.test.ts reads real rows.
const db = vi.hoisted(() => ({
  event: { findUnique: vi.fn() },
  booking: { findFirst: vi.fn() },
  venue: { findMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));

const COORDINATOR = { id: "usr_coord", role: "COORDINATOR" as const };
const NOW = new Date("2031-05-01T00:00:00.000Z");

/** A Planning event from 10:15 to 11:45 Singapore time, expecting 40. */
const event = (overrides: Record<string, unknown> = {}) => ({
  id: "evt_1",
  name: "Alumni Dinner",
  status: "PLANNING",
  organiserId: "usr_org",
  coordinatorId: "usr_coord",
  startAt: new Date("2031-06-03T10:15:00+08:00"),
  endAt: new Date("2031-06-03T11:45:00+08:00"),
  expectedAttendance: 40,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  db.event.findUnique.mockResolvedValue(event());
  db.booking.findFirst.mockResolvedValue(null);
});

describe("getSearchEvent — SCRUM-38 AC1", () => {
  it("SCRUM-38 [AC1, AC2] TC-38-01: the period is exactly the event's, not rounded, and the attendance starts as the event's", async () => {
    await expect(
      getSearchEvent(COORDINATOR, "evt_1", undefined, NOW),
    ).resolves.toEqual({
      ok: true,
      event: {
        id: "evt_1",
        name: "Alumni Dinner",
        period: {
          startAt: new Date("2031-06-03T10:15:00+08:00"),
          endAt: new Date("2031-06-03T11:45:00+08:00"),
        },
        replacing: null,
        prefill: { attendance: 40, facilities: [] },
      },
    });
    expect(db.booking.findFirst).not.toHaveBeenCalled();
  });

  it("SCRUM-38 [AC1] TC-38-01: an event with no expected attendance starts with none", async () => {
    db.event.findUnique.mockResolvedValue(event({ expectedAttendance: null }));

    const result = await getSearchEvent(COORDINATOR, "evt_1", undefined, NOW);

    expect(result.ok && result.event.prefill).toEqual({
      attendance: undefined,
      facilities: [],
    });
  });

  it("SCRUM-38 [AC1] TC-38-02: from a flagged booking, the attendance, facilities and layout come from that booking request", async () => {
    db.booking.findFirst.mockResolvedValue({
      id: "bkg_1",
      requestedAttendance: 150,
      requiredFacilities: ["sound-system"],
      requestedLayout: "banquet",
      venue: { name: "Exhibition Hall" },
    });

    const result = await getSearchEvent(COORDINATOR, "evt_1", "bkg_1", NOW);

    // Only one of this event's bookings that is flagged and still live.
    expect(db.booking.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "bkg_1",
          eventId: "evt_1",
          needsReconsideration: true,
          OR: [
            { status: { in: ["PENDING", "APPROVED"] } },
            { status: "HELD", holdExpiresAt: { gt: NOW } },
          ],
        },
      }),
    );
    expect(result).toEqual({
      ok: true,
      event: expect.objectContaining({
        replacing: { id: "bkg_1", venueName: "Exhibition Hall" },
        prefill: {
          attendance: 150,
          facilities: ["sound-system"],
          layout: "banquet",
        },
      }),
    });
  });

  it("SCRUM-38 [AC1] TC-38-02: a booking request with no attendance or layout starts with none", async () => {
    db.booking.findFirst.mockResolvedValue({
      id: "bkg_1",
      requestedAttendance: null,
      requiredFacilities: [],
      requestedLayout: null,
      venue: { name: "Exhibition Hall" },
    });

    const result = await getSearchEvent(COORDINATOR, "evt_1", "bkg_1", NOW);

    expect(result.ok && result.event.prefill).toEqual({
      attendance: undefined,
      facilities: [],
      layout: undefined,
    });
  });

  it.each([
    ["doesn't exist", null],
    ["is another Coordinator's", event({ coordinatorId: "usr_other" })],
  ])(
    "SCRUM-38 [AC1] TC-38-03: an event that %s reads as not found",
    async (_, row) => {
      db.event.findUnique.mockResolvedValue(row);

      await expect(
        getSearchEvent(COORDINATOR, "evt_1", undefined, NOW),
      ).resolves.toEqual({ ok: false, error: SEARCH_EVENT_NOT_FOUND_MESSAGE });
      expect(SEARCH_EVENT_NOT_FOUND_MESSAGE).toBe("Event not found.");
    },
  );

  it("SCRUM-38 [AC1] TC-38-03: a role that can't request venues reads it as not found too", async () => {
    await expect(
      getSearchEvent(
        { id: "usr_org", role: "ORGANISER" },
        "evt_1",
        undefined,
        NOW,
      ),
    ).resolves.toEqual({ ok: false, error: SEARCH_EVENT_NOT_FOUND_MESSAGE });
  });

  it.each(["DRAFT", "SUBMITTED", "UNDER_REVIEW", "CONFIRMED", "CANCELLED"])(
    "SCRUM-38 [AC1] TC-38-03: a %s event can't be searched for",
    async (status) => {
      db.event.findUnique.mockResolvedValue(event({ status }));

      await expect(
        getSearchEvent(COORDINATOR, "evt_1", undefined, NOW),
      ).resolves.toEqual({ ok: false, error: EVENT_NOT_BOOKABLE_MESSAGE });
    },
  );

  it("SCRUM-38 [AC1] TC-38-03: an Approved event can be searched for", async () => {
    db.event.findUnique.mockResolvedValue(event({ status: "APPROVED" }));

    const result = await getSearchEvent(COORDINATOR, "evt_1", undefined, NOW);

    expect(result.ok).toBe(true);
  });

  it.each([
    ["no start", { startAt: null }],
    ["no end", { endAt: null }],
  ])(
    "SCRUM-38 [AC1] TC-38-03: an event with %s has no period to search",
    async (_, dates) => {
      db.event.findUnique.mockResolvedValue(event(dates));

      await expect(
        getSearchEvent(COORDINATOR, "evt_1", undefined, NOW),
      ).resolves.toEqual({
        ok: false,
        error: EVENT_NOT_SCHEDULED_FOR_SEARCH_MESSAGE,
      });
    },
  );

  it("SCRUM-38 [AC1] TC-38-03: a booking that isn't this event's flagged booking has nothing to replace", async () => {
    await expect(
      getSearchEvent(COORDINATOR, "evt_1", "bkg_unflagged", NOW),
    ).resolves.toEqual({
      ok: false,
      error: REPLACED_BOOKING_NOT_FOUND_MESSAGE,
    });
  });
});

describe("getFilterOptions — SCRUM-38 AC2, AC11, AC13", () => {
  it("SCRUM-38 [AC2, AC11, AC13] TC-38-04, TC-38-12: offers each location and value active venues list, once, in order", async () => {
    db.venue.findMany.mockResolvedValue([
      {
        location: "Level 1, Block A",
        facilities: ["stage", "projector"],
        accessibilityFeatures: ["hearing-loop"],
        supportedLayouts: ["theatre"],
      },
      {
        location: "Level 1, Block A",
        facilities: ["projector"],
        accessibilityFeatures: ["accessible-restroom", "hearing-loop"],
        supportedLayouts: ["banquet", "theatre"],
      },
      {
        location: "Level 2, Block B",
        facilities: [],
        accessibilityFeatures: [],
        supportedLayouts: [],
      },
    ]);

    await expect(getFilterOptions()).resolves.toEqual({
      locations: ["Level 1, Block A", "Level 2, Block B"],
      facilities: ["projector", "stage"],
      accessibilityFeatures: ["accessible-restroom", "hearing-loop"],
      layouts: ["banquet", "theatre"],
    });
    expect(db.venue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
  });
});

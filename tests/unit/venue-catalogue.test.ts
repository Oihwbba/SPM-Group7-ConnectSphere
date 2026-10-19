import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { createVenue, retireVenue, updateVenue } from "@/app/(app)/venues/actions";
import {
  CAPACITY_INVALID_MESSAGE,
  CLOSING_NOT_AFTER_OPENING_MESSAGE,
  HOURS_REQUIRED_MESSAGE,
  VENUE_CHANGE_AFFECTS_BOOKINGS_MESSAGE,
  VENUE_RETIRE_HAS_BOOKINGS_MESSAGE,
} from "@/lib/schemas/venue";
import {
  findTimeClashes,
  flagTimeClashes,
  pendingTimeClashes,
  type TimeClash,
} from "@/lib/venue-time-clashes";

// SCRUM-34 — adding, editing and retiring venues, with the database mocked:
// permission, validation and every refusal. The same criteria are proven
// against a real Postgres in tests/integration/venue-catalogue.test.ts.
const db = vi.hoisted(() => ({
  venue: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
  venueOpeningHours: { upsert: vi.fn() },
  // SCRUM-124 AC8: flagArrangements returns what it flagged and tells the
  // people responsible.
  booking: { findMany: vi.fn(), updateManyAndReturn: vi.fn() },
  reservation: { updateManyAndReturn: vi.fn() },
  event: { findMany: vi.fn() },
  user: { findMany: vi.fn() },
  notification: { create: vi.fn(), createMany: vi.fn() },
  auditLog: { create: vi.fn() },
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// SCRUM-160: finding and flagging the clashes have their own tests
// (venue-time-clashes.test.ts); here only how the edit uses them.
vi.mock("@/lib/venue-time-clashes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/venue-time-clashes")>()),
  findTimeClashes: vi.fn(),
  pendingTimeClashes: vi.fn(),
  flagTimeClashes: vi.fn(),
}));

const mockAuth = auth as unknown as Mock;

function sessionFor(role: Role): Session {
  const id = `usr_${role.toLowerCase()}`;
  return {
    user: { id, role, name: "Test User", email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  };
}

const at = (sgt: string) => new Date(`${sgt}+08:00`);

/** What Venue Staff enter: Mon–Sat 10:00–22:00, Sunday Closed. */
const input = {
  name: "Rooftop Garden",
  location: "Level 20, Block A",
  capacity: "80",
  facilities: "Projector, Sound System",
  accessibilityFeatures: "wheelchair access",
  supportedLayouts: "Theatre",
  openingHours: [1, 2, 3, 4, 5, 6, 7].map((weekday) =>
    weekday === 7
      ? { weekday, closed: true }
      : { weekday, closed: false, opensAt: "10:00", closesAt: "22:00" },
  ),
  setupMinutes: "0",
  turnaroundMinutes: "0",
  knownRestrictions: "Limited emergency access",
};

const withDay = (weekday: number, day: object) => ({
  ...input,
  openingHours: input.openingHours.map((d) => (d.weekday === weekday ? { weekday, ...day } : d)),
});

/** The venue as stored before an edit. */
const stored = {
  isActive: true,
  capacity: 80,
  facilities: ["projector", "sound-system"],
  accessibilityFeatures: ["wheelchair-access"],
  supportedLayouts: ["theatre"],
  openingHours: [1, 2, 3, 4, 5, 6, 7].map((weekday) =>
    weekday === 7
      ? { weekday, opensMinute: null, closesMinute: null }
      : { weekday, opensMinute: 600, closesMinute: 1320 },
  ),
};

/**
 * A future Approved booking for 70 that asked for a projector and wheelchair
 * access, Tuesday 10:00–14:00.
 */
const futureBooking = {
  id: "bkg_1",
  startAt: at("2036-03-04T10:00"),
  endAt: at("2036-03-04T14:00"),
  status: "APPROVED",
  requestedAttendance: 70,
  requiredFacilities: ["projector"],
  requiredAccessibilityFeatures: ["wheelchair-access"],
  requestedLayout: "theatre",
  event: { name: "Spring Gala" },
};

function expectNothingWritten() {
  expect(db.venue.create).not.toHaveBeenCalled();
  expect(db.venue.update).not.toHaveBeenCalled();
  expect(db.venueOpeningHours.upsert).not.toHaveBeenCalled();
  expect(db.auditLog.create).not.toHaveBeenCalled();
  expect(db.booking.updateManyAndReturn).not.toHaveBeenCalled();
}

/** AC10, AC11 — the one booking flagged, with its reason, and nothing else about it changed. */
function expectFlagged(id: string, reason: string) {
  expect(db.booking.updateManyAndReturn).toHaveBeenCalledTimes(1);
  expect(db.booking.updateManyAndReturn).toHaveBeenCalledWith({
    where: expect.objectContaining({ id: { in: [id] }, needsReconsideration: false }),
    data: {
      needsReconsideration: true,
      reconsiderationFlaggedAt: expect.any(Date),
      reconsiderationReason: reason,
      reconsiderationResolvedAt: null,
      reconsiderationResolvedById: null,
    },
    select: expect.any(Object),
  });
  expect(revalidatePath).toHaveBeenCalledWith("/events");
}

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((work: (tx: typeof db) => unknown) => work(db));
  mockAuth.mockResolvedValue(sessionFor("VENUE_STAFF"));
  db.venue.create.mockResolvedValue({ id: "ven_new" });
  db.venue.findUnique.mockResolvedValue(stored);
  db.booking.findMany.mockResolvedValue([]);
  db.booking.updateManyAndReturn.mockResolvedValue([
    { id: "bkg_1", eventId: "evt_1", status: "APPROVED", venue: { name: "Hall" } },
  ]);
  db.reservation.updateManyAndReturn.mockResolvedValue([]);
  db.event.findMany.mockResolvedValue([]);
  db.user.findMany.mockResolvedValue([]);
  vi.mocked(findTimeClashes).mockResolvedValue([]);
  vi.mocked(pendingTimeClashes).mockImplementation(async (_db, clashes) => clashes);
  vi.mocked(flagTimeClashes).mockResolvedValue(0);
});

describe("createVenue — SCRUM-34 AC3–AC5", () => {
  it("SCRUM-34 [AC3] TC-34-03: Venue Staff add a venue with seven days of hours, setup and turnaround at 0, and an audit entry", async () => {
    expect(await createVenue(input)).toEqual({ ok: true, data: { id: "ven_new" } });

    expect(db.venue.create).toHaveBeenCalledWith({
      data: {
        name: "Rooftop Garden",
        location: "Level 20, Block A",
        capacity: 80,
        facilities: ["projector", "sound-system"],
        accessibilityFeatures: ["wheelchair-access"],
        supportedLayouts: ["theatre"],
        setupMinutes: 0,
        turnaroundMinutes: 0,
        knownRestrictions: "Limited emergency access",
        openingHours: {
          create: [1, 2, 3, 4, 5, 6, 7].map((weekday) =>
            weekday === 7
              ? { weekday, opensMinute: null, closesMinute: null }
              : { weekday, opensMinute: 600, closesMinute: 1320 },
          ),
        },
      },
      select: { id: true },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityType: "Venue",
        entityId: "ven_new",
        action: "CREATED",
        actorId: "usr_venue_staff",
      }),
    });
    expect(revalidatePath).toHaveBeenCalledWith("/venues");
    expect(revalidatePath).toHaveBeenCalledWith("/bookings/new");
  });

  it("SCRUM-34 [AC3] TC-34-03: setup and turnaround start at 0 when left out, and lists may come as arrays", async () => {
    const { setupMinutes: _s, turnaroundMinutes: _t, ...rest } = input;
    await createVenue({ ...rest, facilities: ["Stage"], knownRestrictions: "" });

    expect(db.venue.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          setupMinutes: 0,
          turnaroundMinutes: 0,
          facilities: ["stage"],
          knownRestrictions: null,
        }),
      }),
    );
  });

  it.each([
    ["name", { name: " " }, "Give the venue a name."],
    ["location", { location: "" }, "Enter the venue's location."],
    ["capacity", { capacity: "" }, CAPACITY_INVALID_MESSAGE],
  ])("SCRUM-34 [AC3] TC-34-04: a venue with no %s is refused against it, and nothing is written", async (field, change, message) => {
    const result = await createVenue({ ...input, ...change });

    expect(result).toMatchObject({ ok: false, fieldErrors: { [field]: [message] } });
    expectNothingWritten();
  });

  it("SCRUM-34 [AC3] TC-34-04: a day neither Closed nor given both times is refused against that day", async () => {
    const result = await createVenue(withDay(3, { closed: false, opensAt: "09:00", closesAt: "" }));

    expect(result).toMatchObject({ ok: false, fieldErrors: { "hours-3": [HOURS_REQUIRED_MESSAGE] } });
    expectNothingWritten();
  });

  it("SCRUM-34 [AC3] TC-34-04: an open day sent with no times at all is refused against that day", async () => {
    const result = await createVenue(withDay(5, { closed: false }));

    expect(result).toMatchObject({ ok: false, fieldErrors: { "hours-5": [HOURS_REQUIRED_MESSAGE] } });
    expectNothingWritten();
  });

  it("SCRUM-34 [AC3] TC-34-03: facilities, accessibility features and layouts are optional", async () => {
    const { facilities: _f, accessibilityFeatures: _a, supportedLayouts: _l, ...rest } = input;

    expect(await createVenue(rest)).toMatchObject({ ok: true });
    expect(db.venue.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ facilities: [], accessibilityFeatures: [], supportedLayouts: [] }),
      }),
    );
  });

  it("SCRUM-34 [AC3, AC6] TC-34-18: options picked from the lists and ones Venue Staff add are saved as tags, each once", async () => {
    expect(
      await createVenue({
        ...input,
        facilities: ["projector", "sound-system", "Rooftop Bar", "rooftop-bar"],
        accessibilityFeatures: ["wheelchair-access", "Tactile paving"],
        supportedLayouts: ["theatre", "Garden Party"],
      }),
    ).toMatchObject({ ok: true });
    expect(db.venue.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          facilities: ["projector", "sound-system", "rooftop-bar"],
          accessibilityFeatures: ["wheelchair-access", "tactile-paving"],
          supportedLayouts: ["theatre", "garden-party"],
        }),
      }),
    );
  });

  it("SCRUM-34 [AC3] TC-34-19: an added option of 60 characters is saved; one of 61 is refused against its field and nothing is written", async () => {
    expect(await createVenue({ ...input, facilities: ["a".repeat(60)] })).toMatchObject({
      ok: true,
    });

    vi.clearAllMocks();
    expect(
      await createVenue({ ...input, accessibilityFeatures: ["projector", "a".repeat(61)] }),
    ).toMatchObject({
      ok: false,
      fieldErrors: { accessibilityFeatures: ["Keep each one under 60 characters."] },
    });
    expectNothingWritten();
  });

  it("SCRUM-34 [AC3] TC-34-04: hours that leave a day out are refused against that day", async () => {
    const result = await createVenue({
      ...input,
      openingHours: input.openingHours.map((d) => (d.weekday === 7 ? { ...d, weekday: 6 } : d)),
    });

    expect(result).toMatchObject({ ok: false, fieldErrors: { "hours-7": [HOURS_REQUIRED_MESSAGE] } });
    expectNothingWritten();
  });

  it.each(["0", "-5", "12.5", "many"])(
    "SCRUM-34 [AC4] TC-34-05: capacity %j is reported as invalid, and nothing is written",
    async (capacity) => {
      const result = await createVenue({ ...input, capacity });

      expect(result).toMatchObject({
        ok: false,
        fieldErrors: { capacity: [CAPACITY_INVALID_MESSAGE] },
      });
      expectNothingWritten();
    },
  );

  it("SCRUM-34 [AC4] TC-34-05: capacity 1 is saved", async () => {
    expect(await createVenue({ ...input, capacity: "1" })).toMatchObject({ ok: true });
    expect(db.venue.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ capacity: 1 }) }),
    );
  });

  it.each([
    ["the same as", "18:00"],
    ["before", "09:00"],
  ])("SCRUM-34 [AC5] TC-34-06: a closing time %s the opening time is refused against that day only", async (_label, closesAt) => {
    const result = await createVenue(withDay(2, { closed: false, opensAt: "18:00", closesAt }));

    expect(result).toMatchObject({ ok: false });
    expect(result.ok === false && result.fieldErrors).toEqual({
      "hours-2": [CLOSING_NOT_AFTER_OPENING_MESSAGE],
    });
    expectNothingWritten();
  });

  it("SCRUM-34 [AC5] TC-34-06: a closing time one minute after opening is saved", async () => {
    expect(
      await createVenue(withDay(2, { closed: false, opensAt: "18:00", closesAt: "18:01" })),
    ).toMatchObject({ ok: true });
  });
});

describe("who may change the catalogue — SCRUM-34 AC9", () => {
  it.each([
    "COORDINATOR",
    "ORGANISER",
    "TECH_SUPPORT",
    "ATTENDEE",
    "COORDINATOR_LEAD",
    "SAFETY_OFFICER",
  ] as const)("SCRUM-34 [AC9] TC-34-11: %s can't add, edit or retire a venue, and nothing is read or written", async (role) => {
    mockAuth.mockResolvedValue(sessionFor(role));
    const refused = { ok: false, error: "You do not have permission to do that." };

    expect(await createVenue(input)).toEqual(refused);
    expect(await updateVenue({ ...input, venueId: "ven_1" })).toEqual(refused);
    expect(await retireVenue({ venueId: "ven_1" })).toEqual(refused);
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.venue.findUnique).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it("SCRUM-34 [AC9] TC-34-11: a signed-out caller is refused", async () => {
    mockAuth.mockResolvedValue(null);
    expect(await createVenue(input)).toMatchObject({ ok: false });
    expectNothingWritten();
  });
});

describe("updateVenue — SCRUM-34 AC6, AC10", () => {
  it("SCRUM-34 [AC6] TC-34-07: an edit is saved under the venue lock, each day's hours kept as one row, and audited", async () => {
    const result = await updateVenue({ ...input, capacity: "120", venueId: "ven_1" });

    expect(result).toEqual({ ok: true, data: { id: "ven_1", flagged: 0 } });
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    expect(db.venue.update).toHaveBeenCalledWith({
      where: { id: "ven_1" },
      data: expect.objectContaining({ capacity: 120, facilities: ["projector", "sound-system"] }),
    });
    expect(db.venueOpeningHours.upsert).toHaveBeenCalledTimes(7);
    expect(db.venueOpeningHours.upsert).toHaveBeenCalledWith({
      where: { venueId_weekday: { venueId: "ven_1", weekday: 7 } },
      create: { venueId: "ven_1", weekday: 7, opensMinute: null, closesMinute: null },
      update: { opensMinute: null, closesMinute: null },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ entityId: "ven_1", action: "UPDATED", actorId: "usr_venue_staff" }),
    });
    expect(revalidatePath).toHaveBeenCalledWith("/venues/ven_1");
  });

  it("SCRUM-34 [AC10] TC-34-12: an edit that would stop a future booking fitting warns first, listing the booking with why, and writes nothing", async () => {
    db.booking.findMany.mockResolvedValue([futureBooking]);

    const result = await updateVenue({ ...input, capacity: "60", venueId: "ven_1" });

    expect(result).toEqual({
      ok: false,
      error: VENUE_CHANGE_AFFECTS_BOOKINGS_MESSAGE,
      fieldErrors: {
        affectedBookings: [
          "Spring Gala, 4 Mar 2036, 10:00 am SGT (Approved): Capacity 60 < attendance 70",
        ],
        affectedBookingIds: ["bkg_1"],
      },
    });
    expectNothingWritten();
  });

  it("SCRUM-34 [AC10] TC-34-12: once Venue Staff confirm, the edit is saved and the booking flagged Needs Reconsideration with why", async () => {
    db.booking.findMany.mockResolvedValue([futureBooking]);

    const result = await updateVenue({
      ...input,
      capacity: "60",
      venueId: "ven_1",
      confirmedBookingIds: ["bkg_1"],
    });

    expect(result).toEqual({ ok: true, data: { id: "ven_1", flagged: 1 } });
    expect(db.venue.update).toHaveBeenCalledWith({
      where: { id: "ven_1" },
      data: expect.objectContaining({ capacity: 60 }),
    });
    expectFlagged("bkg_1", "Rooftop Garden changed: Capacity 60 < attendance 70");
  });

  it("SCRUM-34 [AC10] TC-34-12: removing an accessibility feature a future booking needs warns first, and writes nothing", async () => {
    db.booking.findMany.mockResolvedValue([futureBooking]);

    const result = await updateVenue({ ...input, accessibilityFeatures: "", venueId: "ven_1" });

    expect(result).toMatchObject({
      ok: false,
      error: VENUE_CHANGE_AFFECTS_BOOKINGS_MESSAGE,
      fieldErrors: {
        affectedBookings: [
          "Spring Gala, 4 Mar 2036, 10:00 am SGT (Approved): No wheelchair access; event needs wheelchair access",
        ],
        affectedBookingIds: ["bkg_1"],
      },
    });
    expectNothingWritten();
  });

  it("SCRUM-34 [AC10] TC-34-12: a booking affected since Venue Staff were warned warns again, and nothing is written", async () => {
    db.booking.findMany.mockResolvedValue([futureBooking, { ...futureBooking, id: "bkg_2" }]);

    const result = await updateVenue({
      ...input,
      capacity: "60",
      venueId: "ven_1",
      confirmedBookingIds: ["bkg_1"],
    });

    expect(result).toMatchObject({
      ok: false,
      error: VENUE_CHANGE_AFFECTS_BOOKINGS_MESSAGE,
      fieldErrors: { affectedBookingIds: ["bkg_1", "bkg_2"] },
    });
    expectNothingWritten();
  });

  it("SCRUM-34 [AC10] TC-34-12: only future Pending, Approved or live Held bookings are judged", async () => {
    await updateVenue({ ...input, venueId: "ven_1" });

    expect(db.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          venueId: "ven_1",
          endAt: { gt: expect.any(Date) },
          OR: [
            { status: { in: ["PENDING", "APPROVED"] } },
            { status: "HELD", holdExpiresAt: { gt: expect.any(Date) } },
          ],
        },
      }),
    );
  });

  it("SCRUM-34 [AC10] TC-34-13: an edit the future booking still fits is saved, and nothing is flagged", async () => {
    db.booking.findMany.mockResolvedValue([futureBooking]);

    expect(await updateVenue({ ...input, capacity: "70", venueId: "ven_1" })).toEqual({
      ok: true,
      data: { id: "ven_1", flagged: 0 },
    });
    expect(db.venue.update).toHaveBeenCalled();
    expect(db.booking.updateManyAndReturn).not.toHaveBeenCalled();
  });

  it.each([
    ["doesn't exist", null, "Venue not found."],
    ["is retired", { ...stored, isActive: false }, "A retired venue can't be edited."],
  ])("SCRUM-34 [AC6] TC-34-07: a venue that %s isn't edited", async (_label, found, message) => {
    db.venue.findUnique.mockResolvedValue(found);

    expect(await updateVenue({ ...input, venueId: "ven_1" })).toEqual({ ok: false, error: message });
    expectNothingWritten();
  });

  it("SCRUM-34 [AC6] TC-34-07: an edit naming no venue is refused before anything is read", async () => {
    expect(await updateVenue({ ...input, venueId: "" })).toMatchObject({
      ok: false,
      fieldErrors: { venueId: ["Choose a venue."] },
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe("updateVenue — SCRUM-160 AC1–AC3, AC6", () => {
  /** A clash the longer times would make: bkg_1 with another event's booking. */
  const clash = (bookingId = "bkg_1", withId = "bkg_other"): TimeClash => ({
    booking: {
      id: bookingId,
      status: "APPROVED",
      startAt: at("2036-03-04T13:00"),
      endAt: at("2036-03-04T15:00"),
      eventId: "evt_1",
      eventName: "Spring Gala",
      coordinatorId: "usr_coord",
      coordinatorName: "Cody",
      needsReconsideration: false,
      reconsiderationReason: null,
    },
    with: {
      kind: "booking",
      id: withId,
      startAt: at("2036-03-04T10:00"),
      endAt: at("2036-03-04T12:00"),
      eventName: "Career Fair",
    },
  });
  const longer = { ...input, venueId: "ven_1", setupMinutes: "30", turnaroundMinutes: "45" };

  beforeEach(() => {
    db.venue.findUnique.mockResolvedValue({ ...stored, setupMinutes: 0, turnaroundMinutes: 0 });
  });

  it("SCRUM-160 [AC1] TC-160-01: lengthening setup or turnaround warns first, listing each booking it would make clash and with what, and writes nothing", async () => {
    vi.mocked(findTimeClashes).mockResolvedValue([clash(), clash("bkg_1", "bkg_third")]);

    expect(await updateVenue(longer)).toEqual({
      ok: false,
      error: VENUE_CHANGE_AFFECTS_BOOKINGS_MESSAGE,
      fieldErrors: {
        affectedBookings: [
          `Spring Gala, 4 Mar 2036, 1:00 pm SGT (Approved): Setup or turnaround time changed, it would clash with "Career Fair"'s booking from 4 Mar 2036, 10:00 am SGT to 4 Mar 2036, 12:00 pm SGT; "Career Fair"'s booking from 4 Mar 2036, 10:00 am SGT to 4 Mar 2036, 12:00 pm SGT`,
        ],
        affectedBookingIds: ["bkg_1"],
      },
    });
    expect(findTimeClashes).toHaveBeenCalledWith(
      db,
      "ven_1",
      expect.objectContaining({ setupMinutes: 30, turnaroundMinutes: 45 }),
      expect.any(Date),
    );
    expectNothingWritten();
  });

  it("SCRUM-160 [AC2, AC3] TC-160-07: once confirmed, the times are saved and the clashing bookings flagged, with the count returned", async () => {
    vi.mocked(findTimeClashes).mockResolvedValue([clash()]);
    vi.mocked(flagTimeClashes).mockResolvedValue(1);

    expect(await updateVenue({ ...longer, confirmedBookingIds: ["bkg_1"] })).toEqual({
      ok: true,
      data: { id: "ven_1", flagged: 1 },
    });
    expect(db.venue.update).toHaveBeenCalledWith({
      where: { id: "ven_1" },
      data: expect.objectContaining({ setupMinutes: 30, turnaroundMinutes: 45 }),
    });
    expect(flagTimeClashes).toHaveBeenCalledWith(
      db,
      [clash()],
      "usr_venue_staff",
      expect.any(Date),
    );
  });

  it("SCRUM-160 [AC1] TC-160-01: a booking that also stops fitting is listed once, for that reason", async () => {
    db.booking.findMany.mockResolvedValue([futureBooking]);
    vi.mocked(findTimeClashes).mockResolvedValue([clash()]);

    const result = await updateVenue({ ...longer, capacity: "60" });

    expect(result).toMatchObject({
      ok: false,
      fieldErrors: {
        affectedBookings: [
          "Spring Gala, 4 Mar 2036, 10:00 am SGT (Approved): Capacity 60 < attendance 70",
        ],
        affectedBookingIds: ["bkg_1"],
      },
    });
  });

  it("SCRUM-160 [AC7] TC-160-08: clashes already recorded aren't warned of again", async () => {
    vi.mocked(findTimeClashes).mockResolvedValue([clash()]);
    vi.mocked(pendingTimeClashes).mockResolvedValue([]);

    expect(await updateVenue(longer)).toEqual({ ok: true, data: { id: "ven_1", flagged: 0 } });
  });

  it("SCRUM-160 [AC6] TC-160-06: shortening, or saving the same times, doesn't look for clashes", async () => {
    db.venue.findUnique.mockResolvedValue({ ...stored, setupMinutes: 30, turnaroundMinutes: 45 });

    await updateVenue({ ...longer, setupMinutes: "15" });
    await updateVenue(longer);

    expect(findTimeClashes).not.toHaveBeenCalled();
  });
});

describe("retireVenue — SCRUM-34 AC8, AC11", () => {
  it("SCRUM-34 [AC8] TC-34-10: a venue with no future bookings is retired under the venue lock, and audited", async () => {
    db.venue.findUnique.mockResolvedValue({ name: "Rooftop Garden", isActive: true });

    expect(await retireVenue({ venueId: "ven_1" })).toEqual({
      ok: true,
      data: { id: "ven_1", flagged: 0 },
    });
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    expect(db.venue.update).toHaveBeenCalledWith({
      where: { id: "ven_1" },
      data: { isActive: false },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "RETIRED", oldValue: "true", newValue: "false" }),
    });
    expect(revalidatePath).toHaveBeenCalledWith("/bookings/new");
  });

  it("SCRUM-34 [AC11] TC-34-14: retiring a venue with future bookings warns first, listing them, and writes nothing", async () => {
    db.venue.findUnique.mockResolvedValue({ name: "Rooftop Garden", isActive: true });
    db.booking.findMany.mockResolvedValue([futureBooking]);

    expect(await retireVenue({ venueId: "ven_1" })).toEqual({
      ok: false,
      error: VENUE_RETIRE_HAS_BOOKINGS_MESSAGE,
      fieldErrors: {
        affectedBookings: ["Spring Gala, 4 Mar 2036, 10:00 am SGT (Approved)"],
        affectedBookingIds: ["bkg_1"],
      },
    });
    expectNothingWritten();
  });

  it("SCRUM-34 [AC11] TC-34-14: once Venue Staff confirm, the venue is retired and its future bookings flagged, none cancelled", async () => {
    db.venue.findUnique.mockResolvedValue({ name: "Rooftop Garden", isActive: true });
    db.booking.findMany.mockResolvedValue([futureBooking]);

    expect(await retireVenue({ venueId: "ven_1", confirmedBookingIds: ["bkg_1"] })).toEqual({
      ok: true,
      data: { id: "ven_1", flagged: 1 },
    });
    expect(db.venue.update).toHaveBeenCalledWith({
      where: { id: "ven_1" },
      data: { isActive: false },
    });
    expectFlagged("bkg_1", "Rooftop Garden has been retired.");
  });

  it("SCRUM-34 [AC11] TC-34-14: a booking made since Venue Staff were warned warns again, and nothing is written", async () => {
    db.venue.findUnique.mockResolvedValue({ name: "Rooftop Garden", isActive: true });
    db.booking.findMany.mockResolvedValue([futureBooking, { ...futureBooking, id: "bkg_2" }]);

    expect(
      await retireVenue({ venueId: "ven_1", confirmedBookingIds: ["bkg_1"] }),
    ).toMatchObject({ ok: false, fieldErrors: { affectedBookingIds: ["bkg_1", "bkg_2"] } });
    expectNothingWritten();
  });

  it.each([
    ["doesn't exist", null, "Venue not found."],
    ["is already retired", { name: "Rooftop Garden", isActive: false }, "This venue is already retired."],
  ])("SCRUM-34 [AC8] TC-34-10: a venue that %s isn't retired again", async (_label, found, message) => {
    db.venue.findUnique.mockResolvedValue(found);

    expect(await retireVenue({ venueId: "ven_1" })).toEqual({ ok: false, error: message });
    expectNothingWritten();
  });

  it("SCRUM-34 [AC8] TC-34-10: a retirement naming no venue is refused before anything is read", async () => {
    expect(await retireVenue({})).toMatchObject({ ok: false });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe("an unexpected database error — SCRUM-34", () => {
  it("is thrown, not reported as a refusal", async () => {
    db.$transaction.mockRejectedValue(new Error("connection lost"));

    await expect(createVenue(input)).rejects.toThrow("connection lost");
    await expect(updateVenue({ ...input, venueId: "ven_1" })).rejects.toThrow("connection lost");
    await expect(retireVenue({ venueId: "ven_1" })).rejects.toThrow("connection lost");
  });
});

import { describe, it, expect, vi, beforeAll, afterAll, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { parseSingaporeDateTime } from "@/lib/datetime";
import { violatesCheck } from "@/lib/db-errors";
import { openingHoursRefusal } from "@/lib/venue-hours";
import { createVenue, retireVenue, updateVenue } from "@/app/(app)/venues/actions";
import { getVenueCatalogue, getVenueDetail } from "@/app/(app)/venues/queries";
import {
  checkVenueAvailability,
  confirmHold,
  decideBookingRequest,
  holdBookingRequest,
  submitBookingRequest,
} from "@/app/(app)/bookings/actions";
import { getPendingBookingQueue, getRequestableVenues } from "@/app/(app)/bookings/queries";
import { createPlanningEvents, removeEvents } from "./test-events";

// SCRUM-34 against a real, seeded Postgres: venues added, edited and retired
// through the actions, the database's own opening-hours check, opening hours
// refusing requests, holds and approvals (AC7), the AC10–AC12 refusals judged
// on stored bookings, and two retirements at once. Only the session is
// mocked. These WRITE, so they only run against a localhost database.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
const mockAuth = auth as unknown as Mock;

const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

function signIn(role: Role, id: string) {
  const session: Session = {
    user: { id, role, name: role, email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  };
  mockAuth.mockResolvedValue(session);
}
const asVenueStaff = () => signIn("VENUE_STAFF", "usr_venuestaff");
const asCoordinator = () => signIn("COORDINATOR", "usr_coordinator");

const sg = (wall: string) => parseSingaporeDateTime(wall)!;
// 4 March 2036 is a Tuesday; 9 March a Sunday.
const TUESDAY = "2036-03-04";
const SUNDAY = "2036-03-09";

/** Mon–Sat 10:00–22:00, Sunday Closed. */
const hoursInput = (tuesday = { opensAt: "10:00", closesAt: "22:00" }) =>
  [1, 2, 3, 4, 5, 6, 7].map((weekday) =>
    weekday === 7
      ? { weekday, closed: true }
      : { weekday, closed: false, ...(weekday === 2 ? tuesday : { opensAt: "10:00", closesAt: "22:00" }) },
  );

const venueInput = (name: string, extra: object = {}) => ({
  name: `SCRUM-34 ${name} ${Date.now()}`,
  location: "Level 20, Block A",
  capacity: 80,
  facilities: "projector",
  accessibilityFeatures: "wheelchair-access",
  supportedLayouts: "theatre",
  openingHours: hoursInput(),
  setupMinutes: 0,
  turnaroundMinutes: 0,
  knownRestrictions: "Limited emergency access",
  ...extra,
});

describe.skipIf(!usesLocalDatabase)("venue catalogue — real database (SCRUM-34)", () => {
  const venueIds: string[] = [];
  const eventIds: string[] = [];

  async function addVenue(name: string, extra: object = {}) {
    asVenueStaff();
    const result = await createVenue(venueInput(name, extra));
    if (!result.ok) throw new Error(result.error);
    venueIds.push(result.data.id);
    return result.data.id;
  }

  async function event(start: string, end: string, expectedAttendance = 40) {
    const [id] = await createPlanningEvents("SCRUM-34", [
      { startAt: sg(start), endAt: sg(end), expectedAttendance },
    ]);
    eventIds.push(id);
    return id;
  }

  /** A booking written straight to the table, as if made before this story. */
  async function booking(
    venueId: string,
    start: string,
    end: string,
    data: Partial<{
      status: "PENDING" | "APPROVED" | "CANCELLED";
      requestedAttendance: number;
      requiredFacilities: string[];
    }> = {},
  ) {
    const eventId = await event(start, end, data.requestedAttendance ?? 40);
    return prisma.booking.create({
      data: {
        eventId,
        venueId,
        startAt: sg(start),
        endAt: sg(end),
        status: "PENDING",
        requestedAttendance: 40,
        requestedById: "usr_coordinator",
        ...data,
      },
      select: { id: true, eventId: true },
    });
  }

  /**
   * A live hold written straight to the table, expiring in two days; with
   * `approved`, Venue Staff have approved it (SCRUM-163 AC7).
   */
  async function heldBooking(venueId: string, start: string, end: string, approved = false) {
    const eventId = await event(start, end);
    const now = Date.now();
    return prisma.booking.create({
      data: {
        eventId,
        venueId,
        startAt: sg(start),
        endAt: sg(end),
        status: "HELD",
        requestedAttendance: 40,
        requestedById: "usr_coordinator",
        heldAt: new Date(now - 60 * 60 * 1000),
        holdExpiresAt: new Date(now + 48 * 60 * 60 * 1000),
        holdNote: "Confirm numbers.",
        ...(approved && { holdApprovedAt: new Date(now), holdApprovedById: "usr_venuestaff" }),
      },
      select: { id: true },
    });
  }

  beforeAll(() => asVenueStaff());

  afterAll(async () => {
    await removeEvents(eventIds);
    await prisma.booking.deleteMany({ where: { venueId: { in: venueIds } } });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: venueIds } } });
    await prisma.venue.deleteMany({ where: { id: { in: venueIds } } });
  });

  it("SCRUM-34 [AC3] TC-34-03: an added venue is stored with seven days of hours, Sunday Closed, and audited", async () => {
    const id = await addVenue("Rooftop");

    const venue = await getVenueDetail(id);
    expect(venue).toMatchObject({
      capacity: 80,
      facilities: ["projector"],
      setupMinutes: 0,
      turnaroundMinutes: 0,
      knownRestrictions: "Limited emergency access",
      isActive: true,
    });
    expect(venue!.openingHours).toHaveLength(7);
    expect(venue!.openingHours[1]).toEqual({ weekday: 2, opensMinute: 600, closesMinute: 1320 });
    expect(venue!.openingHours[6]).toEqual({ weekday: 7, opensMinute: null, closesMinute: null });
    expect(
      await prisma.auditLog.count({
        where: { entityId: id, action: "CREATED", actorId: "usr_venuestaff" },
      }),
    ).toBe(1);
  });

  it("SCRUM-34 [AC5] TC-34-06: the database refuses a closing time that isn't after the opening time", async () => {
    const id = await addVenue("Hours check");

    for (const closesMinute of [600, 540]) {
      await expect(
        prisma.venueOpeningHours.update({
          where: { venueId_weekday: { venueId: id, weekday: 2 } },
          data: { opensMinute: 600, closesMinute },
        }),
      ).rejects.toSatisfy((error) => violatesCheck(error, "venue_opening_hours_valid"));
    }
    // Only one of the two times is refused too.
    await expect(
      prisma.venueOpeningHours.update({
        where: { venueId_weekday: { venueId: id, weekday: 2 } },
        data: { closesMinute: null },
      }),
    ).rejects.toSatisfy((error) => violatesCheck(error, "venue_opening_hours_valid"));
  });

  it("SCRUM-34 [AC6] TC-34-07: an edit shows at once in the detail view and the request form's venue list", async () => {
    const id = await addVenue("Edited");

    const result = await updateVenue({
      ...venueInput("Edited"),
      venueId: id,
      capacity: 120,
      facilities: "projector, sound system",
    });
    expect(result).toEqual({ ok: true, data: { id, flagged: 0 } });

    expect((await getVenueDetail(id))?.capacity).toBe(120);
    const offered = (await getRequestableVenues()).find((v) => v.id === id);
    expect(offered).toMatchObject({ capacity: 120, facilities: ["projector", "sound-system"] });
    expect(await prisma.auditLog.count({ where: { entityId: id, action: "UPDATED" } })).toBe(1);
  });

  it("SCRUM-34 [AC7] TC-34-08: a request is accepted exactly at opening and closing, and refused outside them, writing nothing", async () => {
    const id = await addVenue("AC7 submit");
    asCoordinator();

    const within = await event(`${TUESDAY}T10:00`, `${TUESDAY}T22:00`);
    expect(
      await submitBookingRequest({
        eventId: within,
        venueId: id,
        startAt: sg(`${TUESDAY}T10:00`).toISOString(),
        endAt: sg(`${TUESDAY}T22:00`).toISOString(),
        requestedAttendance: 40,
      }),
    ).toMatchObject({ ok: true, data: { created: true } });

    const tuesdayMessage =
      /is open 10:00–22:00 on Tuesdays\. The booking must start and end within those hours on the same day\.$/;
    for (const [start, end, message] of [
      [`${TUESDAY}T09:30`, `${TUESDAY}T12:00`, tuesdayMessage],
      [`${TUESDAY}T20:00`, `${TUESDAY}T22:30`, tuesdayMessage],
      [`${SUNDAY}T12:00`, `${SUNDAY}T14:00`, /is closed on Sundays, so it can't be booked then\.$/],
    ] as const) {
      const eventId = await event(start, end);
      const period = { startAt: sg(start).toISOString(), endAt: sg(end).toISOString() };

      const result = await submitBookingRequest({
        eventId,
        venueId: id,
        ...period,
        requestedAttendance: 40,
      });
      expect(result).toMatchObject({ ok: false, error: expect.stringMatching(message) });
      expect(await prisma.booking.count({ where: { eventId } })).toBe(0);

      // The form's live check says the same before submitting.
      expect(await checkVenueAvailability({ venueId: id, ...period })).toMatchObject({
        ok: true,
        data: { available: false, clashes: [expect.stringMatching(message)] },
      });
    }
  });

  it("SCRUM-34 [AC7] TC-34-08: every seeded Pending, Held or Approved booking is within its venue's opening hours", async () => {
    const seeded = await prisma.booking.findMany({
      where: {
        id: { in: ["bkg_confirmed", "bkg_auditorium_existing", "bkg_pending", "bkg_full_event", "bkg_last_seat_event"] },
      },
      select: {
        id: true,
        startAt: true,
        endAt: true,
        venue: { select: { name: true, openingHours: true } },
      },
    });

    expect(seeded).toHaveLength(5);
    for (const booking of seeded) {
      expect(openingHoursRefusal(booking, booking.venue), booking.id).toBeNull();
    }
  });

  it("SCRUM-34 [AC7] TC-34-08: a venue with no hours recorded is requested at any time", async () => {
    const legacy = await prisma.venue.create({
      data: { name: `SCRUM-34 Legacy ${Date.now()}`, location: "Annex", capacity: 50 },
      select: { id: true },
    });
    venueIds.push(legacy.id);
    asCoordinator();
    const eventId = await event(`${SUNDAY}T03:00`, `${SUNDAY}T05:00`);

    expect(
      await submitBookingRequest({
        eventId,
        venueId: legacy.id,
        startAt: sg(`${SUNDAY}T03:00`).toISOString(),
        endAt: sg(`${SUNDAY}T05:00`).toISOString(),
        requestedAttendance: 40,
      }),
    ).toMatchObject({ ok: true, data: { created: true } });
  });

  it("SCRUM-34 [AC7] TC-34-09: a request outside opening hours can't be held or approved, and stays Pending", async () => {
    const id = await addVenue("AC7 decide");
    const pending = await booking(id, `${SUNDAY}T12:00`, `${SUNDAY}T14:00`);
    asVenueStaff();
    const refusal = expect.stringMatching(
      /is closed on Sundays, so it can't be booked then\. This request is still pending\.$/,
    );

    expect(
      await holdBookingRequest({
        bookingId: pending.id,
        holdExpiresAt: sg(`${TUESDAY}T12:00`).toISOString(),
        holdNote: "Confirm the guest list.",
      }),
    ).toMatchObject({ ok: false, error: refusal });
    expect(
      await decideBookingRequest({ bookingId: pending.id, decision: "APPROVED" }),
    ).toMatchObject({ ok: false, error: refusal });
    expect(
      (await prisma.booking.findUniqueOrThrow({ where: { id: pending.id } })).status,
    ).toBe("PENDING");

    // The queue Venue Staff decide from says the same as Approve.
    const queued = (await getPendingBookingQueue()).find((b) => b.id === pending.id);
    expect(queued?.outsideHours).toMatch(/is closed on Sundays, so it can't be booked then\.$/);
  });

  it("SCRUM-34 [AC7] TC-34-09: a hold outside opening hours can't be approved or confirmed, and stays as it was; within them it can", async () => {
    const id = await addVenue("AC7 hold");
    const unapproved = await heldBooking(id, `${SUNDAY}T12:00`, `${SUNDAY}T14:00`);
    const approved = await heldBooking(id, `${SUNDAY}T15:00`, `${SUNDAY}T17:00`, true);
    const closedOnSundays = /is closed on Sundays, so it can't be booked then\./;

    asVenueStaff();
    expect(
      await decideBookingRequest({ bookingId: unapproved.id, decision: "APPROVED" }),
    ).toEqual({
      ok: false,
      error: expect.stringMatching(
        new RegExp(`${closedOnSundays.source} This hold is still awaiting approval\\.$`),
      ),
    });
    asCoordinator();
    expect(await confirmHold({ bookingId: approved.id })).toEqual({
      ok: false,
      error: expect.stringMatching(
        new RegExp(`${closedOnSundays.source} This hold is unchanged; you can still release it\\.$`),
      ),
    });
    const held = { status: true, holdApprovedAt: true } as const;
    expect(
      await prisma.booking.findUniqueOrThrow({ where: { id: unapproved.id }, select: held }),
    ).toEqual({ status: "HELD", holdApprovedAt: null });
    expect(
      (await prisma.booking.findUniqueOrThrow({ where: { id: approved.id }, select: held }))
        .status,
    ).toBe("HELD");
    expect(
      await prisma.auditLog.count({ where: { entityId: { in: [unapproved.id, approved.id] } } }),
    ).toBe(0);

    // Exactly opening to exactly closing is within the hours.
    const within = await heldBooking(id, `${TUESDAY}T10:00`, `${TUESDAY}T22:00`);
    asVenueStaff();
    expect(
      await decideBookingRequest({ bookingId: within.id, decision: "APPROVED" }),
    ).toMatchObject({ ok: true });
    asCoordinator();
    expect(await confirmHold({ bookingId: within.id })).toEqual({
      ok: true,
      data: { status: "APPROVED" },
    });
  });

  it("SCRUM-34 [AC10] TC-34-12: an edit that would stop a future booking fitting warns first, listing it, and nothing changes", async () => {
    const id = await addVenue("AC10");
    await booking(id, `${TUESDAY}T10:00`, `${TUESDAY}T14:00`, {
      status: "APPROVED",
      requestedAttendance: 70,
      requiredFacilities: ["projector"],
    });
    asVenueStaff();

    for (const change of [
      { capacity: 60 },
      { facilities: "" },
      { openingHours: hoursInput({ opensAt: "11:00", closesAt: "22:00" }) },
    ]) {
      const result = await updateVenue({ ...venueInput("AC10"), venueId: id, ...change });
      expect(result).toMatchObject({
        ok: false,
        fieldErrors: { affectedBookings: [expect.stringContaining("(Approved): ")] },
      });
    }

    const venue = await getVenueDetail(id);
    expect(venue).toMatchObject({ capacity: 80, facilities: ["projector"] });
    expect(venue!.openingHours[1]).toEqual({ weekday: 2, opensMinute: 600, closesMinute: 1320 });
    expect(await prisma.auditLog.count({ where: { entityId: id, action: "UPDATED" } })).toBe(0);
  });

  it("SCRUM-34 [AC10] TC-34-12: once Venue Staff confirm, the edit is saved and the booking flagged for its Coordinator, still Approved", async () => {
    const id = await addVenue("AC10 confirm");
    const affected = await booking(id, `${TUESDAY}T10:00`, `${TUESDAY}T14:00`, {
      status: "APPROVED",
      requestedAttendance: 70,
    });
    asVenueStaff();
    const edit = { ...venueInput("AC10 confirm"), venueId: id, capacity: 60 };

    const warned = await updateVenue(edit);
    expect(warned).toMatchObject({
      ok: false,
      fieldErrors: { affectedBookingIds: [affected.id] },
    });

    expect(await updateVenue({ ...edit, confirmedBookingIds: [affected.id] })).toEqual({
      ok: true,
      data: { id, flagged: 1 },
    });
    expect((await getVenueDetail(id))?.capacity).toBe(60);
    expect(
      await prisma.booking.findUniqueOrThrow({
        where: { id: affected.id },
        select: { status: true, needsReconsideration: true, reconsiderationReason: true },
      }),
    ).toEqual({
      status: "APPROVED",
      needsReconsideration: true,
      reconsiderationReason: expect.stringMatching(/changed: Capacity 60 < attendance 70$/),
    });
  });

  it("SCRUM-34 [AC10] TC-34-13: past and Cancelled bookings don't stop an edit, and attendance equal to capacity fits", async () => {
    const id = await addVenue("AC10 fits");
    await booking(id, "2026-01-06T10:00", "2026-01-06T14:00", {
      status: "APPROVED",
      requestedAttendance: 70,
    });
    await booking(id, `${TUESDAY}T10:00`, `${TUESDAY}T14:00`, {
      status: "CANCELLED",
      requestedAttendance: 70,
    });
    await booking(id, `${TUESDAY}T15:00`, `${TUESDAY}T18:00`, {
      status: "PENDING",
      requestedAttendance: 50,
    });
    asVenueStaff();

    expect(
      await updateVenue({ ...venueInput("AC10 fits"), venueId: id, capacity: 50 }),
    ).toMatchObject({ ok: true });
    expect((await getVenueDetail(id))?.capacity).toBe(50);
  });

  it("SCRUM-34 [AC12] TC-34-15: new hours judge the booking period, not its setup", async () => {
    const id = await addVenue("AC12", { setupMinutes: 30 });
    await booking(id, `${TUESDAY}T10:00`, `${TUESDAY}T14:00`, { status: "APPROVED" });
    asVenueStaff();

    expect(
      await updateVenue({
        ...venueInput("AC12", { setupMinutes: 30 }),
        venueId: id,
        openingHours: hoursInput({ opensAt: "10:00", closesAt: "18:00" }),
      }),
    ).toMatchObject({ ok: true });
    expect(
      await updateVenue({
        ...venueInput("AC12", { setupMinutes: 30 }),
        venueId: id,
        openingHours: hoursInput({ opensAt: "10:01", closesAt: "18:00" }),
      }),
    ).toMatchObject({
      ok: false,
      fieldErrors: {
        affectedBookings: [expect.stringContaining("Outside opening hours (Tuesday 10:01–18:00)")],
      },
    });
  });

  it("SCRUM-34 [AC8] TC-34-10: a retired venue leaves the request form and new requests, but its detail and past bookings stay readable", async () => {
    const id = await addVenue("Retired");
    const past = await booking(id, "2026-01-06T10:00", "2026-01-06T14:00", { status: "APPROVED" });
    asVenueStaff();

    expect(await retireVenue({ venueId: id })).toEqual({ ok: true, data: { id, flagged: 0 } });
    expect(await retireVenue({ venueId: id })).toEqual({
      ok: false,
      error: "This venue is already retired.",
    });

    expect((await getRequestableVenues()).some((v) => v.id === id)).toBe(false);
    // It leaves the catalogue; Venue Staff still list it, marked retired.
    expect(
      (await getVenueCatalogue({ includeRetired: false })).some((v) => v.id === id),
    ).toBe(false);
    expect(
      (await getVenueCatalogue({ includeRetired: true })).find((v) => v.id === id),
    ).toMatchObject({ isActive: false });
    expect((await getVenueDetail(id))?.isActive).toBe(false);
    expect(
      await prisma.booking.findUniqueOrThrow({
        where: { id: past.id },
        select: { venue: { select: { id: true } } },
      }),
    ).toEqual({ venue: { id } });

    asCoordinator();
    const eventId = await event(`${TUESDAY}T10:00`, `${TUESDAY}T12:00`);
    expect(
      await submitBookingRequest({
        eventId,
        venueId: id,
        startAt: sg(`${TUESDAY}T10:00`).toISOString(),
        endAt: sg(`${TUESDAY}T12:00`).toISOString(),
        requestedAttendance: 40,
      }),
    ).toEqual({ ok: false, error: "Venue not found." });
    expect(await prisma.booking.count({ where: { eventId } })).toBe(0);
  });

  it("SCRUM-34 [AC11] TC-34-14: a venue with a future booking is retired only once Venue Staff confirm; the booking is flagged, not cancelled", async () => {
    const id = await addVenue("AC11");
    const future = await booking(id, `${TUESDAY}T10:00`, `${TUESDAY}T14:00`);
    asVenueStaff();

    expect(await retireVenue({ venueId: id })).toMatchObject({
      ok: false,
      fieldErrors: {
        affectedBookings: [expect.stringContaining("(Pending)")],
        affectedBookingIds: [future.id],
      },
    });
    expect((await getVenueDetail(id))?.isActive).toBe(true);
    expect(
      (await prisma.booking.findUniqueOrThrow({ where: { id: future.id } })).needsReconsideration,
    ).toBe(false);

    expect(await retireVenue({ venueId: id, confirmedBookingIds: [future.id] })).toEqual({
      ok: true,
      data: { id, flagged: 1 },
    });
    expect((await getVenueDetail(id))?.isActive).toBe(false);
    expect(
      await prisma.booking.findUniqueOrThrow({
        where: { id: future.id },
        select: { status: true, needsReconsideration: true, reconsiderationReason: true },
      }),
    ).toEqual({
      status: "PENDING",
      needsReconsideration: true,
      reconsiderationReason: expect.stringMatching(/has been retired\.$/),
    });
  });

  it("SCRUM-34 [AC8, AC11] TC-34-16: two retirements at the same moment: one succeeds, the other finds it retired", async () => {
    const id = await addVenue("Race");
    asVenueStaff();

    const results = await Promise.all([retireVenue({ venueId: id }), retireVenue({ venueId: id })]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([
      { ok: false, error: "This venue is already retired." },
    ]);
    expect(await prisma.auditLog.count({ where: { entityId: id, action: "RETIRED" } })).toBe(1);
  });
});

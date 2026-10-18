import { describe, it, expect, vi } from "vitest";
import type { Prisma } from "@prisma/client";

import {
  bookingStillStandsRefusal,
  flagArrangements,
  flaggableArrangements,
  impactfulChanges,
  reservationStillStandsRefusal,
  type FlaggedBooking,
  type FlaggedReservation,
} from "@/lib/reconsideration";

// SCRUM-26 — raising Needs Reconsideration flags and judging Still stands.
// Test cases: docs/testing/SCRUM-26.md. Each function takes the database
// client as an argument, so each test hands it a client with mocked reads.

const START = new Date("2032-05-01T02:00:00Z"); // 10:00 am SGT
const END = new Date("2032-05-01T04:00:00Z"); // 12:00 pm SGT
const event = { startAt: START, endAt: END, expectedAttendance: 40 };

describe("impactfulChanges — SCRUM-26 AC1", () => {
  it("SCRUM-26 [AC1] TC-26-01: a changed date, time, attendance, venue or equipment requirement is impactful", () => {
    expect(
      impactfulChanges(
        {
          startAt: START,
          endAt: END,
          expectedAttendance: 40,
          venueRequirements: "Hall",
          requiredFacilities: ["stage"],
          equipmentRequirements: "Projector",
          equipmentTypes: ["Projector"],
        },
        {
          startAt: new Date("2032-05-02T02:00:00Z"),
          endAt: new Date("2032-05-02T04:00:00Z"),
          expectedAttendance: 60,
          venueRequirements: "Any room",
          requiredFacilities: ["stage", "projector"],
          equipmentRequirements: "Two projectors",
          equipmentTypes: ["Projector", "Laptop"],
        },
      ),
    ).toEqual([
      "startAt",
      "endAt",
      "expectedAttendance",
      "venueRequirements",
      "requiredFacilities",
      "equipmentRequirements",
      "equipmentTypes",
    ]);
  });

  it("SCRUM-26 [AC1] TC-26-01: a value set to what it already was, or a field the edit doesn't set, is no change", () => {
    expect(
      impactfulChanges(
        {
          startAt: START,
          expectedAttendance: 40,
          requiredFacilities: ["stage", "projector"],
          venueRequirements: null,
        },
        {
          startAt: new Date(START.getTime()),
          expectedAttendance: 40,
          requiredFacilities: ["projector", "stage"],
          venueRequirements: undefined,
        },
      ),
    ).toEqual([]);
  });
});

describe("flaggableArrangements — SCRUM-26 AC1", () => {
  it("SCRUM-26 [AC1] TC-26-02: lists the event's Pending, Held and Approved bookings and Confirmed reservations", async () => {
    const bookings = vi.fn().mockResolvedValue([
      { id: "bkg_1", status: "APPROVED", venue: { name: "Exhibition Hall" } },
      { id: "bkg_2", status: "HELD", venue: { name: "Seminar Room 2.1" } },
      { id: "bkg_3", status: "PENDING", venue: { name: "Boardroom" } },
    ]);
    const reservations = vi.fn().mockResolvedValue([
      { id: "res_1", quantity: 2, equipment: { type: "Projector" } },
    ]);
    const db = {
      booking: { findMany: bookings },
      reservation: { findMany: reservations },
    } as unknown as Prisma.TransactionClient;

    expect(await flaggableArrangements(db, "evt_1")).toEqual([
      { kind: "booking", id: "bkg_1", label: "Exhibition Hall (Approved)" },
      { kind: "booking", id: "bkg_2", label: "Seminar Room 2.1 (Held)" },
      { kind: "booking", id: "bkg_3", label: "Boardroom (Pending)" },
      { kind: "reservation", id: "res_1", label: "Projector × 2" },
    ]);
    expect(bookings.mock.calls[0][0].where).toEqual({
      eventId: "evt_1",
      OR: [
        { status: { in: ["PENDING", "APPROVED"] } },
        { status: "HELD", holdExpiresAt: { gt: expect.any(Date) } },
      ],
    });
    expect(reservations.mock.calls[0][0].where).toEqual({
      eventId: "evt_1",
      status: "CONFIRMED",
    });
  });

  it("SCRUM-26 [AC1] TC-26-02: nothing booked or reserved means nothing to warn about", async () => {
    const empty = vi.fn().mockResolvedValue([]);
    const db = {
      booking: { findMany: empty },
      reservation: { findMany: empty },
    } as unknown as Prisma.TransactionClient;

    expect(await flaggableArrangements(db, "evt_1")).toEqual([]);
  });
});

describe("flagArrangements — SCRUM-26 AC2, AC3, AC6", () => {
  // The rows each update returns are what SCRUM-124 AC8 tells people about
  // ("flag notices — SCRUM-124 AC8" below); here only the flag is checked.
  function client() {
    const booking = {
      updateManyAndReturn: vi.fn().mockResolvedValue([
        { id: "bkg_1", eventId: "evt_1", status: "APPROVED", venue: { name: "Hall A" } },
        { id: "bkg_2", eventId: "evt_1", status: "PENDING", venue: { name: "Hall B" } },
      ]),
    };
    const reservation = {
      updateManyAndReturn: vi.fn().mockResolvedValue([
        { id: "rsv_1", eventId: "evt_1", quantity: 2, equipment: { type: "Projector" } },
      ]),
    };
    const event = {
      findMany: vi.fn().mockResolvedValue([
        { id: "evt_1", name: "Expo", coordinatorId: "usr_coord" },
      ]),
    };
    const user = { findMany: vi.fn().mockResolvedValue([]) };
    const notification = { create: vi.fn(), createMany: vi.fn() };
    return {
      tx: { booking, reservation, event, user, notification } as unknown as Prisma.TransactionClient,
      booking,
      reservation,
    };
  }
  const bookingSelect = {
    id: true,
    eventId: true,
    status: true,
    venue: { select: { name: true } },
  };
  const reservationSelect = {
    id: true,
    eventId: true,
    quantity: true,
    equipment: { select: { type: true } },
  };
  const now = new Date("2032-04-01T00:00:00Z");
  const flag = {
    needsReconsideration: true,
    reconsiderationFlaggedAt: now,
    reconsiderationReason: "The event moved to 2 May.",
    reconsiderationResolvedAt: null,
    reconsiderationResolvedById: null,
  };

  it("SCRUM-26 [AC2, AC3, AC6] TC-26-03: flags every live arrangement of an event with its reason, and changes no status or time", async () => {
    const { tx, booking, reservation } = client();

    expect(
      await flagArrangements(tx, { eventId: "evt_1" }, "The event moved to 2 May.", now),
    ).toEqual({ bookings: 2, reservations: 1 });
    expect(booking.updateManyAndReturn).toHaveBeenCalledWith({
      where: {
        eventId: "evt_1",
        OR: [
          { status: { in: ["PENDING", "APPROVED"] } },
          { status: "HELD", holdExpiresAt: { gt: expect.any(Date) } },
        ],
        needsReconsideration: false,
      },
      data: flag,
      select: bookingSelect,
    });
    expect(reservation.updateManyAndReturn).toHaveBeenCalledWith({
      where: { eventId: "evt_1", status: "CONFIRMED", needsReconsideration: false },
      data: flag,
      select: reservationSelect,
    });
    // AC2, AC6: the status and the period are never part of the write.
    for (const call of [booking.updateManyAndReturn, reservation.updateManyAndReturn]) {
      const { data } = call.mock.calls[0][0];
      expect(data).not.toHaveProperty("status");
      expect(data).not.toHaveProperty("startAt");
      expect(data).not.toHaveProperty("endAt");
    }
  });

  it("SCRUM-26 [AC3] TC-26-03: flags only the named arrangements, such as the ones a safety check picked", async () => {
    const { tx, booking, reservation } = client();

    await flagArrangements(
      tx,
      { bookingIds: ["bkg_1"], reservationIds: [] },
      "Safety Officer: widen the exits.",
      now,
    );

    expect(booking.updateManyAndReturn.mock.calls[0][0].where).toEqual({
      id: { in: ["bkg_1"] },
      OR: [
        { status: { in: ["PENDING", "APPROVED"] } },
        { status: "HELD", holdExpiresAt: { gt: expect.any(Date) } },
      ],
      needsReconsideration: false,
    });
    expect(reservation.updateManyAndReturn.mock.calls[0][0].where).toEqual({
      id: { in: [] },
      status: "CONFIRMED",
      needsReconsideration: false,
    });
  });

  it("SCRUM-26 [AC3] TC-26-03: uses the current time when none is given", async () => {
    const { tx, booking } = client();

    await flagArrangements(tx, { eventId: "evt_1" }, "Moved.");

    expect(
      booking.updateManyAndReturn.mock.calls[0][0].data.reconsiderationFlaggedAt,
    ).toBeInstanceOf(Date);
  });
});

// SCRUM-124 AC8 — who is told when flagArrangements flags something.
// Test cases: docs/testing/SCRUM-124.md.
describe("flag notices — SCRUM-124 AC8", () => {
  const REASON = "The event's expected attendance changed.";
  const hallA = { id: "bkg_1", eventId: "evt_1", status: "APPROVED", venue: { name: "Hall A" } };
  const hallB = { id: "bkg_2", eventId: "evt_1", status: "PENDING", venue: { name: "Hall B" } };
  const projectors = {
    id: "rsv_1",
    eventId: "evt_1",
    quantity: 2,
    equipment: { type: "Projector" },
  };
  const expo = { id: "evt_1", name: "Expo", coordinatorId: "usr_coord" };

  function client(
    bookings: unknown[],
    reservations: unknown[],
    events: unknown[] = [expo],
  ) {
    const tx = {
      booking: { updateManyAndReturn: vi.fn().mockResolvedValue(bookings) },
      reservation: { updateManyAndReturn: vi.fn().mockResolvedValue(reservations) },
      event: { findMany: vi.fn().mockResolvedValue(events) },
      user: {
        findMany: vi.fn(({ where }: { where: { OR: [{ role: string }] } }) =>
          Promise.resolve(
            where.OR[0].role === "VENUE_STAFF" ? [{ id: "usr_vs" }] : [{ id: "usr_ts" }],
          ),
        ),
      },
      notification: { create: vi.fn(), createMany: vi.fn() },
    };
    return { tx, client: tx as unknown as Prisma.TransactionClient };
  }

  it("SCRUM-124 [AC8, AC12] TC-124-08: the event's Coordinator is told every flagged arrangement and the reason", async () => {
    const { tx, client: c } = client([hallA, hallB], [projectors]);

    await flagArrangements(c, { eventId: "evt_1" }, REASON);

    expect(tx.notification.create).toHaveBeenCalledTimes(1);
    expect(tx.notification.create).toHaveBeenCalledWith({
      data: {
        userId: "usr_coord",
        eventId: "evt_1",
        type: "ARRANGEMENT_FLAGGED",
        title: "Arrangements flagged for reconsideration",
        message: `Hall A (Approved), Hall B (Pending) and Projector × 2 for "Expo" need reconsideration. ${REASON}`,
      },
    });
  });

  it("SCRUM-124 [AC8, AC12, AC13] TC-124-08: every Venue Staff member is told the event's bookings and every Technical Support member its reservations, each linking to their own page", async () => {
    const { tx, client: c } = client([hallA, hallB], [projectors]);

    await flagArrangements(c, { eventId: "evt_1" }, REASON);

    expect(tx.notification.createMany).toHaveBeenCalledTimes(2);
    expect(tx.notification.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: "usr_vs",
          eventId: "evt_1",
          type: "ARRANGEMENT_FLAGGED",
          title: "Bookings flagged for reconsideration",
          message: `Hall A (Approved) and Hall B (Pending) for "Expo" need reconsideration, and wait for the event's Coordinator to decide. ${REASON}`,
          link: "/bookings",
        },
      ],
    });
    expect(tx.notification.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: "usr_ts",
          eventId: "evt_1",
          type: "ARRANGEMENT_FLAGGED",
          title: "Reservations flagged for reconsideration",
          message: `Projector × 2 for "Expo" needs reconsideration, and waits for the event's Coordinator to decide. ${REASON}`,
          link: "/equipment",
        },
      ],
    });
  });

  it("SCRUM-124 [AC8] TC-124-08: a Coordinator who raised the flag isn't told what they just did; staff still are", async () => {
    const { tx, client: c } = client([hallA], []);

    await flagArrangements(c, { eventId: "evt_1" }, REASON, new Date(), "usr_coord");

    expect(tx.notification.create).not.toHaveBeenCalled();
    expect(tx.notification.createMany).toHaveBeenCalledTimes(1);
    expect(tx.notification.createMany.mock.calls[0][0].data[0]).toMatchObject({
      userId: "usr_vs",
      message: `Hall A (Approved) for "Expo" needs reconsideration, and waits for the event's Coordinator to decide. ${REASON}`,
    });
  });

  it("SCRUM-124 [AC8] TC-124-08: someone else raising the flag, such as Venue Staff or a Safety Officer, tells the Coordinator", async () => {
    const { tx, client: c } = client([hallA], []);

    await flagArrangements(c, { bookingIds: ["bkg_1"], reservationIds: [] }, REASON, new Date(), "usr_staff");

    expect(tx.notification.create.mock.calls[0][0].data.userId).toBe("usr_coord");
  });

  it("SCRUM-124 [AC8] TC-124-08: an event with no Coordinator tells only the staff", async () => {
    const { tx, client: c } = client([], [projectors], [{ ...expo, coordinatorId: null }]);

    await flagArrangements(c, { eventId: "evt_1" }, REASON);

    expect(tx.notification.create).not.toHaveBeenCalled();
    expect(tx.user.findMany).toHaveBeenCalledWith({
      where: { OR: [{ role: "TECH_SUPPORT" }, { additionalRoles: { has: "TECH_SUPPORT" } }] },
      select: { id: true },
    });
    expect(tx.user.findMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { OR: [{ role: "VENUE_STAFF" }, { additionalRoles: { has: "VENUE_STAFF" } }] } }),
    );
  });

  it("SCRUM-124 [AC8, AC14] TC-124-08: flagging what is already flagged tells nobody again", async () => {
    const { tx, client: c } = client([], []);

    expect(await flagArrangements(c, { eventId: "evt_1" }, REASON)).toEqual({
      bookings: 0,
      reservations: 0,
    });
    expect(tx.event.findMany).not.toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
    expect(tx.notification.createMany).not.toHaveBeenCalled();
  });

  it("SCRUM-124 [AC8] TC-124-08: arrangements of two events tell each event's Coordinator only about their own", async () => {
    const other = { id: "bkg_3", eventId: "evt_2", status: "HELD", venue: { name: "Hall A" } };
    const { tx, client: c } = client([hallA, other], [], [
      expo,
      { id: "evt_2", name: "Fair", coordinatorId: "usr_coord2" },
    ]);

    await flagArrangements(c, { bookingIds: ["bkg_1", "bkg_3"], reservationIds: [] }, REASON);

    expect(tx.event.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["evt_1", "evt_2"] } },
      select: { id: true, name: true, coordinatorId: true },
    });
    expect(tx.notification.create.mock.calls.map(([{ data }]) => [data.userId, data.message])).toEqual([
      ["usr_coord", `Hall A (Approved) for "Expo" needs reconsideration. ${REASON}`],
      ["usr_coord2", `Hall A (Held) for "Fair" needs reconsideration. ${REASON}`],
    ]);
  });
});

describe("bookingStillStandsRefusal — SCRUM-26 AC8", () => {
  const booking: FlaggedBooking = {
    id: "bkg_1",
    status: "APPROVED",
    startAt: START,
    endAt: END,
    setupMinutes: 30,
    turnaroundMinutes: 45,
    requestedAttendance: 40,
    venueId: "ven_hall",
    venue: {
      name: "Exhibition Hall",
      isActive: true,
      capacity: 200,
      setupMinutes: 60,
      turnaroundMinutes: 60,
    },
  };

  function clientWith(bookings: unknown[] = [], unavailability: unknown[] = []) {
    const findBookings = vi.fn().mockResolvedValue(bookings);
    const db = {
      booking: { findMany: findBookings },
      venueUnavailability: { findMany: vi.fn().mockResolvedValue(unavailability) },
    } as unknown as Prisma.TransactionClient;
    return { db, findBookings };
  }

  it("SCRUM-26 [AC8] TC-26-06: a booking that still fits the event stands, ignoring its own row", async () => {
    const { db } = clientWith([
      { id: "bkg_1", startAt: START, endAt: END, status: "APPROVED", setupMinutes: 30, turnaroundMinutes: 45 },
    ]);

    expect(await bookingStillStandsRefusal(db, booking, event)).toBeNull();
  });

  it("SCRUM-26 [AC8] TC-26-07: refused when it no longer covers the event's whole period", async () => {
    const { db } = clientWith();
    const moved = {
      ...event,
      startAt: new Date("2032-05-02T02:00:00Z"),
      endAt: new Date("2032-05-02T04:00:00Z"),
    };

    expect(await bookingStillStandsRefusal(db, booking, moved)).toBe(
      "It no longer covers the event's whole period, 2 May 2032, 10:00 am SGT to 2 May 2032, 12:00 pm SGT.",
    );
    expect(
      await bookingStillStandsRefusal(db, booking, { ...event, startAt: null, endAt: null }),
    ).toBe("It no longer covers the event's whole period.");
  });

  it("SCRUM-26 [AC8] TC-26-08: refused when the venue has been retired", async () => {
    const { db } = clientWith();

    expect(
      await bookingStillStandsRefusal(
        db,
        { ...booking, venue: { ...booking.venue, isActive: false } },
        event,
      ),
    ).toBe("Exhibition Hall has been retired.");
  });

  it("SCRUM-26 [AC8] TC-26-08: refused when its attendance is more than the event now expects", async () => {
    const { db } = clientWith();

    expect(
      await bookingStillStandsRefusal(db, booking, { ...event, expectedAttendance: 30 }),
    ).toBe("It is for 40 attendees, more than the event's expected 30.");
  });

  it("SCRUM-26 [AC8] TC-26-08: refused when its attendance is more than the venue's capacity; without its own attendance the event's counts", async () => {
    const { db } = clientWith();
    const small = { ...booking.venue, capacity: 35 };

    expect(
      await bookingStillStandsRefusal(db, { ...booking, venue: small }, event),
    ).toBe("It is for 40 attendees, more than Exhibition Hall's capacity of 35.");
    expect(
      await bookingStillStandsRefusal(
        db,
        { ...booking, requestedAttendance: null, venue: small },
        event,
      ),
    ).toBe("It is for 40 attendees, more than Exhibition Hall's capacity of 35.");
  });

  it("SCRUM-26 [AC8] TC-26-08: with no attendance recorded anywhere, attendance doesn't refuse it", async () => {
    const { db } = clientWith();

    expect(
      await bookingStillStandsRefusal(
        db,
        { ...booking, requestedAttendance: null },
        { ...event, expectedAttendance: null },
      ),
    ).toBeNull();
  });

  it("SCRUM-26 [AC8] TC-26-08: refused when its occupied period overlaps another Approved or Held booking or recorded unavailability", async () => {
    // Starts 12:30 pm SGT: inside this booking's 45-minute turnaround.
    const { db, findBookings } = clientWith(
      [
        {
          id: "bkg_other",
          startAt: new Date("2032-05-01T04:30:00Z"),
          endAt: new Date("2032-05-01T06:00:00Z"),
          status: "APPROVED",
          setupMinutes: 0,
          turnaroundMinutes: 0,
        },
      ],
      [
        {
          id: "una_1",
          startAt: new Date("2032-05-01T01:00:00Z"),
          endAt: new Date("2032-05-01T01:45:00Z"),
          reason: "MAINTENANCE",
        },
      ],
    );

    expect(await bookingStillStandsRefusal(db, booking, event)).toBe(
      "Exhibition Hall is unavailable (maintenance) from 1 May 2032, 9:00 am SGT to 1 May 2032, 9:45 am SGT; already booked from 1 May 2032, 12:30 pm SGT to 1 May 2032, 2:00 pm SGT.",
    );
    // The occupied period uses the booking's own minutes: 9:30 am to 12:45 pm.
    expect(findBookings.mock.calls[0][0].where.venueId).toBe("ven_hall");
  });

  it("SCRUM-26 [AC8] TC-26-08: a Pending booking is judged with the venue's current minutes, which it would take when approved", async () => {
    // Ends 9:15 am SGT: clear of 30 minutes' setup, inside the venue's 60.
    const { db } = clientWith([
      {
        id: "bkg_before",
        startAt: new Date("2032-05-01T00:00:00Z"),
        endAt: new Date("2032-05-01T01:15:00Z"),
        status: "APPROVED",
        setupMinutes: 0,
        turnaroundMinutes: 0,
      },
    ]);

    expect(await bookingStillStandsRefusal(db, booking, event)).toBeNull();
    expect(
      await bookingStillStandsRefusal(db, { ...booking, status: "PENDING" }, event),
    ).toBe(
      "Exhibition Hall is already booked from 1 May 2032, 8:00 am SGT to 1 May 2032, 9:15 am SGT.",
    );
  });
});

describe("reservationStillStandsRefusal — SCRUM-26 AC8", () => {
  const reservation: FlaggedReservation = {
    id: "res_1",
    eventId: "evt_1",
    equipmentId: "eqp_projector",
    quantity: 2,
    startAt: START,
    endAt: END,
    equipment: { type: "Projector" },
  };

  function clientWith(lines: number[], reservations: unknown[]) {
    const findLines = vi.fn().mockResolvedValue(lines.map((quantity) => ({ quantity })));
    const findReservations = vi.fn().mockResolvedValue(reservations);
    const db = {
      equipmentRequestLine: { findMany: findLines },
      reservation: { findMany: findReservations },
    } as unknown as Prisma.TransactionClient;
    return { db, findLines, findReservations };
  }

  it("SCRUM-26 [AC8] TC-26-06: a reservation that still covers what the event's live requests need stands; lines removed from a request (SCRUM-142) don't count", async () => {
    const { db, findLines, findReservations } = clientWith(
      [1, 1],
      [{ quantity: 2, startAt: START, endAt: END }],
    );

    expect(await reservationStillStandsRefusal(db, reservation, event)).toBeNull();
    expect(findLines.mock.calls[0][0].where).toEqual({
      equipmentId: "eqp_projector",
      removedAt: null,
      request: {
        eventId: "evt_1",
        status: { in: ["PENDING_REVIEW", "IN_REVIEW", "APPROVED"] },
      },
    });
    expect(findReservations.mock.calls[0][0].where).toEqual({
      eventId: "evt_1",
      equipmentId: "eqp_projector",
      status: "CONFIRMED",
    });
  });

  it("SCRUM-26 [AC8] TC-26-07: refused when it no longer covers the event's whole period", async () => {
    const { db } = clientWith([], []);

    expect(
      await reservationStillStandsRefusal(
        db,
        { ...reservation, endAt: new Date("2032-05-01T03:00:00Z") },
        event,
      ),
    ).toBe(
      "It no longer covers the event's whole period, 1 May 2032, 10:00 am SGT to 1 May 2032, 12:00 pm SGT.",
    );
  });

  it("SCRUM-26 [AC8] TC-26-08: refused when the reserved quantity is no longer enough; a reservation for another time doesn't count", async () => {
    const { db } = clientWith(
      [3],
      [
        { quantity: 2, startAt: START, endAt: END },
        { quantity: 5, startAt: new Date("2032-05-02T02:00:00Z"), endAt: new Date("2032-05-02T04:00:00Z") },
      ],
    );

    expect(await reservationStillStandsRefusal(db, reservation, event)).toBe(
      "Only 2 Projector reserved for the event's period; its requests need 3.",
    );
  });
});

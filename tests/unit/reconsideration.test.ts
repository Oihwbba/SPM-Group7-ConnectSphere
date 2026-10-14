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
      status: { in: ["PENDING", "HELD", "APPROVED"] },
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
  function client() {
    const booking = { updateMany: vi.fn().mockResolvedValue({ count: 2 }) };
    const reservation = { updateMany: vi.fn().mockResolvedValue({ count: 1 }) };
    return {
      tx: { booking, reservation } as unknown as Prisma.TransactionClient,
      booking,
      reservation,
    };
  }
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
    expect(booking.updateMany).toHaveBeenCalledWith({
      where: {
        eventId: "evt_1",
        status: { in: ["PENDING", "HELD", "APPROVED"] },
        needsReconsideration: false,
      },
      data: flag,
    });
    expect(reservation.updateMany).toHaveBeenCalledWith({
      where: { eventId: "evt_1", status: "CONFIRMED", needsReconsideration: false },
      data: flag,
    });
    // AC2, AC6: the status and the period are never part of the write.
    for (const call of [booking.updateMany, reservation.updateMany]) {
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

    expect(booking.updateMany.mock.calls[0][0].where).toEqual({
      id: { in: ["bkg_1"] },
      status: { in: ["PENDING", "HELD", "APPROVED"] },
      needsReconsideration: false,
    });
    expect(reservation.updateMany.mock.calls[0][0].where).toEqual({
      id: { in: [] },
      status: "CONFIRMED",
      needsReconsideration: false,
    });
  });

  it("SCRUM-26 [AC3] TC-26-03: uses the current time when none is given", async () => {
    const { tx, booking } = client();

    await flagArrangements(tx, { eventId: "evt_1" }, "Moved.");

    expect(booking.updateMany.mock.calls[0][0].data.reconsiderationFlaggedAt).toBeInstanceOf(Date);
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

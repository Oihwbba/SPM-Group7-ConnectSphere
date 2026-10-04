import { describe, it, expect, vi } from "vitest";
import type { EventStatus, Prisma } from "@prisma/client";

import {
  getReadinessChecklist,
  withoutInternalReasons,
  type ReadinessChecklist,
} from "@/lib/event-readiness";

// SCRUM-110 — the readiness checklist. Test cases: docs/testing/SCRUM-110.md.
// The rule takes the database client as an argument, so each test hands it a
// client whose one read returns the event and its arrangements.

const START = new Date("2031-06-01T01:00:00Z"); // 09:00 Singapore
const END = new Date("2031-06-01T09:00:00Z"); // 17:00 Singapore

type Booking = {
  status: string;
  decisionReason: string | null;
  createdAt: Date;
  startAt: Date;
  endAt: Date;
};
type Line = { equipmentId: string; quantity: number };
type Request = { status: string; createdAt: Date; lines: Line[] };
type Reservation = {
  equipmentId: string;
  quantity: number;
  status: string;
  startAt: Date;
  endAt: Date;
};

interface Arrangements {
  status: EventStatus;
  startAt: Date | null;
  endAt: Date | null;
  bookings: Booking[];
  equipmentRequests: Request[];
  reservations: Reservation[];
}

const day = (n: number) => new Date(Date.UTC(2031, 0, n));
const booking = (
  status: string,
  n = 1,
  decisionReason: string | null = null,
): Booking => ({
  status,
  decisionReason,
  createdAt: day(n),
  startAt: START,
  endAt: END,
});
const line = (equipmentId: string, quantity: number): Line => ({
  equipmentId,
  quantity,
});
const request = (status: string, lines: Line[], n = 1): Request => ({
  status,
  lines,
  createdAt: day(n),
});
const reserved = (
  equipmentId: string,
  quantity: number,
  overrides: Partial<Reservation> = {},
): Reservation => ({
  equipmentId,
  quantity,
  status: "CONFIRMED",
  startAt: START,
  endAt: END,
  ...overrides,
});

const projectors = (n: number) => line("eqp_projector", n);
const mics = (n: number) => line("eqp_mic", n);

function planningEvent(overrides: Partial<Arrangements> = {}): Arrangements {
  return {
    status: "PLANNING",
    startAt: START,
    endAt: END,
    bookings: [booking("APPROVED")],
    equipmentRequests: [],
    reservations: [],
    ...overrides,
  };
}

function clientReturning(event: Arrangements | null) {
  const findUnique = vi.fn().mockResolvedValue(event);
  const db = { event: { findUnique } } as unknown as Prisma.TransactionClient;
  return { db, findUnique };
}

async function checklistOf(event: Arrangements | null) {
  const { db } = clientReturning(event);
  return getReadinessChecklist(db, "evt_test");
}

const venue = (c: ReadinessChecklist | null) =>
  c?.items.find((i) => i.name === "Venue booking");
const equipment = (c: ReadinessChecklist | null) =>
  c?.items.find((i) => i.name === "Equipment");

describe("getReadinessChecklist — SCRUM-110", () => {
  it("SCRUM-110 [AC1, AC3, AC5] TC-110-01: an approved venue booking and no equipment request is a complete checklist with only the venue, ready to confirm", async () => {
    const result = await checklistOf(planningEvent());

    expect(result).toEqual({
      ready: true,
      items: [
        {
          name: "Venue booking",
          complete: true,
          state: "Approved",
          reason: null,
        },
      ],
    });
  });

  it("SCRUM-110 [AC2] TC-110-02: with no venue booking at all, Venue booking is still listed, as not requested and incomplete", async () => {
    const result = await checklistOf(planningEvent({ bookings: [] }));

    expect(venue(result)).toMatchObject({
      complete: false,
      state: "Not requested",
    });
    expect(result?.ready).toBe(false);
  });

  it("SCRUM-110 [AC2] TC-110-03: a pending venue booking shows Pending and is incomplete", async () => {
    const result = await checklistOf(
      planningEvent({ bookings: [booking("PENDING")] }),
    );

    expect(venue(result)).toMatchObject({
      complete: false,
      state: "Pending",
      reason: null,
    });
    expect(result?.ready).toBe(false);
  });

  it("SCRUM-110 [AC2] TC-110-04: a rejected venue booking shows Rejected with its reason and is incomplete", async () => {
    const result = await checklistOf(
      planningEvent({
        bookings: [
          booking(
            "REJECTED",
            1,
            "Boardroom seats 14; the event expects 55 attendees.",
          ),
        ],
      }),
    );

    expect(venue(result)).toEqual({
      name: "Venue booking",
      complete: false,
      state: "Rejected",
      reason: "Boardroom seats 14; the event expects 55 attendees.",
    });
    expect(result?.ready).toBe(false);
  });

  it.each([
    {
      when: "a rejected then an approved booking",
      bookings: [booking("REJECTED", 1, "old"), booking("APPROVED", 2)],
      expected: { complete: true, state: "Approved", reason: null },
    },
    {
      when: "a rejected then a pending booking",
      bookings: [booking("REJECTED", 1, "old"), booking("PENDING", 2)],
      expected: { complete: false, state: "Pending", reason: null },
    },
    {
      when: "two rejections",
      bookings: [booking("REJECTED", 2, "new"), booking("REJECTED", 1, "old")],
      expected: { complete: false, state: "Rejected", reason: "new" },
    },
    {
      when: "only a cancelled booking",
      bookings: [booking("CANCELLED")],
      expected: { complete: false, state: "Not requested", reason: null },
    },
  ])(
    "SCRUM-110 [AC1, AC2] TC-110-05: with $when, the venue item reads as the most advanced booking",
    async ({ bookings, expected }) => {
      expect(
        venue(await checklistOf(planningEvent({ bookings }))),
      ).toMatchObject(expected);
    },
  );

  it.each([
    {
      when: "covers exactly the event's time",
      period: {},
      complete: true,
      state: "Approved",
    },
    {
      when: "starts after the event starts",
      period: { startAt: new Date("2031-06-01T02:00:00Z") },
      complete: false,
      state: "Approved for a different time",
    },
    {
      when: "ends before the event ends",
      period: { endAt: new Date("2031-06-01T04:00:00Z") },
      complete: false,
      state: "Approved for a different time",
    },
    {
      when: "is for another day, e.g. before the event moved",
      period: { startAt: day(5), endAt: day(6) },
      complete: false,
      state: "Approved for a different time",
    },
  ])(
    "SCRUM-110 [AC1, AC2] TC-110-14: an approved booking that $when counts only if it covers the whole event",
    async ({ period, complete, state }) => {
      const result = await checklistOf(
        planningEvent({ bookings: [{ ...booking("APPROVED"), ...period }] }),
      );

      expect(venue(result)).toMatchObject({ complete, state });
      expect(result?.ready).toBe(complete);
    },
  );

  it("SCRUM-110 [AC1, AC2] TC-110-14: a new pending booking for the right time outranks an approved one for the wrong time, and an event with no dates has no venue secured", async () => {
    const rebooked = await checklistOf(
      planningEvent({
        bookings: [
          { ...booking("APPROVED", 1), startAt: day(5), endAt: day(6) },
          booking("PENDING", 2),
        ],
      }),
    );
    const undated = await checklistOf(
      planningEvent({ startAt: null, endAt: null }),
    );

    expect(venue(rebooked)).toMatchObject({
      complete: false,
      state: "Pending",
    });
    expect(venue(undated)).toMatchObject({
      complete: false,
      state: "Approved for a different time",
    });
  });

  it("SCRUM-110 [AC3, AC5] TC-110-06: every requested line reserved in full for the event's period completes Equipment, even across several reservations", async () => {
    const result = await checklistOf(
      planningEvent({
        equipmentRequests: [request("APPROVED", [projectors(5), mics(2)])],
        reservations: [
          reserved("eqp_projector", 3),
          reserved("eqp_projector", 2),
          reserved("eqp_mic", 2),
        ],
      }),
    );

    expect(equipment(result)).toEqual({
      name: "Equipment",
      complete: true,
      state: "Reserved",
      reason: null,
    });
    expect(result?.ready).toBe(true);
  });

  it("SCRUM-110 [AC3] TC-110-07: a line reserved only in part leaves Equipment not fully reserved and incomplete", async () => {
    const result = await checklistOf(
      planningEvent({
        equipmentRequests: [request("PENDING_REVIEW", [projectors(5)])],
        reservations: [reserved("eqp_projector", 3)],
      }),
    );

    expect(equipment(result)).toMatchObject({
      complete: false,
      state: "Not fully reserved",
    });
    expect(result?.ready).toBe(false);
  });

  it.each([
    {
      when: "covers exactly the event's period",
      res: reserved("eqp_projector", 2),
      done: true,
    },
    {
      when: "covers only part of the event",
      res: reserved("eqp_projector", 2, {
        endAt: new Date("2031-06-01T04:00:00Z"),
      }),
      done: false,
    },
    {
      when: "starts after the event starts",
      res: reserved("eqp_projector", 2, {
        startAt: new Date("2031-06-01T02:00:00Z"),
      }),
      done: false,
    },
    {
      when: "is cancelled",
      res: reserved("eqp_projector", 2, { status: "CANCELLED" }),
      done: false,
    },
    {
      when: "is for a different item",
      res: reserved("eqp_mic", 2),
      done: false,
    },
  ])(
    "SCRUM-110 [AC3] TC-110-08: a reservation that $when counts only if it is a confirmed reservation of the requested item for the whole event",
    async ({ res, done }) => {
      const result = await checklistOf(
        planningEvent({
          equipmentRequests: [request("APPROVED", [projectors(2)])],
          reservations: [res],
        }),
      );

      expect(equipment(result)?.complete).toBe(done);
    },
  );

  it("SCRUM-110 [AC3] TC-110-08: an event with no dates cannot have its equipment reserved in full", async () => {
    const result = await checklistOf(
      planningEvent({
        startAt: null,
        endAt: null,
        equipmentRequests: [request("APPROVED", [projectors(2)])],
        reservations: [reserved("eqp_projector", 2)],
      }),
    );

    expect(equipment(result)?.complete).toBe(false);
  });

  it("SCRUM-110 [AC3] TC-110-09: a cancelled request adds no Equipment item and does not block confirmation", async () => {
    const result = await checklistOf(
      planningEvent({
        equipmentRequests: [request("CANCELLED", [projectors(2)])],
      }),
    );

    expect(equipment(result)).toBeUndefined();
    expect(result?.ready).toBe(true);
  });

  it("SCRUM-110 [AC4] TC-110-09: a request Technical Support rejected keeps Equipment incomplete until the Coordinator requests again", async () => {
    const result = await checklistOf(
      planningEvent({
        equipmentRequests: [request("REJECTED", [projectors(2)])],
      }),
    );

    expect(equipment(result)).toEqual({
      name: "Equipment",
      complete: false,
      state: "Rejected",
      reason: null,
    });
    expect(result?.ready).toBe(false);
  });

  it("SCRUM-110 [AC3] TC-110-09: a new request after a rejection replaces it, and live requests for the same item add up", async () => {
    // The rejected request's projectors are not wanted: the laptop alone completes it.
    const replaced = await checklistOf(
      planningEvent({
        equipmentRequests: [
          request("REJECTED", [projectors(2)], 1),
          request("PENDING_REVIEW", [line("eqp_laptop", 1)], 2),
        ],
        reservations: [reserved("eqp_laptop", 1)],
      }),
    );
    const combined = (n: number) =>
      checklistOf(
        planningEvent({
          equipmentRequests: [
            request("APPROVED", [projectors(2)], 1),
            request("IN_REVIEW", [projectors(3)], 2),
          ],
          reservations: [reserved("eqp_projector", n)],
        }),
      );

    expect(equipment(replaced)?.complete).toBe(true);
    expect(equipment(await combined(3))?.complete).toBe(false);
    expect(equipment(await combined(5))?.complete).toBe(true);
  });

  it.each([
    "DRAFT",
    "SUBMITTED",
    "UNDER_REVIEW",
    "APPROVED",
    "CONFIRMED",
    "COMPLETED",
    "CANCELLED",
    "REJECTED",
  ] as EventStatus[])(
    "SCRUM-110 [AC5] TC-110-10: a %s event is never ready to confirm, even with every item complete",
    async (status) => {
      const result = await checklistOf(planningEvent({ status }));

      expect(venue(result)?.complete).toBe(true);
      expect(result?.ready).toBe(false);
    },
  );

  it("SCRUM-110 TC-110-13: an id that matches no event has no checklist", async () => {
    expect(await checklistOf(null)).toBeNull();
  });

  it("SCRUM-110 [AC5]: reads the one event it is asked about, once, through the client it is given", async () => {
    const { db, findUnique } = clientReturning(planningEvent());

    await getReadinessChecklist(db, "evt_test");

    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(findUnique.mock.calls[0][0].where).toEqual({ id: "evt_test" });
  });
});

describe("withoutInternalReasons — SCRUM-110 AC6", () => {
  it("SCRUM-110 [AC6] TC-110-12: keeps every item name and state but removes internal reasons", () => {
    const checklist: ReadinessChecklist = {
      ready: false,
      items: [
        {
          name: "Venue booking",
          complete: false,
          state: "Rejected",
          reason: "Boardroom seats 14; the event expects 55 attendees.",
        },
        {
          name: "Equipment",
          complete: false,
          state: "Not fully reserved",
          reason: null,
        },
      ],
    };

    expect(withoutInternalReasons(checklist)).toEqual({
      ready: false,
      items: [{ ...checklist.items[0], reason: null }, checklist.items[1]],
    });
  });
});

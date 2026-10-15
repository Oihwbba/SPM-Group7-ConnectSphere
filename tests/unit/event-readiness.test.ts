import { describe, it, expect, vi } from "vitest";
import type { EventStatus, Prisma } from "@prisma/client";

import { formatDateTime } from "@/lib/datetime";
import {
  getConfirmedArrangements,
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
type Line = {
  equipmentId: string;
  quantity: number;
  equipment: { type: string };
};
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
  noEquipmentNeededAt: Date | null;
  noEquipmentNeededBy: { name: string } | null;
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
const line = (equipmentId: string, type: string, quantity: number): Line => ({
  equipmentId,
  quantity,
  equipment: { type },
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

const projectors = (n: number) => line("eqp_projector", "Projector", n);
const mics = (n: number) => line("eqp_mic", "Wireless Microphone", n);

// SCRUM-170 AC4: Equipment is always listed. Tests about the venue start
// from No equipment needed recorded, so Equipment doesn't hold them back;
// `undecided` is an event where the Coordinator hasn't decided yet.
const DECIDED_AT = new Date("2031-05-20T02:00:00Z");
const undecided = { noEquipmentNeededAt: null, noEquipmentNeededBy: null };

function planningEvent(overrides: Partial<Arrangements> = {}): Arrangements {
  return {
    status: "PLANNING",
    startAt: START,
    endAt: END,
    noEquipmentNeededAt: DECIDED_AT,
    noEquipmentNeededBy: { name: "Cody Coordinator" },
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
  it("SCRUM-110 [AC1, AC5] TC-110-01, SCRUM-170 [AC4] TC-170-08: an approved venue booking and No equipment needed recorded is a complete checklist, ready to confirm, keeping who decided and when", async () => {
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
        {
          name: "Equipment",
          complete: true,
          state: "No equipment needed",
          reason: `Recorded by Cody Coordinator, ${formatDateTime(DECIDED_AT)}`,
        },
      ],
    });
  });

  it("SCRUM-170 [AC4] TC-170-07: with no equipment request and nothing decided, Equipment is still listed as Not decided, incomplete, and blocks confirmation", async () => {
    const result = await checklistOf(planningEvent(undecided));

    expect(equipment(result)).toEqual({
      name: "Equipment",
      complete: false,
      state: "Not decided",
      reason: null,
      noEquipmentOffered: true,
    });
    expect(result?.ready).toBe(false);
  });

  it("SCRUM-170 [AC4] TC-170-09: a live equipment request decides the item, and No equipment needed is not offered beside it", async () => {
    const result = await checklistOf(
      planningEvent({
        ...undecided,
        equipmentRequests: [request("PENDING_REVIEW", [projectors(2)])],
      }),
    );

    expect(equipment(result)).toMatchObject({
      complete: false,
      state: "Not fully reserved: Projector",
    });
    expect(equipment(result)).not.toHaveProperty("noEquipmentOffered");
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

  it("SCRUM-110 [AC3, AC4] TC-110-07: a line reserved only in part leaves Equipment incomplete and names that item, without counts", async () => {
    const result = await checklistOf(
      planningEvent({
        equipmentRequests: [request("PENDING_REVIEW", [projectors(5)])],
        reservations: [reserved("eqp_projector", 3)],
      }),
    );

    expect(equipment(result)).toEqual({
      name: "Equipment",
      complete: false,
      state: "Not fully reserved: Projector",
      reason: null,
    });
    expect(result?.ready).toBe(false);
  });

  it("SCRUM-110 [AC4] TC-110-15: every item not reserved in full is named, in the order requested, and an item reserved in full is not", async () => {
    const result = await checklistOf(
      planningEvent({
        equipmentRequests: [
          request("APPROVED", [
            projectors(1),
            mics(2),
            line("eqp_laptop", "Laptop", 1),
          ]),
        ],
        reservations: [reserved("eqp_mic", 2)],
      }),
    );

    expect(equipment(result)?.state).toBe(
      "Not fully reserved: Projector, Laptop",
    );
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

      expect(equipment(result)).toMatchObject({
        complete: done,
        state: done ? "Reserved" : "Not fully reserved: Projector",
      });
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

  it("SCRUM-110 TC-110-09, SCRUM-170 [AC4] TC-170-07: a cancelled request leaves Equipment Not decided, so it blocks confirmation until the Coordinator decides", async () => {
    const result = await checklistOf(
      planningEvent({
        ...undecided,
        equipmentRequests: [request("CANCELLED", [projectors(2)])],
      }),
    );

    expect(equipment(result)).toMatchObject({
      complete: false,
      state: "Not decided",
      noEquipmentOffered: true,
    });
    expect(result?.ready).toBe(false);
  });

  it("SCRUM-110 [AC4] TC-110-09: a request Technical Support rejected keeps Equipment incomplete until the Coordinator requests again", async () => {
    const result = await checklistOf(
      planningEvent({
        ...undecided,
        equipmentRequests: [request("REJECTED", [projectors(2)])],
      }),
    );

    expect(equipment(result)).toEqual({
      name: "Equipment",
      complete: false,
      state: "Rejected",
      reason: null,
      // SCRUM-170 AC4: the Coordinator may decide no equipment is needed after all.
      noEquipmentOffered: true,
    });
    expect(result?.ready).toBe(false);
  });

  it("SCRUM-110 [AC3] TC-110-09: a new request after a rejection replaces it, and live requests for the same item add up", async () => {
    // The rejected request's projectors are not wanted: the laptop alone completes it.
    const replaced = await checklistOf(
      planningEvent({
        equipmentRequests: [
          request("REJECTED", [projectors(2)], 1),
          request("APPROVED", [line("eqp_laptop", "Laptop", 1)], 2),
        ],
        reservations: [reserved("eqp_laptop", 1)],
      }),
    );
    const combined = (n: number) =>
      checklistOf(
        planningEvent({
          equipmentRequests: [
            request("APPROVED", [projectors(2)], 1),
            request("APPROVED", [projectors(3)], 2),
          ],
          reservations: [reserved("eqp_projector", n)],
        }),
      );

    expect(equipment(replaced)?.complete).toBe(true);
    // One item named once, however many requests asked for it.
    expect(equipment(await combined(3))?.state).toBe(
      "Not fully reserved: Projector",
    );
    expect(equipment(await combined(5))?.complete).toBe(true);
  });

  it.each(["PENDING_REVIEW", "IN_REVIEW"])(
    "SCRUM-142 [AC10] TC-142-18: a %s request keeps Equipment incomplete even with every line reserved, so the event isn't ready",
    async (status) => {
      const result = await checklistOf(
        planningEvent({
          equipmentRequests: [request(status, [projectors(2)])],
          reservations: [reserved("eqp_projector", 2)],
        }),
      );

      expect(equipment(result)).toEqual({
        name: "Equipment",
        complete: false,
        state: "Awaiting Technical Support review",
        reason: null,
      });
      expect(result?.ready).toBe(false);
    },
  );

  it("SCRUM-142 [AC10] TC-142-18: a request awaiting review holds back an approved one, and an item not reserved in full is named first", async () => {
    const withMics = (n: number) =>
      checklistOf(
        planningEvent({
          equipmentRequests: [
            request("APPROVED", [projectors(2)], 1),
            request("PENDING_REVIEW", [mics(1)], 2),
          ],
          reservations: [
            reserved("eqp_projector", 2),
            ...(n ? [reserved("eqp_mic", n)] : []),
          ],
        }),
      );

    expect(equipment(await withMics(1))?.state).toBe(
      "Awaiting Technical Support review",
    );
    expect(equipment(await withMics(0))?.state).toBe(
      "Not fully reserved: Wireless Microphone",
    );
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

// SCRUM-26 AC12 — a flagged booking or reservation keeps the event from being
// confirmed until its Coordinator resolves the flag.
describe("getReadinessChecklist — flagged arrangements (SCRUM-26 AC12)", () => {
  const REASON = "The event moved to 2 June.";
  const flagged = <T extends object>(row: T, reason = REASON) =>
    ({ ...row, needsReconsideration: true, reconsiderationReason: reason }) as T;

  it("SCRUM-26 [AC12] TC-26-13: a flagged Approved booking makes the venue item incomplete with the reason, so the event isn't ready", async () => {
    const result = await checklistOf(
      planningEvent({ bookings: [flagged(booking("APPROVED"))] }),
    );

    expect(result?.ready).toBe(false);
    expect(venue(result)).toEqual({
      name: "Venue booking",
      complete: false,
      state: "Needs reconsideration",
      reason: REASON,
    });
  });

  it("SCRUM-26 [AC12] TC-26-13: a flagged Pending or Held booking counts too, even beside another approved one", async () => {
    for (const status of ["PENDING", "HELD"]) {
      const result = await checklistOf(
        planningEvent({
          bookings: [booking("APPROVED", 1), flagged(booking(status, 2))],
        }),
      );
      expect(venue(result)).toMatchObject({
        complete: false,
        state: "Needs reconsideration",
      });
    }
  });

  it("SCRUM-26 [AC12] TC-26-13: a flag left on a booking that is no longer live doesn't count", async () => {
    const result = await checklistOf(
      planningEvent({
        bookings: [booking("APPROVED", 2), flagged(booking("CANCELLED", 1))],
      }),
    );

    expect(venue(result)).toMatchObject({ complete: true, state: "Approved" });
  });

  it("SCRUM-26 [AC12] TC-26-13: a flagged Confirmed reservation makes the equipment item incomplete, naming the equipment, with the first reason", async () => {
    const withType = (equipmentId: string, type: string, quantity: number) =>
      ({ ...reserved(equipmentId, quantity), equipment: { type } }) as Reservation;
    const result = await checklistOf(
      planningEvent({
        equipmentRequests: [request("APPROVED", [projectors(2), mics(1)])],
        reservations: [
          flagged(withType("eqp_projector", "Projector", 1), "One projector broke."),
          flagged(withType("eqp_projector", "Projector", 1)),
          flagged(withType("eqp_mic", "Wireless Microphone", 1)),
        ],
      }),
    );

    expect(result?.ready).toBe(false);
    expect(equipment(result)).toEqual({
      name: "Equipment",
      complete: false,
      state: "Needs reconsideration: Projector, Wireless Microphone",
      reason: "One projector broke.",
    });
  });

  it("SCRUM-26 [AC12] TC-26-13: a flagged reservation shows even without a live equipment request; a cancelled one doesn't", async () => {
    const result = await checklistOf(
      planningEvent({
        reservations: [
          flagged({ ...reserved("eqp_projector", 1), equipment: { type: "Projector" } } as Reservation),
        ],
      }),
    );
    expect(equipment(result)).toMatchObject({
      complete: false,
      state: "Needs reconsideration: Projector",
    });

    const cancelled = await checklistOf(
      planningEvent({
        reservations: [flagged(reserved("eqp_projector", 1, { status: "CANCELLED" }))],
      }),
    );
    expect(equipment(cancelled)).toBeUndefined();
    expect(cancelled?.ready).toBe(true);
  });

  it("SCRUM-26 [AC12] TC-26-13: the Organiser sees that it needs reconsideration, but not the internal reason", async () => {
    const result = (await checklistOf(
      planningEvent({ bookings: [flagged(booking("APPROVED"))] }),
    ))!;

    expect(venue(withoutInternalReasons(result))).toMatchObject({
      state: "Needs reconsideration",
      reason: null,
    });
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
          state: "Not fully reserved: Projector",
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

describe("getConfirmedArrangements — SCRUM-81 AC6", () => {
  const venueRow = (
    status: string,
    overrides: Partial<{
      startAt: Date;
      endAt: Date;
      createdAt: Date;
      venue: { name: string; location: string };
    }> = {},
  ) => ({
    status,
    createdAt: day(1),
    startAt: START,
    endAt: END,
    venue: {
      name: status === "APPROVED" ? "Exhibition Hall" : "Boardroom",
      location: "Level 1",
    },
    ...overrides,
  });
  const reservationRow = (
    type: string,
    quantity: number,
    overrides: Partial<{ status: string; startAt: Date; endAt: Date }> = {},
  ) => ({
    status: "CONFIRMED",
    quantity,
    startAt: START,
    endAt: END,
    equipment: { type },
    ...overrides,
  });

  function eventWith(bookings: unknown[], reservations: unknown[]) {
    const findUnique = vi.fn().mockResolvedValue({
      startAt: START,
      endAt: END,
      timezone: "Asia/Singapore",
      bookings,
      reservations,
    });
    return {
      db: { event: { findUnique } } as unknown as Prisma.TransactionClient,
      findUnique,
    };
  }

  it("SCRUM-81 [AC6] TC-81-06: lists the approved venue for the event's time, its date/time, and the equipment reserved for the whole event", async () => {
    const { db, findUnique } = eventWith(
      [venueRow("REJECTED"), venueRow("APPROVED"), venueRow("PENDING")],
      [
        reservationRow("Projector", 1),
        reservationRow("Wireless Microphone", 4),
        reservationRow("Projector", 1),
        reservationRow("Laptop", 2, { status: "CANCELLED" }),
        reservationRow("Lectern", 1, {
          endAt: new Date("2031-06-01T04:00:00Z"),
        }),
      ],
    );

    expect(await getConfirmedArrangements(db, "evt_test")).toEqual({
      venue: { name: "Exhibition Hall", location: "Level 1" },
      startAt: START,
      endAt: END,
      timezone: "Asia/Singapore",
      equipment: ["Projector × 2", "Wireless Microphone × 4"],
    });
    expect(findUnique.mock.calls[0][0].where).toEqual({ id: "evt_test" });
  });

  it("SCRUM-81 [AC6] TC-81-06: when two approved bookings cover the event, the newer one is the confirmed venue", async () => {
    const hall = { name: "Exhibition Hall", location: "Level 1" };
    const auditorium = { name: "Auditorium", location: "Level 2" };
    const { db } = eventWith(
      // Listed oldest first, as the query returns them.
      [
        venueRow("APPROVED", { venue: hall, createdAt: day(1) }),
        venueRow("APPROVED", { venue: auditorium, createdAt: day(3) }),
      ],
      [],
    );

    expect((await getConfirmedArrangements(db, "evt_test"))?.venue).toEqual(
      auditorium,
    );
  });

  it("SCRUM-81 [AC6] TC-81-06: with no approved booking for the event's time and nothing reserved, the venue is empty and the equipment list is empty", async () => {
    const { db } = eventWith(
      [
        venueRow("APPROVED", { startAt: day(5), endAt: day(6) }),
        venueRow("PENDING"),
      ],
      [],
    );

    expect(await getConfirmedArrangements(db, "evt_test")).toMatchObject({
      venue: null,
      equipment: [],
    });
  });

  it("SCRUM-81 [AC6]: an id that matches no event has no arrangements", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const db = { event: { findUnique } } as unknown as Prisma.TransactionClient;

    expect(await getConfirmedArrangements(db, "evt_missing")).toBeNull();
  });
});

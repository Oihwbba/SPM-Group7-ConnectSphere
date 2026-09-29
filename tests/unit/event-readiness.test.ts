import { describe, it, expect, vi } from "vitest";
import type { EventStatus, Prisma } from "@prisma/client";

import { getConfirmationReadiness } from "@/lib/event-readiness";

// SCRUM-110 — the confirmation-readiness rule. Test cases: docs/testing/SCRUM-110.md.
// The rule takes the database client as an argument, so each test hands it a
// client whose one read returns the event's arrangements.

type Flagged = { status: string; needsReconsideration: boolean };

interface Arrangements {
  status: EventStatus;
  bookings: Flagged[];
  equipmentRequests: { status: string }[];
  reservations: Flagged[];
  registrations: { status: string }[];
}

const approvedBooking: Flagged = {
  status: "APPROVED",
  needsReconsideration: false,
};
const confirmedReservation: Flagged = {
  status: "CONFIRMED",
  needsReconsideration: false,
};

function planningEvent(overrides: Partial<Arrangements> = {}): Arrangements {
  return {
    status: "PLANNING",
    bookings: [approvedBooking],
    equipmentRequests: [],
    reservations: [],
    registrations: [],
    ...overrides,
  };
}

function clientReturning(event: Arrangements | null) {
  const findUnique = vi.fn().mockResolvedValue(event);
  const db = { event: { findUnique } } as unknown as Prisma.TransactionClient;
  return { db, findUnique };
}

async function readinessOf(event: Arrangements | null) {
  const { db } = clientReturning(event);
  return getConfirmationReadiness(db, "evt_planning");
}

describe("getConfirmationReadiness — SCRUM-110", () => {
  it("SCRUM-110 [AC1, AC3] TC-110-01: a Planning event with an approved venue booking and no equipment request is ready", async () => {
    expect(await readinessOf(planningEvent())).toEqual({
      ready: true,
      gaps: [],
    });
  });

  it("SCRUM-110 [AC1, AC5] TC-110-02: without any venue booking the event is not ready, and the Organiser's venue requirement is never consulted", async () => {
    const { db, findUnique } = clientReturning(planningEvent({ bookings: [] }));

    const result = await getConfirmationReadiness(db, "evt_planning");

    expect(result).toEqual({
      ready: false,
      gaps: ["NO_APPROVED_VENUE_BOOKING"],
    });
    expect(findUnique.mock.calls[0][0].select).not.toHaveProperty(
      "venueRequirements",
    );
  });

  it.each(["PENDING", "REJECTED", "CANCELLED"])(
    "SCRUM-110 [AC1, AC4] TC-110-03: a %s booking is not an approved one",
    async (status) => {
      const result = await readinessOf(
        planningEvent({ bookings: [{ status, needsReconsideration: false }] }),
      );

      expect(result).toEqual({
        ready: false,
        gaps: ["NO_APPROVED_VENUE_BOOKING"],
      });
    },
  );

  it("SCRUM-110 [AC1, AC4] TC-110-04: a second booking approved after a rejected one makes the event ready", async () => {
    const result = await readinessOf(
      planningEvent({
        bookings: [
          { status: "REJECTED", needsReconsideration: false },
          approvedBooking,
        ],
      }),
    );

    expect(result).toEqual({ ready: true, gaps: [] });
  });

  it("SCRUM-110 [AC2] TC-110-05: with an equipment request, an approved booking plus a confirmed reservation is ready", async () => {
    const result = await readinessOf(
      planningEvent({
        equipmentRequests: [{ status: "APPROVED" }],
        reservations: [confirmedReservation],
      }),
    );

    expect(result).toEqual({ ready: true, gaps: [] });
  });

  it.each([
    { reservations: [] as Flagged[], description: "no reservation" },
    {
      reservations: [{ status: "CANCELLED", needsReconsideration: false }],
      description: "only a cancelled reservation",
    },
  ])(
    "SCRUM-110 [AC2, AC4] TC-110-06: an equipment request with $description is not ready",
    async ({ reservations }) => {
      const result = await readinessOf(
        planningEvent({
          equipmentRequests: [{ status: "PENDING_REVIEW" }],
          reservations,
        }),
      );

      expect(result).toEqual({
        ready: false,
        gaps: ["NO_CONFIRMED_EQUIPMENT_RESERVATION"],
      });
    },
  );

  it("SCRUM-110 [AC2, AC3] TC-110-07: a request Technical Support rejected still needs equipment; only a cancelled request stops equipment being required", async () => {
    const rejected = await readinessOf(
      planningEvent({ equipmentRequests: [{ status: "REJECTED" }] }),
    );
    const cancelled = await readinessOf(
      planningEvent({ equipmentRequests: [{ status: "CANCELLED" }] }),
    );

    expect(rejected).toEqual({
      ready: false,
      gaps: ["NO_CONFIRMED_EQUIPMENT_RESERVATION"],
    });
    expect(cancelled).toEqual({ ready: true, gaps: [] });
  });

  it("SCRUM-110 [AC3] TC-110-08: a reservation made without an equipment request neither blocks nor is required", async () => {
    const result = await readinessOf(
      planningEvent({ reservations: [confirmedReservation] }),
    );

    expect(result).toEqual({ ready: true, gaps: [] });
  });

  it.each([
    {
      record: "booking",
      flagged: {
        bookings: [{ status: "APPROVED", needsReconsideration: true }],
      },
    },
    {
      record: "reservation",
      flagged: {
        reservations: [{ status: "CONFIRMED", needsReconsideration: true }],
      },
    },
    {
      record: "registration",
      flagged: { registrations: [{ status: "REGISTERED" }] },
    },
  ])(
    "SCRUM-110 [AC6, AC7] TC-110-09: a flagged $record blocks confirmation even when every arrangement is in place",
    async ({ flagged }) => {
      const result = await readinessOf(
        planningEvent({
          equipmentRequests: [{ status: "APPROVED" }],
          reservations: [confirmedReservation],
          ...flagged,
        }),
      );

      expect(result).toEqual({
        ready: false,
        gaps: ["UNRESOLVED_RECONSIDERATION"],
      });
    },
  );

  it("SCRUM-110 [AC7] TC-110-10: a flag no longer blocks once staff cancel or reject the flagged booking, cancel the reservation, or the registration is withdrawn or cancelled", async () => {
    const result = await readinessOf(
      planningEvent({
        bookings: [
          approvedBooking,
          { status: "CANCELLED", needsReconsideration: true },
          { status: "REJECTED", needsReconsideration: true },
        ],
        equipmentRequests: [{ status: "APPROVED" }],
        reservations: [
          confirmedReservation,
          { status: "CANCELLED", needsReconsideration: true },
        ],
        registrations: [{ status: "WITHDRAWN" }, { status: "CANCELLED" }],
      }),
    );

    expect(result).toEqual({ ready: true, gaps: [] });
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
    "SCRUM-110 [Planning only] TC-110-11: a %s event is not confirmation-ready, even with every arrangement in place",
    async (status) => {
      const result = await readinessOf(planningEvent({ status }));

      expect(result).toEqual({ ready: false, gaps: ["NOT_IN_PLANNING"] });
    },
  );

  it("SCRUM-110 TC-110-12: an id that matches no event is not ready, and nothing else is reported", async () => {
    expect(await readinessOf(null)).toEqual({
      ready: false,
      gaps: ["EVENT_NOT_FOUND"],
    });
  });

  it("SCRUM-110 TC-110-13: every outstanding arrangement is reported at once, in a fixed order", async () => {
    const result = await readinessOf({
      status: "APPROVED",
      bookings: [],
      equipmentRequests: [{ status: "IN_REVIEW" }],
      reservations: [],
      registrations: [{ status: "REGISTERED" }],
    });

    expect(result).toEqual({
      ready: false,
      gaps: [
        "NOT_IN_PLANNING",
        "NO_APPROVED_VENUE_BOOKING",
        "NO_CONFIRMED_EQUIPMENT_RESERVATION",
        "UNRESOLVED_RECONSIDERATION",
      ],
    });
  });

  it("SCRUM-110 [AC8, AC9] TC-110-14: reads the one event it is asked about, once, through the client it is given", async () => {
    const { db, findUnique } = clientReturning(planningEvent());

    await getConfirmationReadiness(db, "evt_planning");

    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(findUnique.mock.calls[0][0].where).toEqual({ id: "evt_planning" });
  });

  // The flag half of the registration rule runs in the query, which the other
  // tests replace. Without this filter every registered attendee would count as
  // an unresolved flag, and no other test here would notice.
  it("SCRUM-110 [AC7] TC-110-15: only flagged registrations are read, so an ordinary registered attendee never blocks confirmation", async () => {
    const { db, findUnique } = clientReturning(planningEvent());

    await getConfirmationReadiness(db, "evt_planning");

    expect(findUnique.mock.calls[0][0].select.registrations).toEqual({
      where: { needsReconsideration: true },
      select: { status: true },
    });
  });
});

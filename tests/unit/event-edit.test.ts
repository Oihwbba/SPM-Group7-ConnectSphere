import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { EventStatus, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { can } from "@/lib/auth/can";
import {
  addOperationalNote,
  canEditEventDetails,
  getOperationalNotes,
  updateEventDetails,
} from "@/app/(app)/events/edit-actions";

// SCRUM-25 — the assigned Coordinator edits an event's details directly, and
// operational notes, with the database mocked: every rule and refusal. The
// database's own rules (the row lock, the permanent notes) run against a real
// Postgres in tests/integration/event-edit.test.ts.
const db = vi.hoisted(() => ({
  event: { findUnique: vi.fn(), updateMany: vi.fn() },
  booking: { findMany: vi.fn(), updateMany: vi.fn() },
  reservation: { findMany: vi.fn(), updateMany: vi.fn() },
  auditLog: { createMany: vi.fn() },
  safetyCheck: { updateMany: vi.fn() },
  registration: { count: vi.fn() },
  eventOperationalNote: { findMany: vi.fn(), create: vi.fn() },
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockAuth = auth as unknown as Mock;
const DENIED = "You do not have permission to do that.";

function sessionFor(role: Role, id = `usr_${role.toLowerCase()}`): Session {
  return {
    user: { id, role, name: "Test User", email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  };
}

const START = new Date("2036-03-03T02:00:00.000Z");
const END = new Date("2036-03-03T06:00:00.000Z");

/** A Planning event assigned to usr_coord, as stored. */
const stored = (patch: Partial<Record<string, unknown>> = {}) => ({
  id: "evt_1",
  organiserId: "usr_org",
  coordinatorId: "usr_coord",
  status: "PLANNING" as EventStatus,
  name: "Annual Gala",
  purpose: "Fundraising",
  description: "Dinner and talks",
  accessibilityNeeds: "Step-free access",
  preferredLayout: "banquet",
  registrationNotes: null,
  programme: null,
  specialRequests: null,
  startAt: START,
  endAt: END,
  expectedAttendance: 120,
  venueRequirements: "Ballroom",
  equipmentRequirements: "Two microphones",
  ...patch,
});

/** The edit form sent back unchanged. */
const unchanged = {
  eventId: "evt_1",
  name: "Annual Gala",
  purpose: "Fundraising",
  description: "Dinner and talks",
  accessibilityNeeds: "Step-free access",
  preferredLayout: "banquet",
  registrationNotes: "",
  programme: "",
  specialRequests: "",
  startAt: START.toISOString(),
  endAt: END.toISOString(),
  expectedAttendance: "120",
  venueRequirements: "Ballroom",
  equipmentRequirements: "Two microphones",
};

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((work: (tx: typeof db) => unknown) =>
    work(db),
  );
  mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_coord"));
  db.event.findUnique.mockResolvedValue(stored());
  db.event.updateMany.mockResolvedValue({ count: 1 });
  db.booking.findMany.mockResolvedValue([]);
  db.reservation.findMany.mockResolvedValue([]);
  db.booking.updateMany.mockResolvedValue({ count: 0 });
  db.reservation.updateMany.mockResolvedValue({ count: 0 });
  db.safetyCheck.updateMany.mockResolvedValue({ count: 0 });
});

describe("updateEventDetails — SCRUM-171 AC5, Registration needed", () => {
  it.each([
    [
      1,
      "This event has 1 active registration, so Registration needed can't be changed to No.",
    ],
    [
      3,
      "This event has 3 active registrations, so Registration needed can't be changed to No.",
    ],
  ])(
    "SCRUM-171 [AC5] TC-171-08: with %i active registration(s), changing it to No is refused with the number shown, and nothing is written",
    async (active, message) => {
      db.event.findUnique.mockResolvedValue(
        stored({ registrationRequired: true }),
      );
      db.registration.count.mockResolvedValue(active);

      const result = await updateEventDetails({
        ...unchanged,
        registrationRequired: "no",
      });

      expect(result).toEqual({
        ok: false,
        error: message,
        fieldErrors: { registrationRequired: [message] },
      });
      // Counted under the event lock, which a registration also takes.
      expect(db.$queryRaw).toHaveBeenCalled();
      expect(db.registration.count).toHaveBeenCalledWith({
        where: { eventId: "evt_1", status: "REGISTERED" },
      });
      expect(db.event.updateMany).not.toHaveBeenCalled();
      expect(db.auditLog.createMany).not.toHaveBeenCalled();
    },
  );

  it("SCRUM-171 [AC5] TC-171-08: with no active registrations, changing it to No is saved and audited", async () => {
    db.event.findUnique.mockResolvedValue(
      stored({ registrationRequired: true }),
    );
    db.registration.count.mockResolvedValue(0);

    const result = await updateEventDetails({
      ...unchanged,
      registrationRequired: "no",
    });

    expect(result).toEqual({
      ok: true,
      data: {
        changed: ["registrationRequired"],
        safetyCheckOutdated: false,
        flagged: 0,
      },
    });
    expect(db.event.updateMany).toHaveBeenCalledWith({
      where: { id: "evt_1", status: "PLANNING", coordinatorId: "usr_coord" },
      data: { registrationRequired: false },
    });
    expect(db.auditLog.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          fieldName: "registrationRequired",
          oldValue: "true",
          newValue: "false",
        }),
      ],
    });
  });

  it("SCRUM-171 [AC5] TC-171-08: changing it to Yes, or from unanswered to Yes, never counts registrations", async () => {
    for (const before of [false, null]) {
      vi.clearAllMocks();
      db.event.findUnique.mockResolvedValue(
        stored({ registrationRequired: before }),
      );
      db.event.updateMany.mockResolvedValue({ count: 1 });

      const result = await updateEventDetails({
        ...unchanged,
        registrationRequired: "yes",
      });

      expect(result.ok).toBe(true);
      expect(db.registration.count).not.toHaveBeenCalled();
      expect(db.event.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { registrationRequired: true } }),
      );
    }
  });

  it("SCRUM-171 [AC5] TC-171-08: left out of the edit, it stays as it is", async () => {
    db.event.findUnique.mockResolvedValue(
      stored({ registrationRequired: false }),
    );

    const result = await updateEventDetails(unchanged);

    expect(result).toEqual({
      ok: true,
      data: { changed: [], safetyCheckOutdated: false, flagged: 0 },
    });
    expect(db.event.updateMany).not.toHaveBeenCalled();
  });
});

describe("updateEventDetails — SCRUM-25", () => {
  it("SCRUM-25 [AC1, AC2] TC-25-01, TC-25-04: the assigned Coordinator saves routine fields; the status is untouched and each change is audited", async () => {
    const result = await updateEventDetails({
      ...unchanged,
      name: " Annual Gala 2036 ",
      programme: "18:00 drinks, 19:00 dinner",
    });

    expect(result).toEqual({
      ok: true,
      data: { changed: ["name", "programme"], safetyCheckOutdated: false, flagged: 0 },
    });
    expect(db.event.updateMany).toHaveBeenCalledWith({
      where: { id: "evt_1", status: "PLANNING", coordinatorId: "usr_coord" },
      data: { name: "Annual Gala 2036", programme: "18:00 drinks, 19:00 dinner" },
    });
    const [{ data }] = db.event.updateMany.mock.calls[0];
    expect(data).not.toHaveProperty("status");
    expect(db.auditLog.createMany).toHaveBeenCalledWith({
      data: [
        {
          entityType: "Event",
          entityId: "evt_1",
          action: "UPDATED",
          actorId: "usr_coord",
          fieldName: "name",
          oldValue: "Annual Gala",
          newValue: "Annual Gala 2036",
        },
        {
          entityType: "Event",
          entityId: "evt_1",
          action: "UPDATED",
          actorId: "usr_coord",
          fieldName: "programme",
          oldValue: null,
          newValue: "18:00 drinks, 19:00 dinner",
        },
      ],
    });
    // AC2: a routine edit never looks at, or flags, the arrangements.
    expect(db.booking.findMany).not.toHaveBeenCalled();
    expect(db.booking.updateMany).not.toHaveBeenCalled();
    expect(db.safetyCheck.updateMany).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/events");
  });

  it("SCRUM-25 [AC1] TC-25-02: an event Under Review is edited the same way", async () => {
    db.event.findUnique.mockResolvedValue(stored({ status: "UNDER_REVIEW" }));

    const result = await updateEventDetails({ ...unchanged, purpose: "Charity" });

    expect(result.ok).toBe(true);
    expect(db.event.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "UNDER_REVIEW" }),
      }),
    );
  });

  it("SCRUM-25 [AC1] TC-25-14: saving with nothing changed writes nothing", async () => {
    expect(await updateEventDetails(unchanged)).toEqual({
      ok: true,
      data: { changed: [], safetyCheckOutdated: false, flagged: 0 },
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("SCRUM-25 [AC1] TC-25-17: a long answer the request form accepted still saves, and a capped field over its limit is refused", async () => {
    const long = "x".repeat(3000);
    const saved = await updateEventDetails({
      ...unchanged,
      accessibilityNeeds: long,
      preferredLayout: long,
      registrationNotes: long,
      venueRequirements: long,
      equipmentRequirements: long,
    });
    expect(saved).toMatchObject({ ok: true });

    vi.clearAllMocks();
    const refused = await updateEventDetails({
      ...unchanged,
      programme: "x".repeat(5001),
    });
    expect(refused).toMatchObject({
      ok: false,
      fieldErrors: { programme: ["String must contain at most 5000 character(s)"] },
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("SCRUM-25 [AC1] TC-25-01: clearing an optional field stores it as empty", async () => {
    await updateEventDetails({ ...unchanged, description: "   " });

    expect(db.event.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { description: null } }),
    );
  });

  it.each(["preferredLayout", "accessibilityNeeds"] as const)(
    "SCRUM-25 [AC2] TC-25-05: changing %s makes an Approved or awaiting safety check Outdated",
    async (field) => {
      db.safetyCheck.updateMany.mockResolvedValue({ count: 1 });

      const result = await updateEventDetails({ ...unchanged, [field]: "Changed" });

      expect(result).toEqual({
        ok: true,
        data: { changed: [field], safetyCheckOutdated: true, flagged: 0 },
      });
      expect(db.safetyCheck.updateMany).toHaveBeenCalledWith({
        where: {
          eventId: "evt_1",
          status: { in: ["AWAITING_REVIEW", "APPROVED"] },
        },
        data: { status: "OUTDATED", outdatedAt: expect.any(Date) },
      });
    },
  );

  it("SCRUM-25 [AC2] TC-25-05: with no safety check requested, a layout change reports none outdated", async () => {
    const result = await updateEventDetails({ ...unchanged, preferredLayout: "theatre" });

    expect(result).toMatchObject({ ok: true, data: { safetyCheckOutdated: false } });
  });

  it("SCRUM-25 [AC3] TC-25-06: with nothing booked or reserved, the date, attendance, venue and equipment save like other fields", async () => {
    const later = new Date("2036-03-04T02:00:00.000Z");
    const result = await updateEventDetails({
      ...unchanged,
      startAt: later.toISOString(),
      endAt: new Date("2036-03-04T06:00:00.000Z").toISOString(),
      expectedAttendance: 150,
      venueRequirements: "Hall",
      equipmentRequirements: "Projector",
    });

    expect(result).toMatchObject({
      ok: true,
      data: {
        changed: [
          "startAt",
          "endAt",
          "expectedAttendance",
          "venueRequirements",
          "equipmentRequirements",
        ],
      },
    });
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    expect(db.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          eventId: "evt_1",
          OR: [
            { status: { in: ["PENDING", "APPROVED"] } },
            { status: "HELD", holdExpiresAt: { gt: expect.any(Date) } },
          ],
        },
      }),
    );
    expect(db.reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { eventId: "evt_1", status: "CONFIRMED" } }),
    );
    // SCRUM-26 AC1: nothing booked or reserved, so nothing to flag.
    expect(db.booking.updateMany).not.toHaveBeenCalled();
    expect(db.event.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ startAt: later, expectedAttendance: 150 }),
      }),
    );
  });

  it.each([
    ["the start", { startAt: "2036-03-03T01:00:00.000Z" }],
    ["the end", { endAt: "2036-03-03T07:00:00.000Z" }],
    ["the expected attendance", { expectedAttendance: 150 }],
  ])(
    "SCRUM-25 [AC3] TC-25-16: changing %s makes an Approved or awaiting safety check Outdated (SCRUM-166 AC13)",
    async (_label, edit) => {
      db.safetyCheck.updateMany.mockResolvedValue({ count: 1 });

      const result = await updateEventDetails({ ...unchanged, ...edit });

      expect(result).toMatchObject({ ok: true, data: { safetyCheckOutdated: true } });
      expect(db.safetyCheck.updateMany).toHaveBeenCalledWith({
        where: { eventId: "evt_1", status: { in: ["AWAITING_REVIEW", "APPROVED"] } },
        data: { status: "OUTDATED", outdatedAt: expect.any(Date) },
      });
    },
  );

  it.each([
    ["the venue requirements", { venueRequirements: "Hall" }],
    ["the equipment requirements", { equipmentRequirements: "Projector" }],
    ["the programme", { programme: "Talks, then dinner" }],
  ])(
    "SCRUM-25 [AC3] TC-25-16: changing only %s leaves safety checks alone",
    async (_label, edit) => {
      const result = await updateEventDetails({ ...unchanged, ...edit });

      expect(result).toMatchObject({ ok: true, data: { safetyCheckOutdated: false } });
      expect(db.safetyCheck.updateMany).not.toHaveBeenCalled();
    },
  );

  it("SCRUM-25 [AC3] TC-25-15: changing the equipment requirements puts a No equipment needed decision back to Not decided, clearing who and when together", async () => {
    await updateEventDetails({ ...unchanged, equipmentRequirements: "Two lapel mics" });

    expect(db.event.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          equipmentRequirements: "Two lapel mics",
          noEquipmentNeededAt: null,
          noEquipmentNeededById: null,
        },
      }),
    );
  });

  describe("with arrangements in Planning — SCRUM-25 AC3, SCRUM-26 AC1", () => {
    const BOOKING = { id: "bkg_1", status: "PENDING", venue: { name: "Exhibition Hall" } };
    const RESERVATION = { id: "res_1", quantity: 2, equipment: { type: "Projector" } };
    const WARNED = [
      { kind: "booking", id: "bkg_1", label: "Exhibition Hall (Pending)" },
      { kind: "reservation", id: "res_1", label: "Projector × 2" },
    ];

    beforeEach(() => {
      db.booking.findMany.mockResolvedValue([BOOKING]);
      db.reservation.findMany.mockResolvedValue([RESERVATION]);
    });

    function expectNothingWritten() {
      expect(db.event.updateMany).not.toHaveBeenCalled();
      expect(db.auditLog.createMany).not.toHaveBeenCalled();
      expect(db.booking.updateMany).not.toHaveBeenCalled();
      expect(db.reservation.updateMany).not.toHaveBeenCalled();
      expect(db.safetyCheck.updateMany).not.toHaveBeenCalled();
    }

    it("SCRUM-25 [AC3] TC-25-06: changing the attendance first lists what will be flagged and saves nothing", async () => {
      expect(
        await updateEventDetails({ ...unchanged, expectedAttendance: 200, name: "New" }),
      ).toEqual({ ok: true, data: { confirm: WARNED, message: null } });
      expectNothingWritten();
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("SCRUM-25 [AC3] TC-25-06: once confirmed, the edit is saved and every arrangement flagged with the reason, its status and times untouched", async () => {
      db.booking.updateMany.mockResolvedValue({ count: 1 });
      db.reservation.updateMany.mockResolvedValue({ count: 1 });

      const result = await updateEventDetails({
        ...unchanged,
        expectedAttendance: 200,
        confirmedArrangements: ["bkg_1", "res_1"],
      });

      expect(result).toEqual({
        ok: true,
        data: { changed: ["expectedAttendance"], safetyCheckOutdated: false, flagged: 2 },
      });
      expect(db.event.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { expectedAttendance: 200 } }),
      );
      const flag = {
        needsReconsideration: true,
        reconsiderationFlaggedAt: expect.any(Date),
        reconsiderationReason: "The event's expected attendance changed.",
        reconsiderationResolvedAt: null,
        reconsiderationResolvedById: null,
      };
      // SCRUM-26 AC2, AC6: only the flag columns; no status, no times.
      expect(db.booking.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ eventId: "evt_1", needsReconsideration: false }),
        data: flag,
      });
      expect(db.reservation.updateMany).toHaveBeenCalledWith({
        where: { eventId: "evt_1", status: "CONFIRMED", needsReconsideration: false },
        data: flag,
      });
      expect(revalidatePath).toHaveBeenCalledWith("/bookings");
      expect(revalidatePath).toHaveBeenCalledWith("/equipment-requests");
    });

    it("SCRUM-25 [AC3] TC-25-06: the reason names every date, time, attendance, venue or equipment field changed", async () => {
      await updateEventDetails({
        ...unchanged,
        startAt: "2036-03-03T01:00:00.000Z",
        endAt: "2036-03-03T07:00:00.000Z",
        venueRequirements: "Hall with a stage",
        programme: "Talks",
        confirmedArrangements: ["bkg_1", "res_1"],
      });

      expect(db.booking.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reconsiderationReason:
              "The event's start, end and venue requirements changed.",
          }),
        }),
      );
    });

    it("SCRUM-25 [AC3] TC-25-13: an arrangement made after the warning is asked about before anything is saved", async () => {
      expect(
        await updateEventDetails({
          ...unchanged,
          expectedAttendance: 200,
          confirmedArrangements: ["bkg_1"],
        }),
      ).toEqual({
        ok: true,
        data: {
          confirm: WARNED,
          message:
            "Something was booked or reserved for this event since you were warned. Check the list again before saving.",
        },
      });
      expectNothingWritten();
    });

    it("SCRUM-25 [AC2] TC-25-04: a routine change saves straight away and flags nothing", async () => {
      const result = await updateEventDetails({ ...unchanged, programme: "Talks" });

      expect(result).toMatchObject({ ok: true, data: { flagged: 0 } });
      expect(db.booking.findMany).not.toHaveBeenCalled();
      expect(db.booking.updateMany).not.toHaveBeenCalled();
    });

    it("SCRUM-25 [AC3] TC-25-18: Under Review, the attendance saves directly with no warning and nothing flagged", async () => {
      db.event.findUnique.mockResolvedValue(stored({ status: "UNDER_REVIEW" }));

      const result = await updateEventDetails({ ...unchanged, expectedAttendance: 200 });

      expect(result).toEqual({
        ok: true,
        data: { changed: ["expectedAttendance"], safetyCheckOutdated: false, flagged: 0 },
      });
      expect(db.booking.findMany).not.toHaveBeenCalled();
      expect(db.booking.updateMany).not.toHaveBeenCalled();
      expect(db.reservation.updateMany).not.toHaveBeenCalled();
    });
  });

  it("SCRUM-25 [AC3] TC-25-06: a start moved into the past is refused against the start", async () => {
    const result = await updateEventDetails({
      ...unchanged,
      startAt: "2020-01-01T02:00:00.000Z",
    });

    expect(result).toEqual({
      ok: false,
      error: "The start can't be in the past.",
      fieldErrors: { startAt: ["The start can't be in the past."] },
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("SCRUM-25 [AC3] TC-25-06: an end at or before the start is refused", async () => {
    const result = await updateEventDetails({
      ...unchanged,
      endAt: START.toISOString(),
    });

    expect(result).toMatchObject({
      ok: false,
      error: "The end must be after the start.",
    });
    expect(db.event.findUnique).not.toHaveBeenCalled();
  });

  it.each([
    ["no name", { name: " " }],
    ["a zero attendance", { expectedAttendance: 0 }],
  ])("SCRUM-25 [AC1] TC-25-01: %s is refused against its field", async (_, patch) => {
    const result = await updateEventDetails({ ...unchanged, ...patch });

    expect(result).toMatchObject({
      ok: false,
      error: "Please fix the highlighted fields.",
    });
    expect(db.event.findUnique).not.toHaveBeenCalled();
  });

  it("SCRUM-25 [AC5] TC-25-03: a Confirmed event can't be edited directly; changes go through a change request", async () => {
    db.event.findUnique.mockResolvedValue(stored({ status: "CONFIRMED" }));

    expect(await updateEventDetails({ ...unchanged, name: "X" })).toEqual({
      ok: false,
      error:
        "A Confirmed event's details can't be edited directly. Changes go through a change request.",
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it.each(["SUBMITTED", "APPROVED", "COMPLETED", "CANCELLED", "REJECTED"] as const)(
    "SCRUM-25 [AC1] TC-25-03: an event that is %s can't be edited here",
    async (status) => {
      db.event.findUnique.mockResolvedValue(stored({ status }));

      expect(await updateEventDetails({ ...unchanged, name: "X" })).toEqual({
        ok: false,
        error:
          "An event's details can only be edited while it is Under Review or in Planning.",
      });
      expect(db.$transaction).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["another Coordinator's event, as its previous Coordinator", { coordinatorId: "usr_new" }],
    ["an event nobody is assigned to yet", { coordinatorId: null, status: "UNDER_REVIEW" }],
  ])("SCRUM-25 [AC7] TC-25-08: %s reads as not found, and nothing changes", async (_, patch) => {
    db.event.findUnique.mockResolvedValue(stored(patch));

    expect(await updateEventDetails({ ...unchanged, name: "X" })).toEqual({
      ok: false,
      error: "Event not found.",
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("SCRUM-25 [AC7] TC-25-08: a missing event reads the same", async () => {
    db.event.findUnique.mockResolvedValue(null);

    expect(await updateEventDetails(unchanged)).toEqual({
      ok: false,
      error: "Event not found.",
    });
  });

  it.each([
    "ORGANISER",
    "VENUE_STAFF",
    "TECH_SUPPORT",
    "ATTENDEE",
    "COORDINATOR_LEAD",
    "SAFETY_OFFICER",
  ] as const)(
    "SCRUM-25 [AC4, AC7] TC-25-07, TC-25-08: %s can't edit an event's details, and nothing is read",
    async (role) => {
      mockAuth.mockResolvedValue(sessionFor(role, "usr_org"));

      expect(await updateEventDetails({ ...unchanged, name: "X" })).toEqual({
        ok: false,
        error: DENIED,
      });
      expect(db.event.findUnique).not.toHaveBeenCalled();
    },
  );

  it("SCRUM-25 [AC2, AC7] TC-25-04: an event reassigned or moved on since it was read is not overwritten", async () => {
    db.event.updateMany.mockResolvedValue({ count: 0 });

    expect(await updateEventDetails({ ...unchanged, name: "X" })).toEqual({
      ok: false,
      error: "This event changed while you were editing it. Reload it and try again.",
    });
    expect(db.auditLog.createMany).not.toHaveBeenCalled();
  });

  it("does not swallow an unexpected database error", async () => {
    const failure = new Error("connection reset");
    db.$transaction.mockRejectedValue(failure);

    await expect(updateEventDetails({ ...unchanged, name: "X" })).rejects.toBe(failure);
  });
});

describe("canEditEventDetails — SCRUM-25 AC1", () => {
  it("SCRUM-25 [AC1, AC7] TC-25-01, TC-25-08: offered only to the assigned Coordinator of an Under Review or Planning event", async () => {
    expect(await canEditEventDetails("evt_1")).toBe(true);

    db.event.findUnique.mockResolvedValue(stored({ status: "CONFIRMED" }));
    expect(await canEditEventDetails("evt_1")).toBe(false);

    db.event.findUnique.mockResolvedValue(stored({ coordinatorId: "usr_other" }));
    expect(await canEditEventDetails("evt_1")).toBe(false);

    db.event.findUnique.mockResolvedValue(null);
    expect(await canEditEventDetails("evt_1")).toBe(false);

    mockAuth.mockResolvedValue(null);
    expect(await canEditEventDetails("evt_1")).toBe(false);
  });

  it.each(["ORGANISER", "VENUE_STAFF", "TECH_SUPPORT", "ATTENDEE"] as const)(
    "SCRUM-25 [AC4, AC7] TC-25-07, TC-25-08: a %s is told no before the event is read",
    async (role) => {
      mockAuth.mockResolvedValue(sessionFor(role));

      expect(await canEditEventDetails("evt_1")).toBe(false);
      expect(db.event.findUnique).not.toHaveBeenCalled();
    },
  );
});

describe("operational notes — SCRUM-25 AC6", () => {
  /** The event as the notes check reads it. */
  const notesEvent = (
    patch: Partial<{
      status: EventStatus;
      coordinatorId: string | null;
      bookings: number;
      equipmentRequests: number;
    }> = {},
  ) => ({
    organiserId: "usr_org",
    coordinatorId: patch.coordinatorId === undefined ? "usr_coord" : patch.coordinatorId,
    status: patch.status ?? "PLANNING",
    _count: {
      bookings: patch.bookings ?? 0,
      equipmentRequests: patch.equipmentRequests ?? 0,
    },
  });

  beforeEach(() => {
    db.event.findUnique.mockResolvedValue(notesEvent());
    db.eventOperationalNote.create.mockResolvedValue({
      id: "note_1",
      body: "Stage riser delivered.",
      createdAt: new Date("2036-01-01T01:00:00Z"),
      author: { name: "Cody Coordinator" },
    });
    db.eventOperationalNote.findMany.mockResolvedValue([
      {
        id: "note_1",
        body: "Stage riser delivered.",
        createdAt: new Date("2036-01-01T01:00:00Z"),
        author: { name: "Cody Coordinator" },
      },
    ]);
  });

  it("SCRUM-25 [AC6] TC-25-09: the assigned Coordinator adds a note, kept with its author and time", async () => {
    const result = await addOperationalNote({
      eventId: "evt_1",
      body: "  Stage riser delivered.  ",
    });

    expect(result).toEqual({
      ok: true,
      data: {
        id: "note_1",
        body: "Stage riser delivered.",
        createdAt: new Date("2036-01-01T01:00:00Z"),
        authorName: "Cody Coordinator",
      },
    });
    expect(db.eventOperationalNote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { eventId: "evt_1", authorId: "usr_coord", body: "Stage riser delivered." },
      }),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/bookings");
    expect(revalidatePath).toHaveBeenCalledWith("/equipment-requests");
  });

  it.each(["SUBMITTED", "UNDER_REVIEW", "CONFIRMED", "COMPLETED"] as const)(
    "SCRUM-25 [AC6] TC-25-09: the Coordinator adds notes to a %s event too",
    async (status) => {
      db.event.findUnique.mockResolvedValue(notesEvent({ status }));

      expect((await addOperationalNote({ eventId: "evt_1", body: "OK" })).ok).toBe(true);
    },
  );

  it("SCRUM-25 [AC6] TC-25-11: no note can be added to a Cancelled event", async () => {
    db.event.findUnique.mockResolvedValue(notesEvent({ status: "CANCELLED" }));

    expect(await addOperationalNote({ eventId: "evt_1", body: "Late" })).toEqual({
      ok: false,
      error: "Notes can't be added to a cancelled event.",
    });
    expect(db.eventOperationalNote.create).not.toHaveBeenCalled();
  });

  it.each(["", "   "])(
    "SCRUM-25 [AC6] TC-25-11: a blank note (%j) is refused against the note",
    async (body) => {
      expect(await addOperationalNote({ eventId: "evt_1", body })).toEqual({
        ok: false,
        error: "Write the note before adding it.",
        fieldErrors: { body: ["Write the note before adding it."] },
      });
      expect(db.eventOperationalNote.create).not.toHaveBeenCalled();
    },
  );

  it("SCRUM-25 [AC6] TC-25-11: a note with no event is refused", async () => {
    expect(await addOperationalNote({ body: "x" })).toMatchObject({
      ok: false,
      error: "Choose an event.",
    });
  });

  it.each([
    ["VENUE_STAFF", { bookings: 1 }, true],
    ["VENUE_STAFF", { bookings: 0 }, false],
    ["TECH_SUPPORT", { equipmentRequests: 1 }, true],
    ["TECH_SUPPORT", { equipmentRequests: 0 }, false],
    ["COORDINATOR", { coordinatorId: "usr_other" }, false],
  ] as const)(
    "SCRUM-25 [AC6, AC7] TC-25-10, TC-25-12: %s with %j may add a note: %s",
    async (role, patch, allowed) => {
      mockAuth.mockResolvedValue(sessionFor(role, "usr_coord"));
      db.event.findUnique.mockResolvedValue(notesEvent(patch));

      const result = await addOperationalNote({ eventId: "evt_1", body: "Checked." });

      expect(result.ok).toBe(allowed);
      if (!allowed) {
        expect(result).toEqual({ ok: false, error: "Event not found." });
        expect(db.eventOperationalNote.create).not.toHaveBeenCalled();
      }
    },
  );

  it("SCRUM-25 [AC6] TC-25-10: Venue Staff's booking count is of Pending, Approved and still-live Held bookings only", async () => {
    await addOperationalNote({ eventId: "evt_1", body: "x" });

    expect(db.event.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          _count: {
            select: {
              bookings: {
                where: {
                  OR: [
                    { status: { in: ["PENDING", "APPROVED"] } },
                    { status: "HELD", holdExpiresAt: { gt: expect.any(Date) } },
                  ],
                },
              },
              equipmentRequests: true,
            },
          },
        }),
      }),
    );
  });

  it.each(["ORGANISER", "ATTENDEE", "COORDINATOR_LEAD", "SAFETY_OFFICER"] as const)(
    "SCRUM-25 [AC6, AC7] TC-25-12: %s can't add a note",
    async (role) => {
      mockAuth.mockResolvedValue(sessionFor(role));

      expect(await addOperationalNote({ eventId: "evt_1", body: "x" })).toEqual({
        ok: false,
        error: DENIED,
      });
      expect(db.event.findUnique).not.toHaveBeenCalled();
    },
  );

  it("SCRUM-25 [AC6] TC-25-09: the notes are read oldest first with author and time, and the Coordinator is offered to add one", async () => {
    expect(await getOperationalNotes("evt_1")).toEqual({
      ok: true,
      data: {
        notes: [
          {
            id: "note_1",
            body: "Stage riser delivered.",
            createdAt: new Date("2036-01-01T01:00:00Z"),
            authorName: "Cody Coordinator",
          },
        ],
        canAdd: true,
      },
    });
    expect(db.eventOperationalNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId: "evt_1" },
        orderBy: { createdAt: "asc" },
      }),
    );
  });

  it("SCRUM-25 [AC6] TC-25-09: the event's Organiser reads the notes but is not offered to add one", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_org"));

    expect(await getOperationalNotes("evt_1")).toMatchObject({
      ok: true,
      data: { canAdd: false },
    });
  });

  it("SCRUM-25 [AC6] TC-25-11: on a Cancelled event the notes stay readable, but adding is not offered", async () => {
    db.event.findUnique.mockResolvedValue(notesEvent({ status: "CANCELLED" }));

    expect(await getOperationalNotes("evt_1")).toMatchObject({
      ok: true,
      data: { canAdd: false },
    });
  });

  it.each([
    ["another Organiser", "ORGANISER", "usr_org2", {}],
    ["a previous Coordinator", "COORDINATOR", "usr_coord", { coordinatorId: "usr_new" }],
    ["Venue Staff with no booking for it", "VENUE_STAFF", "usr_vs", {}],
  ] as const)(
    "SCRUM-25 [AC6, AC7] TC-25-12: %s can't read the notes; it reads as not found",
    async (_, role, id, patch) => {
      mockAuth.mockResolvedValue(sessionFor(role, id));
      db.event.findUnique.mockResolvedValue(notesEvent(patch));

      expect(await getOperationalNotes("evt_1")).toEqual({
        ok: false,
        error: "Event not found.",
      });
      expect(db.eventOperationalNote.findMany).not.toHaveBeenCalled();
    },
  );

  it("SCRUM-25 [AC6] TC-25-12: a missing event reads as not found", async () => {
    db.event.findUnique.mockResolvedValue(null);

    expect(await getOperationalNotes("evt_x")).toEqual({
      ok: false,
      error: "Event not found.",
    });
    expect(await addOperationalNote({ eventId: "evt_x", body: "x" })).toEqual({
      ok: false,
      error: "Event not found.",
    });
  });

  it("SCRUM-25 [AC7] TC-25-12: an Attendee can't read notes at all", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE"));

    expect(await getOperationalNotes("evt_1")).toEqual({ ok: false, error: DENIED });
  });

  it("does not swallow an unexpected database error", async () => {
    const failure = new Error("connection reset");
    db.event.findUnique.mockRejectedValue(failure);

    await expect(getOperationalNotes("evt_1")).rejects.toBe(failure);
    await expect(addOperationalNote({ eventId: "evt_1", body: "x" })).rejects.toBe(failure);
  });
});

describe("the permission table — SCRUM-25", () => {
  const notes = (patch: object = {}) => ({
    kind: "event-notes" as const,
    organiserId: "usr_org",
    coordinatorId: "usr_coord",
    hasVenueBooking: false,
    hasEquipmentRequest: false,
    ...patch,
  });

  it("SCRUM-25 [AC4, AC7] TC-25-07: event:edit belongs to the assigned Coordinator only", () => {
    const event = (coordinatorId: string | null) => ({
      kind: "event" as const,
      organiserId: "usr_org",
      coordinatorId,
      status: "PLANNING" as const,
    });
    expect(can({ id: "usr_coord", role: "COORDINATOR" }, "event:edit", event("usr_coord"))).toBe(true);
    expect(can({ id: "usr_coord", role: "COORDINATOR" }, "event:edit", event(null))).toBe(false);
    expect(can({ id: "usr_org", role: "ORGANISER" }, "event:edit", event("usr_coord"))).toBe(false);
  });

  it("SCRUM-25 [AC6] TC-25-12: roles without a notes relationship are never related", () => {
    expect(
      can({ id: "u", role: "SAFETY_OFFICER" }, "event-note:read", notes({ hasVenueBooking: true })),
    ).toBe(false);
  });
});

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
  booking: { count: vi.fn() },
  reservation: { count: vi.fn() },
  auditLog: { createMany: vi.fn() },
  safetyCheck: { updateMany: vi.fn() },
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
  db.booking.count.mockResolvedValue(0);
  db.reservation.count.mockResolvedValue(0);
  db.safetyCheck.updateMany.mockResolvedValue({ count: 0 });
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
      data: { changed: ["name", "programme"], safetyCheckOutdated: false },
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
    expect(db.booking.count).not.toHaveBeenCalled();
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
      data: { changed: [], safetyCheckOutdated: false },
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
    "SCRUM-25 [AC2] TC-25-05: changing %s makes a requested safety check Outdated",
    async (field) => {
      db.safetyCheck.updateMany.mockResolvedValue({ count: 1 });

      const result = await updateEventDetails({ ...unchanged, [field]: "Changed" });

      expect(result).toEqual({
        ok: true,
        data: { changed: [field], safetyCheckOutdated: true },
      });
      expect(db.safetyCheck.updateMany).toHaveBeenCalledWith({
        where: {
          eventId: "evt_1",
          status: { in: ["AWAITING_REVIEW", "APPROVED", "CHANGES_REQUESTED"] },
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
    expect(db.booking.count).toHaveBeenCalledWith({
      where: {
        eventId: "evt_1",
        OR: [
          { status: { in: ["PENDING", "APPROVED"] } },
          { status: "HELD", holdExpiresAt: { gt: expect.any(Date) } },
        ],
      },
    });
    expect(db.reservation.count).toHaveBeenCalledWith({
      where: { eventId: "evt_1", status: "CONFIRMED" },
    });
    expect(db.event.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ startAt: later, expectedAttendance: 150 }),
      }),
    );
  });

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

  it.each([
    ["a venue booking", 1, 0],
    ["an equipment reservation", 0, 1],
  ])(
    "SCRUM-25 [AC3] TC-25-06: with %s, changing the attendance is refused and nothing is written",
    async (_, bookings, reservations) => {
      db.booking.count.mockResolvedValue(bookings);
      db.reservation.count.mockResolvedValue(reservations);

      expect(
        await updateEventDetails({ ...unchanged, expectedAttendance: 200, name: "New" }),
      ).toEqual({
        ok: false,
        error:
          "Expected attendance can't be changed while the event has a venue booking or an equipment reservation: it would leave them out of date. Nothing was saved.",
        fieldErrors: {
          expectedAttendance: [
            "Can't change while the event has a venue booking or an equipment reservation.",
          ],
        },
      });
      expect(db.event.updateMany).not.toHaveBeenCalled();
      expect(db.auditLog.createMany).not.toHaveBeenCalled();
    },
  );

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

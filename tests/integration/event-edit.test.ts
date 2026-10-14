import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterAll,
  type Mock,
} from "vitest";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  addOperationalNote,
  getOperationalNotes,
  updateEventDetails,
} from "@/app/(app)/events/edit-actions";
import { createPlanningEvents, removeEvents } from "./test-events";

// SCRUM-25 against a real, seeded Postgres: the edit and its audit, the
// safety check going out of date, the row lock that keeps an edit and a
// booking made at the same moment apart, and notes the database keeps
// permanently. Only the session is mocked. These WRITE (throwaway events,
// removed afterwards), so they only run against a localhost database.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
const mockAuth = auth as unknown as Mock;

const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

const session = (
  id: string,
  role: "COORDINATOR" | "VENUE_STAFF" | "ORGANISER",
): Session => ({
  user: { id, role, name: id, email: `${id}@test.local` },
  expires: "2999-01-01T00:00:00.000Z",
});
const COORDINATOR = session("usr_coordinator", "COORDINATOR");
const VENUE_STAFF = session("usr_venuestaff", "VENUE_STAFF");
const ORGANISER = session("usr_organiser", "ORGANISER");

const START = new Date("2036-06-02T02:00:00.000Z");
const END = new Date("2036-06-02T06:00:00.000Z");

describe.skipIf(!usesLocalDatabase)("editing an event's details — real database (SCRUM-25)", () => {
  const eventIds: string[] = [];

  async function planningEvent(): Promise<string> {
    const [id] = await createPlanningEvents("SCRUM-25", [
      { startAt: START, endAt: END, expectedAttendance: 80 },
    ]);
    eventIds.push(id);
    return id;
  }

  async function formFor(eventId: string) {
    const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
    return {
      eventId,
      name: event.name,
      purpose: event.purpose ?? "",
      description: event.description ?? "",
      accessibilityNeeds: event.accessibilityNeeds ?? "",
      preferredLayout: event.preferredLayout ?? "",
      registrationNotes: event.registrationNotes ?? "",
      programme: event.programme ?? "",
      specialRequests: event.specialRequests ?? "",
      startAt: event.startAt!.toISOString(),
      endAt: event.endAt!.toISOString(),
      expectedAttendance: event.expectedAttendance!,
      venueRequirements: event.venueRequirements ?? "",
      equipmentRequirements: event.equipmentRequirements ?? "",
    };
  }

  beforeEach(() => mockAuth.mockResolvedValue(COORDINATOR));

  afterAll(async () => {
    await prisma.safetyCheck.deleteMany({ where: { eventId: { in: eventIds } } });
    // Deleting the event takes its permanent notes with it (the trigger lets
    // the cascade through).
    await removeEvents(eventIds);
  });

  it("SCRUM-25 [AC1, AC2] TC-25-01, TC-25-04: a routine edit is saved and audited; the status and the booking's flag don't change", async () => {
    const eventId = await planningEvent();
    const booking = await prisma.booking.create({
      data: {
        eventId,
        venueId: "ven_hall",
        startAt: START,
        endAt: END,
        status: "APPROVED",
        requestedById: "usr_coordinator",
      },
    });

    const result = await updateEventDetails({
      ...(await formFor(eventId)),
      programme: "Doors 9am",
    });

    expect(result).toMatchObject({ ok: true, data: { changed: ["programme"] } });
    const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
    expect(event).toMatchObject({ status: "PLANNING", programme: "Doors 9am" });
    expect(
      await prisma.auditLog.findMany({
        where: { entityType: "Event", entityId: eventId, action: "UPDATED" },
        select: { fieldName: true, oldValue: true, newValue: true, actorId: true },
      }),
    ).toEqual([
      { fieldName: "programme", oldValue: null, newValue: "Doors 9am", actorId: "usr_coordinator" },
    ]);
    expect(
      await prisma.booking.findUniqueOrThrow({
        where: { id: booking.id },
        select: { status: true, needsReconsideration: true },
      }),
    ).toEqual({ status: "APPROVED", needsReconsideration: false });
  });

  it("SCRUM-25 [AC2] TC-25-05: a layout change makes a requested safety check Outdated, and leaves a Rejected or Changes requested one alone", async () => {
    const eventId = await planningEvent();
    const awaiting = await prisma.safetyCheck.create({
      data: { eventId, requestedById: "usr_coordinator" },
    });
    const rejected = await prisma.safetyCheck.create({
      data: {
        eventId,
        requestedById: "usr_coordinator",
        status: "REJECTED",
        note: "Fire exits blocked.",
        decidedById: "usr_coordinator",
        decidedAt: new Date(),
      },
    });
    // SCRUM-166 AC13: only Approved or awaiting review goes out of date.
    const changesRequested = await prisma.safetyCheck.create({
      data: {
        eventId,
        requestedById: "usr_coordinator",
        status: "CHANGES_REQUESTED",
        note: "Move the stage away from the exit.",
        decidedById: "usr_coordinator",
        decidedAt: new Date(),
      },
    });

    const result = await updateEventDetails({
      ...(await formFor(eventId)),
      preferredLayout: "banquet",
    });

    expect(result).toMatchObject({ ok: true, data: { safetyCheckOutdated: true } });
    const checks = await prisma.safetyCheck.findMany({
      where: { id: { in: [awaiting.id, rejected.id, changesRequested.id] } },
      select: { id: true, status: true, outdatedAt: true },
    });
    expect(checks.find((c) => c.id === awaiting.id)).toMatchObject({
      status: "OUTDATED",
      outdatedAt: expect.any(Date),
    });
    expect(checks.find((c) => c.id === rejected.id)).toMatchObject({
      status: "REJECTED",
      outdatedAt: null,
    });
    expect(checks.find((c) => c.id === changesRequested.id)).toMatchObject({
      status: "CHANGES_REQUESTED",
      outdatedAt: null,
    });
  });

  it("SCRUM-25 [AC3] TC-25-06: with nothing booked the date moves; with an approved booking the attendance is refused and stays", async () => {
    const free = await planningEvent();
    const moved = new Date("2036-06-09T02:00:00.000Z");
    expect(
      await updateEventDetails({
        ...(await formFor(free)),
        startAt: moved.toISOString(),
        endAt: new Date("2036-06-09T06:00:00.000Z").toISOString(),
      }),
    ).toMatchObject({ ok: true });
    expect(
      (await prisma.event.findUniqueOrThrow({ where: { id: free } })).startAt,
    ).toEqual(moved);

    const booked = await planningEvent();
    await prisma.booking.create({
      data: {
        eventId: booked,
        venueId: "ven_hall",
        startAt: START,
        endAt: END,
        status: "PENDING",
        requestedById: "usr_coordinator",
      },
    });
    const refused = await updateEventDetails({
      ...(await formFor(booked)),
      expectedAttendance: 120,
    });
    expect(refused.ok).toBe(false);
    expect(
      (await prisma.event.findUniqueOrThrow({ where: { id: booked } }))
        .expectedAttendance,
    ).toBe(80);
  });

  it("SCRUM-25 [AC3] TC-25-13: a booking made at the same moment as a date change is waited for, then the change is refused", async () => {
    const eventId = await planningEvent();
    const form = await formFor(eventId);

    // A booking insert holds a key-share lock on the event row until it
    // commits; the edit's FOR UPDATE must wait for it, then see the booking.
    let commit!: () => void;
    const committed = new Promise<void>((resolve) => (commit = resolve));
    let inserted!: () => void;
    const insertDone = new Promise<void>((resolve) => (inserted = resolve));
    const booking = prisma.$transaction(
      async (tx) => {
        await tx.booking.create({
          data: {
            eventId,
            venueId: "ven_auditorium",
            startAt: START,
            endAt: END,
            status: "PENDING",
            requestedById: "usr_coordinator",
          },
        });
        inserted();
        await committed;
      },
      { timeout: 20_000 },
    );
    await insertDone;

    const edit = updateEventDetails({
      ...form,
      expectedAttendance: 99,
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
    commit();
    await booking;

    expect((await edit).ok).toBe(false);
    expect(
      (await prisma.event.findUniqueOrThrow({ where: { id: eventId } }))
        .expectedAttendance,
    ).toBe(80);
  });

  /**
   * A Planning event with one hold at `venueId`, expiring at `expiresAt`. Any
   * booking written at a venue marks its lapsed holds Expired (the
   * booking_overlaps_unavailability trigger), so a lapsed hold that must stay
   * Held needs a venue of its own.
   */
  async function eventWithHold(
    venueId: string,
    day: string,
    expiresAt: Date,
  ): Promise<string> {
    const startAt = new Date(`${day}T02:00:00.000Z`);
    const endAt = new Date(`${day}T06:00:00.000Z`);
    const [eventId] = await createPlanningEvents("SCRUM-25 hold", [
      { startAt, endAt, expectedAttendance: 80 },
    ]);
    eventIds.push(eventId);
    await prisma.booking.create({
      data: {
        eventId,
        venueId,
        startAt,
        endAt,
        status: "HELD",
        heldAt: new Date(expiresAt.getTime() - 60 * 60_000),
        holdExpiresAt: expiresAt,
        holdNote: "Confirm the headcount.",
        requestedById: "usr_coordinator",
      },
    });
    return eventId;
  }

  it("SCRUM-25 [AC3, AC6] TC-25-06, TC-25-10: a hold past its expiry no longer counts as a booking; one still live does", async () => {
    const lapsed = await eventWithHold(
      "ven_boardroom",
      "2036-06-09",
      new Date(Date.now() - 60_000),
    );
    const live = await eventWithHold(
      "ven_auditorium",
      "2036-06-16",
      new Date("2036-06-01T00:00:00.000Z"),
    );
    // Lapsed but not yet marked Expired: the case the booking flow's count is for.
    expect(
      await prisma.booking.findFirstOrThrow({
        where: { eventId: lapsed },
        select: { status: true },
      }),
    ).toEqual({ status: "HELD" });

    // AC3: the lapsed hold doesn't stop the attendance changing; the live one does.
    expect(
      await updateEventDetails({ ...(await formFor(lapsed)), expectedAttendance: 90 }),
    ).toMatchObject({ ok: true, data: { changed: ["expectedAttendance"] } });
    expect(
      await updateEventDetails({ ...(await formFor(live)), expectedAttendance: 90 }),
    ).toMatchObject({ ok: false });
    expect(
      (await prisma.event.findUniqueOrThrow({ where: { id: live } })).expectedAttendance,
    ).toBe(80);

    // AC6: Venue Staff may add a note only through the live hold.
    mockAuth.mockResolvedValue(VENUE_STAFF);
    expect(await addOperationalNote({ eventId: lapsed, body: "Room ready." })).toEqual({
      ok: false,
      error: "Event not found.",
    });
    expect(await prisma.eventOperationalNote.count({ where: { eventId: lapsed } })).toBe(0);
    expect(await addOperationalNote({ eventId: live, body: "Room ready." })).toMatchObject({
      ok: true,
    });
  });

  it("SCRUM-25 [AC3] TC-25-15: changing the equipment requirements clears a No equipment needed decision; a routine change keeps it", async () => {
    const eventId = await planningEvent();
    const decidedAt = new Date("2026-10-01T02:00:00.000Z");
    await prisma.event.update({
      where: { id: eventId },
      data: { noEquipmentNeededAt: decidedAt, noEquipmentNeededById: "usr_coordinator" },
    });
    const decision = () =>
      prisma.event.findUniqueOrThrow({
        where: { id: eventId },
        select: { noEquipmentNeededAt: true, noEquipmentNeededById: true },
      });

    await updateEventDetails({ ...(await formFor(eventId)), programme: "Doors 9am" });
    expect(await decision()).toEqual({
      noEquipmentNeededAt: decidedAt,
      noEquipmentNeededById: "usr_coordinator",
    });

    expect(
      await updateEventDetails({
        ...(await formFor(eventId)),
        equipmentRequirements: "Two lapel mics",
      }),
    ).toMatchObject({ ok: true });
    expect(await decision()).toEqual({
      noEquipmentNeededAt: null,
      noEquipmentNeededById: null,
    });
  });

  it("SCRUM-25 [AC7] TC-25-08, TC-25-12: once the event is reassigned, its previous Coordinator can't edit it or add a note, and nothing is written", async () => {
    const eventId = await planningEvent();
    await prisma.event.update({
      where: { id: eventId },
      data: { coordinatorId: "usr_coordinator_2" },
    });
    const before = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });

    expect(
      await updateEventDetails({ ...(await formFor(eventId)), name: "Renamed" }),
    ).toEqual({ ok: false, error: "Event not found." });
    expect(await addOperationalNote({ eventId, body: "Still mine?" })).toEqual({
      ok: false,
      error: "Event not found.",
    });

    expect(await prisma.event.findUniqueOrThrow({ where: { id: eventId } })).toEqual(
      before,
    );
    expect(
      await prisma.auditLog.count({ where: { entityType: "Event", entityId: eventId } }),
    ).toBe(0);
    expect(await prisma.eventOperationalNote.count({ where: { eventId } })).toBe(0);
  });

  describe("operational notes — AC6", () => {
    it("SCRUM-25 [AC6] TC-25-09, TC-25-10: the Coordinator and Venue Staff (once there is a booking) add notes; the Organiser reads them with author and time", async () => {
      const eventId = await planningEvent();

      mockAuth.mockResolvedValue(VENUE_STAFF);
      expect(
        await addOperationalNote({ eventId, body: "Before any booking." }),
      ).toEqual({ ok: false, error: "Event not found." });

      await prisma.booking.create({
        data: {
          eventId,
          venueId: "ven_hall",
          startAt: START,
          endAt: END,
          status: "PENDING",
          requestedById: "usr_coordinator",
        },
      });
      expect(
        (await addOperationalNote({ eventId, body: "Hall cleaned and ready." })).ok,
      ).toBe(true);

      mockAuth.mockResolvedValue(COORDINATOR);
      expect(
        (await addOperationalNote({ eventId, body: "Signage ordered." })).ok,
      ).toBe(true);

      mockAuth.mockResolvedValue(ORGANISER);
      const read = await getOperationalNotes(eventId);
      expect(read).toMatchObject({ ok: true, data: { canAdd: false } });
      if (read.ok) {
        expect(read.data.notes.map((n) => n.body)).toEqual([
          "Hall cleaned and ready.",
          "Signage ordered.",
        ]);
        expect(read.data.notes[0].authorName).toBeTruthy();
        expect(read.data.notes[0].createdAt).toBeInstanceOf(Date);
      }
    });

    it("SCRUM-25 [AC6] TC-25-11: the database refuses to edit or delete a note, or store a blank one", async () => {
      const eventId = await planningEvent();
      const added = await addOperationalNote({ eventId, body: "Keep this." });
      if (!added.ok) throw new Error(added.error);

      await expect(
        prisma.eventOperationalNote.update({
          where: { id: added.data.id },
          data: { body: "Changed" },
        }),
      ).rejects.toThrow(/event_operational_note_permanent|cannot be edited or deleted/);
      await expect(
        prisma.eventOperationalNote.delete({ where: { id: added.data.id } }),
      ).rejects.toThrow(/event_operational_note_permanent|cannot be edited or deleted/);
      await expect(
        prisma.eventOperationalNote.create({
          data: { eventId, authorId: "usr_coordinator", body: "  " },
        }),
      ).rejects.toThrow(/event_operational_note_not_blank/);
      expect(
        await prisma.eventOperationalNote.findUniqueOrThrow({
          where: { id: added.data.id },
        }),
      ).toMatchObject({ body: "Keep this." });
    });
  });
});

import { describe, it, expect, vi, afterAll, type Mock } from "vitest";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { updateEventDetails } from "@/app/(app)/events/edit-actions";
import { createPlanningEvents, removeEvents } from "./test-events";

// SCRUM-247 against a real, seeded Postgres: a Coordinator's direct edit
// can't lower an event's expected attendance below its active registrations,
// counted under the event-row lock a registration also takes (SCRUM-73). Only
// the session is mocked. These WRITE (throwaway events and registrations,
// removed afterwards), so they only run against a localhost database.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
const mockAuth = auth as unknown as Mock;

const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

const COORDINATOR: Session = {
  user: {
    id: "usr_coordinator",
    role: "COORDINATOR",
    name: "usr_coordinator",
    email: "usr_coordinator@test.local",
  },
  expires: "2999-01-01T00:00:00.000Z",
};

const START = new Date("2036-07-07T02:00:00.000Z");
const END = new Date("2036-07-07T06:00:00.000Z");
const ATTENDEES = [
  "usr_attendee",
  "usr_attendee_2",
  "usr_attendee_3",
  "usr_attendee_4",
];

describe.skipIf(!usesLocalDatabase)(
  "expected attendance against active registrations — real database (SCRUM-247)",
  () => {
    const eventIds: string[] = [];

    /**
     * A Planning event for 10 people, as one re-planned after an approved
     * change keeps its registrations (SCRUM-128 AC5): one per status given.
     */
    async function replannedEvent(
      statuses: ("REGISTERED" | "WITHDRAWN")[],
    ): Promise<string> {
      const [eventId] = await createPlanningEvents("SCRUM-247", [
        { startAt: START, endAt: END, expectedAttendance: 10 },
      ]);
      eventIds.push(eventId);
      await prisma.registration.createMany({
        data: statuses.map((status, i) => ({
          eventId,
          userId: ATTENDEES[i],
          status,
          withdrawnAt: status === "WITHDRAWN" ? new Date() : null,
        })),
      });
      return eventId;
    }

    async function editAttendance(eventId: string, expectedAttendance: number) {
      const event = await prisma.event.findUniqueOrThrow({
        where: { id: eventId },
      });
      return updateEventDetails({
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
        expectedAttendance,
        venueRequirements: event.venueRequirements ?? "",
        equipmentRequirements: event.equipmentRequirements ?? "",
      });
    }

    const attendanceOf = async (eventId: string) =>
      (await prisma.event.findUniqueOrThrow({ where: { id: eventId } }))
        .expectedAttendance;
    const auditsOf = (eventId: string) =>
      prisma.auditLog.count({
        where: { entityId: eventId, fieldName: "expectedAttendance" },
      });

    afterAll(async () => {
      await prisma.registration.deleteMany({
        where: { eventId: { in: eventIds } },
      });
      await removeEvents(eventIds);
    });

    it("SCRUM-247 [AC1] TC-247-01, TC-247-02: with 3 registered and 1 withdrawn, 2 is refused with nothing written and 3 is saved", async () => {
      mockAuth.mockResolvedValue(COORDINATOR);
      const eventId = await replannedEvent([
        "REGISTERED",
        "REGISTERED",
        "REGISTERED",
        "WITHDRAWN",
      ]);

      const refused = await editAttendance(eventId, 2);
      expect(refused).toEqual({
        ok: false,
        error:
          "This event has 3 active registrations, so the expected attendance can't be lower than 3.",
        fieldErrors: {
          expectedAttendance: [
            "This event has 3 active registrations, so the expected attendance can't be lower than 3.",
          ],
        },
      });
      expect(await attendanceOf(eventId)).toBe(10);
      expect(await auditsOf(eventId)).toBe(0);

      // The withdrawn registration holds no place (SCRUM-70 AC4).
      const saved = await editAttendance(eventId, 3);
      expect(saved).toMatchObject({
        ok: true,
        data: { changed: ["expectedAttendance"] },
      });
      expect(await attendanceOf(eventId)).toBe(3);
      expect(await auditsOf(eventId)).toBe(1);
    });

    it("SCRUM-247 [AC2] TC-247-03: a registration made at the same moment is waited for and counted, so the edit is refused", async () => {
      mockAuth.mockResolvedValue(COORDINATOR);
      const eventId = await replannedEvent(["REGISTERED", "REGISTERED"]);

      // A registration locks the event row and then inserts (SCRUM-73); this
      // one holds the lock until told to commit. Lowering to 2 would save
      // against the 2 registrations already there.
      let commit!: () => void;
      const committed = new Promise<void>((resolve) => (commit = resolve));
      let locked!: () => void;
      const lockHeld = new Promise<void>((resolve) => (locked = resolve));
      const registration = prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`;
          await tx.registration.create({
            data: { eventId, userId: ATTENDEES[2], status: "REGISTERED" },
          });
          locked();
          await committed;
        },
        { timeout: 20_000 },
      );
      await lockHeld;

      const edit = editAttendance(eventId, 2);
      await new Promise((resolve) => setTimeout(resolve, 300));
      commit();
      await registration;

      expect(await edit).toMatchObject({
        ok: false,
        error:
          "This event has 3 active registrations, so the expected attendance can't be lower than 3.",
      });
      expect(await attendanceOf(eventId)).toBe(10);
      expect(
        await prisma.registration.count({
          where: { eventId, status: "REGISTERED" },
        }),
      ).toBe(3);
    });
  },
);

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
import { submitEventRequest } from "@/app/(app)/events/actions";
import { updateEventDetails } from "@/app/(app)/events/edit-actions";
import { getBrowsableEvent } from "@/app/(app)/events/queries";
import { registerForEvent } from "@/app/(app)/events/registration-actions";

// SCRUM-171 against a real, seeded Postgres: Registration needed is stored
// from the request form, an event that doesn't need registration takes none
// and can't be opened by an Attendee, and it can't be changed to No while
// people are registered.
//
// These WRITE (events made here, with their registrations, removed
// afterwards), so they only run against a localhost database — CI's service
// container, or the Docker DB — never against the shared Supabase database.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const mockAuth = auth as unknown as Mock;

const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

function sessionFor(
  id: string,
  role: "ORGANISER" | "COORDINATOR" | "ATTENDEE",
): Session {
  return {
    user: { id, role, name: id, email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  };
}

const START = new Date("2034-05-10T02:00:00.000Z");
const END = new Date("2034-05-10T06:00:00.000Z");
const PREFIX = "IT-171";

describe.skipIf(!usesLocalDatabase)(
  "Registration needed (SCRUM-171) — real database",
  () => {
    const made: string[] = [];

    async function event(data: Record<string, unknown>) {
      const row = await prisma.event.create({
        data: {
          name: `${PREFIX} ${made.length + 1} ${Date.now()}`,
          status: "CONFIRMED",
          organiserId: "usr_organiser",
          coordinatorId: "usr_coordinator",
          startAt: START,
          endAt: END,
          expectedAttendance: 10,
          registrationEnabled: true,
          ...data,
        },
        select: { id: true },
      });
      made.push(row.id);
      return row.id;
    }

    beforeEach(() => mockAuth.mockReset());

    afterAll(async () => {
      const ids = [
        ...made,
        ...(
          await prisma.event.findMany({
            where: { name: { startsWith: PREFIX } },
            select: { id: true },
          })
        ).map((e) => e.id),
      ];
      await prisma.registration.deleteMany({ where: { eventId: { in: ids } } });
      await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
      await prisma.notification.deleteMany({ where: { eventId: { in: ids } } });
      await prisma.event.deleteMany({ where: { id: { in: ids } } });
    });

    it("SCRUM-171 [AC1, AC2] TC-171-01: a submitted request stores Registration needed No, with no note", async () => {
      mockAuth.mockResolvedValue(sessionFor("usr_organiser", "ORGANISER"));

      const result = await submitEventRequest({
        name: `${PREFIX} Board Meeting ${Date.now()}`,
        purpose: "Quarterly review",
        description: "Closed meeting for the board.",
        startAt: START.toISOString(),
        endAt: END.toISOString(),
        expectedAttendance: 12,
        venueRequirements: "Boardroom",
        accessibilityNeeds: "Step-free access",
        preferredLayout: "Boardroom",
        equipmentRequirements: "Video conferencing",
        registrationRequired: "no",
        registrationNotes: "",
      });

      expect(result.ok).toBe(true);
      const stored = await prisma.event.findUniqueOrThrow({
        where: { id: result.ok ? result.data.id : "" },
        select: { registrationRequired: true, registrationNotes: true },
      });
      expect(stored).toEqual({
        registrationRequired: false,
        registrationNotes: null,
      });
    });

    it("SCRUM-171 [AC4] TC-171-07: registering for a Confirmed event that doesn't need registration is refused, and nothing is written", async () => {
      // Even with registration left enabled, the answer No decides.
      const id = await event({ registrationRequired: false });
      mockAuth.mockResolvedValue(sessionFor("usr_attendee_4", "ATTENDEE"));

      await expect(registerForEvent({ eventId: id })).resolves.toEqual({
        ok: false,
        error: "This event is not open for registration.",
      });
      expect(await prisma.registration.count({ where: { eventId: id } })).toBe(
        0,
      );
    });

    it.each([
      ["Yes", true],
      ["unanswered", null],
    ])(
      "SCRUM-171 [AC4] TC-171-07: an event whose Registration needed is %s still takes registrations",
      async (_, registrationRequired) => {
        const id = await event({ registrationRequired });
        mockAuth.mockResolvedValue(sessionFor("usr_attendee_4", "ATTENDEE"));

        const result = await registerForEvent({ eventId: id });

        expect(result.ok).toBe(true);
        expect(
          await prisma.registration.count({
            where: { eventId: id, status: "REGISTERED" },
          }),
        ).toBe(1);
      },
    );

    it("SCRUM-171 [AC4] TC-171-06: an Attendee can't open an event that doesn't need registration by its URL; one that does, they can", async () => {
      const notNeeded = await event({ registrationRequired: false });
      const needed = await event({ registrationRequired: true });
      mockAuth.mockResolvedValue(sessionFor("usr_attendee", "ATTENDEE"));

      expect(await getBrowsableEvent(notNeeded)).toBeNull();
      expect((await getBrowsableEvent(needed))?.id).toBe(needed);
    });

    it("SCRUM-171 [AC5] TC-171-08: with someone registered, changing it to No is refused with the number shown, and nothing changes", async () => {
      // A Confirmed event returned to Planning keeps its registrations
      // (SCRUM-26 AC10, SCRUM-128 AC5); only then can it be edited.
      const id = await event({
        status: "PLANNING",
        registrationRequired: true,
      });
      await prisma.registration.createMany({
        data: [
          { eventId: id, userId: "usr_attendee", status: "REGISTERED" },
          { eventId: id, userId: "usr_attendee_2", status: "REGISTERED" },
          // A withdrawn registration isn't active, so it isn't counted.
          { eventId: id, userId: "usr_attendee_3", status: "WITHDRAWN" },
        ],
      });
      mockAuth.mockResolvedValue(sessionFor("usr_coordinator", "COORDINATOR"));
      const row = await prisma.event.findUniqueOrThrow({ where: { id } });

      const result = await updateEventDetails({
        eventId: id,
        name: row.name,
        startAt: START.toISOString(),
        endAt: END.toISOString(),
        expectedAttendance: 10,
        registrationRequired: "no",
      });

      const message =
        "This event has 2 active registrations, so Registration needed can't be changed to No.";
      expect(result).toEqual({
        ok: false,
        error: message,
        fieldErrors: { registrationRequired: [message] },
      });
      expect(
        (await prisma.event.findUniqueOrThrow({ where: { id } }))
          .registrationRequired,
      ).toBe(true);
      expect(
        await prisma.auditLog.count({
          where: { entityId: id, fieldName: "registrationRequired" },
        }),
      ).toBe(0);
    });

    it("SCRUM-171 [AC5] TC-171-08: with only withdrawn registrations, changing it to No is saved", async () => {
      const id = await event({
        status: "PLANNING",
        registrationRequired: true,
      });
      await prisma.registration.create({
        data: { eventId: id, userId: "usr_attendee_3", status: "WITHDRAWN" },
      });
      mockAuth.mockResolvedValue(sessionFor("usr_coordinator", "COORDINATOR"));
      const row = await prisma.event.findUniqueOrThrow({ where: { id } });

      const result = await updateEventDetails({
        eventId: id,
        name: row.name,
        startAt: START.toISOString(),
        endAt: END.toISOString(),
        expectedAttendance: 10,
        registrationRequired: "no",
      });

      expect(result.ok).toBe(true);
      expect(
        (await prisma.event.findUniqueOrThrow({ where: { id } }))
          .registrationRequired,
      ).toBe(false);
    });
  },
);

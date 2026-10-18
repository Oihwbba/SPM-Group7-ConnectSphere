import { describe, it, expect, vi, beforeEach, afterAll, type Mock } from "vitest";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { confirmEvent } from "@/app/(app)/events/actions";
import { getBrowsableEvent } from "@/app/(app)/events/queries";
import {
  registerForEvent,
  withdrawRegistration,
} from "@/app/(app)/events/registration-actions";

// SCRUM-85 against a real Postgres: only the session is mocked, and the
// readiness checklist (SCRUM-110, tested on its own) is taken as complete.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/event-readiness", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/event-readiness")>()),
  getReadinessChecklist: vi.fn().mockResolvedValue({ ready: true, items: [] }),
}));
const mockAuth = auth as unknown as Mock;

const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

function sessionFor(id: string, role: "COORDINATOR" | "ATTENDEE"): Session {
  return {
    user: { id, role, name: id, email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  };
}

const coordinator = sessionFor("usr_coordinator", "COORDINATOR");
const stays = sessionFor("usr_attendee_4", "ATTENDEE");
const leaves = sessionFor("usr_attendee_3", "ATTENDEE");
const PREFIX = "IT-85";

describe.skipIf(!usesLocalDatabase)(
  "Attendees kept informed (SCRUM-85) — real database",
  () => {
    async function plannedEvent(day: string) {
      const startAt = new Date(`${day}T02:00:00.000Z`);
      const endAt = new Date(`${day}T06:00:00.000Z`);
      const event = await prisma.event.create({
        data: {
          name: `${PREFIX} ${Date.now()} ${Math.random()}`,
          status: "PLANNING",
          organiserId: "usr_organiser",
          coordinatorId: "usr_coordinator",
          startAt,
          endAt,
          expectedAttendance: 10,
          registrationRequired: true,
        },
        select: { id: true },
      });
      await prisma.booking.create({
        data: {
          eventId: event.id,
          venueId: "ven_seminar",
          startAt,
          endAt,
          status: "APPROVED",
          requestedById: "usr_coordinator",
        },
      });
      return event.id;
    }

    const notices = (eventId: string, type: string) =>
      prisma.notification.findMany({
        where: { eventId, type: type as never },
        select: { userId: true, message: true },
        orderBy: { userId: "asc" },
      });

    beforeEach(() => mockAuth.mockReset());

    afterAll(async () => {
      const ids = (
        await prisma.event.findMany({
          where: { name: { startsWith: PREFIX } },
          select: { id: true },
        })
      ).map((e) => e.id);
      const bookingIds = (
        await prisma.booking.findMany({
          where: { eventId: { in: ids } },
          select: { id: true },
        })
      ).map((b) => b.id);
      await prisma.registration.deleteMany({ where: { eventId: { in: ids } } });
      await prisma.notification.deleteMany({ where: { eventId: { in: ids } } });
      await prisma.auditLog.deleteMany({
        where: { entityId: { in: [...ids, ...bookingIds] } },
      });
      await prisma.booking.deleteMany({ where: { eventId: { in: ids } } });
      await prisma.event.deleteMany({ where: { id: { in: ids } } });
    });

    it("SCRUM-85 [AC2, AC3, AC5, AC9, AC11] TC-85-02, TC-85-07: re-planned with a new date, then confirmed again, each Attendee still registered is told once and stays registered", async () => {
      const id = await plannedEvent("2034-08-21");
      mockAuth.mockResolvedValue(coordinator);
      expect((await confirmEvent({ eventId: id })).ok).toBe(true);

      mockAuth.mockResolvedValue(stays);
      expect((await registerForEvent({ eventId: id })).ok).toBe(true);
      mockAuth.mockResolvedValue(leaves);
      const left = await registerForEvent({ eventId: id });
      expect(left.ok).toBe(true);
      expect(
        (await withdrawRegistration({ registrationId: left.ok ? left.data.id : "" })).ok,
      ).toBe(true);

      // Back in Planning (as SCRUM-26 or SCRUM-128 would leave it), moved a day.
      const movedStart = new Date("2034-08-22T02:00:00.000Z");
      const movedEnd = new Date("2034-08-22T06:00:00.000Z");
      await prisma.event.update({
        where: { id },
        data: { status: "PLANNING", startAt: movedStart, endAt: movedEnd },
      });
      await prisma.booking.updateMany({
        where: { eventId: id },
        data: { startAt: movedStart, endAt: movedEnd },
      });

      // AC9: the registered Attendee still opens it, seeing what was confirmed.
      mockAuth.mockResolvedValue(stays);
      expect(await getBrowsableEvent(id)).toMatchObject({
        status: "PLANNING",
        confirmedStartAt: new Date("2034-08-21T02:00:00.000Z"),
        confirmedVenues: ["Seminar Room 2.1 — Level 2, Block B"],
      });
      mockAuth.mockResolvedValue(leaves);
      expect(await getBrowsableEvent(id)).toBeNull();

      // AC2, AC6: two confirmations at once still tell each Attendee once.
      mockAuth.mockResolvedValue(coordinator);
      await Promise.all([confirmEvent({ eventId: id }), confirmEvent({ eventId: id })]);

      const changed = await notices(id, "REGISTERED_EVENT_CHANGED");
      expect(changed.map((n) => n.userId)).toEqual(["usr_attendee_4"]);
      expect(changed[0].message).toContain("Seminar Room 2.1");
      expect(changed[0].message).toContain("22 Aug 2034");
      // AC3: the registration stands.
      expect(
        await prisma.registration.findFirstOrThrow({
          where: { eventId: id, userId: "usr_attendee_4" },
          select: { status: true },
        }),
      ).toEqual({ status: "REGISTERED" });
      expect(
        await prisma.event.findUniqueOrThrow({
          where: { id },
          select: { confirmedStartAt: true },
        }),
      ).toEqual({ confirmedStartAt: movedStart });
    });

    it("SCRUM-85 [AC1, AC6] TC-85-01: an Attendee registering twice at the same moment gets one registration and one confirmation", async () => {
      const id = await plannedEvent("2034-08-28");
      mockAuth.mockResolvedValue(coordinator);
      expect((await confirmEvent({ eventId: id })).ok).toBe(true);

      mockAuth.mockResolvedValue(stays);
      const results = await Promise.all([
        registerForEvent({ eventId: id }),
        registerForEvent({ eventId: id }),
      ]);

      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(await notices(id, "REGISTRATION_CONFIRMED")).toEqual([
        {
          userId: "usr_attendee_4",
          message: expect.stringContaining("You're registered for"),
        },
      ]);
    });
  },
);

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
import { confirmEvent } from "@/app/(app)/events/actions";
import { getBrowsableEvent } from "@/app/(app)/events/queries";
import { registerForEvent } from "@/app/(app)/events/registration-actions";
import {
  closeRegistration,
  reopenRegistration,
} from "@/app/(app)/events/registration-control-actions";

// SCRUM-75 against a real, seeded Postgres: closing registration stops
// registrations at once while the event stays listed, reopening lets them in
// until the start, a close and a registration at the same moment take turns,
// and a close survives the event returning to Planning and being confirmed
// again (AC9).
//
// These WRITE (events made here, with their registrations, removed
// afterwards), so they only run against a localhost database — CI's service
// container, or the Docker DB — never against the shared Supabase database.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// Confirming needs a complete readiness checklist (SCRUM-110), which isn't
// what AC9 is about; everything else confirmEvent does runs for real.
vi.mock("@/lib/event-readiness", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/event-readiness")>()),
  getReadinessChecklist: vi.fn().mockResolvedValue({ ready: true, items: [] }),
}));
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

const organiser = sessionFor("usr_organiser", "ORGANISER");
const coordinator = sessionFor("usr_coordinator", "COORDINATOR");
const attendee = sessionFor("usr_attendee_4", "ATTENDEE");

const START = new Date("2034-07-10T02:00:00.000Z");
const END = new Date("2034-07-10T06:00:00.000Z");
const PREFIX = "IT-75";

describe.skipIf(!usesLocalDatabase)(
  "Registration period (SCRUM-75) — real database",
  () => {
    async function event(data: Record<string, unknown> = {}) {
      return (
        await prisma.event.create({
          data: {
            name: `${PREFIX} ${Date.now()} ${Math.random()}`,
            status: "CONFIRMED",
            organiserId: "usr_organiser",
            coordinatorId: "usr_coordinator",
            startAt: START,
            endAt: END,
            expectedAttendance: 10,
            registrationRequired: true,
            registrationEnabled: true,
            ...data,
          },
          select: { id: true },
        })
      ).id;
    }

    async function register(eventId: string) {
      mockAuth.mockResolvedValue(attendee);
      return registerForEvent({ eventId });
    }

    const registrations = (eventId: string) =>
      prisma.registration.count({ where: { eventId, status: "REGISTERED" } });

    beforeEach(() => mockAuth.mockReset());

    afterAll(async () => {
      const ids = (
        await prisma.event.findMany({
          where: { name: { startsWith: PREFIX } },
          select: { id: true },
        })
      ).map((e) => e.id);
      await prisma.registration.deleteMany({ where: { eventId: { in: ids } } });
      await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
      await prisma.notification.deleteMany({ where: { eventId: { in: ids } } });
      await prisma.event.deleteMany({ where: { id: { in: ids } } });
    });

    it("SCRUM-75 [AC6] TC-75-06: once the Organiser closes registration, a registration is refused and nothing is written, but the event is still listed", async () => {
      const id = await event();
      mockAuth.mockResolvedValue(organiser);
      expect((await closeRegistration({ eventId: id })).ok).toBe(true);

      expect(await register(id)).toEqual({
        ok: false,
        error: "Registration for this event is not currently open.",
      });
      expect(await prisma.registration.count({ where: { eventId: id } })).toBe(0);
      // Closed is not hidden (SCRUM-72 AC4): the Attendee still opens it.
      expect((await getBrowsableEvent(id))?.id).toBe(id);
    });

    it("SCRUM-75 [AC6] TC-75-07: after the Coordinator reopens it, an Attendee registers, and it stays open until the start", async () => {
      const id = await event({
        registrationClosesAt: new Date(Date.now() - 60 * 1000),
      });
      mockAuth.mockResolvedValue(coordinator);
      expect((await reopenRegistration({ eventId: id })).ok).toBe(true);

      expect((await register(id)).ok).toBe(true);
      expect(await registrations(id)).toBe(1);
      expect(
        await prisma.event.findUniqueOrThrow({
          where: { id },
          select: { registrationOpensAt: true, registrationClosesAt: true },
        }),
      ).toEqual({ registrationOpensAt: null, registrationClosesAt: null });
    });

    it("SCRUM-75 [AC6] TC-75-11: a close and a registration at the same moment take turns: the registration lands before the close or not at all", async () => {
      for (let round = 0; round < 5; round++) {
        const id = await event();
        mockAuth
          .mockResolvedValueOnce(organiser)
          .mockResolvedValueOnce(attendee);

        const [closed, registered] = await Promise.all([
          closeRegistration({ eventId: id }),
          registerForEvent({ eventId: id }),
        ]);

        expect(closed.ok).toBe(true);
        expect(await registrations(id)).toBe(registered.ok ? 1 : 0);
        if (!registered.ok) {
          expect(registered.error).toBe(
            "Registration for this event is not currently open.",
          );
        }
        // Whichever went first, registration is closed now.
        expect((await register(id)).ok).toBe(false);
      }
    });

    it("SCRUM-75 [AC9] TC-75-12: closed registration stays closed when the event returns to Planning and is confirmed again, until it is reopened", async () => {
      const id = await event();
      mockAuth.mockResolvedValue(organiser);
      expect((await closeRegistration({ eventId: id })).ok).toBe(true);

      // Back in Planning (SCRUM-26), registration pauses.
      await prisma.event.update({ where: { id }, data: { status: "PLANNING" } });
      expect((await register(id)).ok).toBe(false);

      mockAuth.mockResolvedValue(coordinator);
      expect(await confirmEvent({ eventId: id })).toEqual({
        ok: true,
        data: { status: "CONFIRMED" },
      });
      expect(await register(id)).toEqual({
        ok: false,
        error: "Registration for this event is not currently open.",
      });
      expect(await registrations(id)).toBe(0);

      mockAuth.mockResolvedValue(organiser);
      expect((await reopenRegistration({ eventId: id })).ok).toBe(true);
      expect((await register(id)).ok).toBe(true);
    });

    it("SCRUM-75 [AC9] TC-75-12: an event confirmed again with its window still open is open again, with the same window", async () => {
      const closesAt = new Date("2034-07-01T02:00:00.000Z");
      const id = await event({ status: "PLANNING", registrationClosesAt: closesAt });

      mockAuth.mockResolvedValue(coordinator);
      expect((await confirmEvent({ eventId: id })).ok).toBe(true);

      expect((await register(id)).ok).toBe(true);
      expect(
        (
          await prisma.event.findUniqueOrThrow({
            where: { id },
            select: { registrationClosesAt: true },
          })
        ).registrationClosesAt,
      ).toEqual(closesAt);
    });
  },
);

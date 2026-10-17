import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterAll,
  type Mock,
} from "vitest";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { reportUnprovidableEquipment } from "@/app/(app)/equipment/actions";
import {
  getFlaggedArrangements,
  resolveReconsiderationFlag,
} from "@/app/(app)/events/reconsideration-actions";

// SCRUM-32 against a real, seeded Postgres: a report flags the reservation
// and nothing else, two reports at once flag it once, and the Coordinator
// reads the reason and decides. Only the session is mocked. These write their
// own event, equipment type and reservation, so they only run on a localhost
// database. Test cases: docs/testing/SCRUM-32.md.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
const mockAuth = auth as unknown as Mock;

const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

const session = (id: string, role: "COORDINATOR" | "TECH_SUPPORT"): Session => ({
  user: { id, role, name: id, email: `${id}@test.local` },
  expires: "2999-01-01T00:00:00.000Z",
});
// The second seeded Coordinator, as tests/integration/holds.test.ts explains.
const COORDINATOR_ID = "usr_coordinator_2";
const COORDINATOR = session(COORDINATOR_ID, "COORDINATOR");
const TECH = session("usr_techsupport", "TECH_SUPPORT");
const STAMP = Date.now();
const REASON = "Two of the projectors failed their safety test.";

describe.skipIf(!usesLocalDatabase)(
  "reporting reserved equipment that can't be provided — real database (SCRUM-32)",
  () => {
    let eventId: string;
    let equipmentId: string;
    let reservationId: string;
    const startAt = new Date("2035-09-09T01:00:00.000Z");
    const endAt = new Date("2035-09-09T05:00:00.000Z");

    const read = () =>
      prisma.reservation.findUniqueOrThrow({
        where: { id: reservationId },
        select: {
          status: true,
          quantity: true,
          startAt: true,
          endAt: true,
          needsReconsideration: true,
          reconsiderationReason: true,
        },
      });
    const flagNotices = () =>
      prisma.notification.findMany({
        where: { eventId, type: "ARRANGEMENT_FLAGGED", userId: COORDINATOR_ID },
        select: { message: true },
      });
    const reports = () =>
      prisma.auditLog.count({
        where: { entityId: reservationId, action: "REPORTED_UNPROVIDABLE" },
      });

    beforeAll(async () => {
      eventId = (
        await prisma.event.create({
          data: {
            name: `Report test event ${STAMP}`,
            status: "PLANNING",
            organiserId: "usr_organiser",
            coordinatorId: COORDINATOR_ID,
            startAt,
            endAt,
            expectedAttendance: 40,
          },
          select: { id: true },
        })
      ).id;
      equipmentId = (
        await prisma.equipment.create({
          data: { type: `Report test projector ${STAMP}`, totalQuantity: 4 },
          select: { id: true },
        })
      ).id;
    });

    beforeEach(async () => {
      await prisma.notification.deleteMany({ where: { eventId } });
      await prisma.auditLog.deleteMany({ where: { entityType: "Reservation", entityId: reservationId } });
      await prisma.reservation.deleteMany({ where: { eventId } });
      reservationId = (
        await prisma.reservation.create({
          data: {
            eventId,
            equipmentId,
            quantity: 2,
            startAt,
            endAt,
            reservedById: "usr_techsupport",
          },
          select: { id: true },
        })
      ).id;
      mockAuth.mockResolvedValue(TECH);
    });

    afterAll(async () => {
      await prisma.notification.deleteMany({ where: { eventId } });
      await prisma.auditLog.deleteMany({ where: { entityType: "Reservation", entityId: reservationId } });
      await prisma.reservation.deleteMany({ where: { eventId } });
      await prisma.equipment.delete({ where: { id: equipmentId } });
      await prisma.event.delete({ where: { id: eventId } });
    });

    it("SCRUM-32 [AC1, AC2, AC4, AC5] TC-32-01: a report flags the reservation with the reason, keeps it reserved as it was, records who, and tells the Coordinator", async () => {
      expect(await reportUnprovidableEquipment({ reservationId, reason: REASON })).toEqual({
        ok: true,
        data: { reservationId },
      });

      expect(await read()).toEqual({
        status: "CONFIRMED",
        quantity: 2,
        startAt,
        endAt,
        needsReconsideration: true,
        reconsiderationReason: `Technical Support can no longer provide it: ${REASON}`,
      });
      expect(
        await prisma.auditLog.findMany({
          where: { entityId: reservationId, action: "REPORTED_UNPROVIDABLE" },
          select: { actorId: true, summary: true },
        }),
      ).toEqual([{ actorId: "usr_techsupport", summary: REASON }]);
      const notices = await flagNotices();
      expect(notices).toHaveLength(1);
      expect(notices[0].message).toContain(REASON);

      // AC2: the Coordinator reads the reason where they resolve it.
      mockAuth.mockResolvedValue(COORDINATOR);
      const flagged = await getFlaggedArrangements(eventId);
      expect(flagged).toMatchObject({
        ok: true,
        data: [
          {
            kind: "reservation",
            id: reservationId,
            reason: `Technical Support can no longer provide it: ${REASON}`,
          },
        ],
      });
    });

    it("SCRUM-32 [AC3] TC-32-03: two reports at the same moment flag it once, with one record and one notice", async () => {
      const results = await Promise.all([
        reportUnprovidableEquipment({ reservationId, reason: REASON }),
        reportUnprovidableEquipment({ reservationId, reason: "Lens cracked." }),
      ]);

      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(await reports()).toBe(1);
      expect(await flagNotices()).toHaveLength(1);
    });

    it("SCRUM-32 [AC3] TC-32-03: reporting it again later changes nothing", async () => {
      await reportUnprovidableEquipment({ reservationId, reason: REASON });
      const before = await read();

      expect((await reportUnprovidableEquipment({ reservationId, reason: "Again." })).ok).toBe(false);
      expect(await read()).toEqual(before);
      expect(await reports()).toBe(1);
      expect(await flagNotices()).toHaveLength(1);
    });

    it("SCRUM-32 [AC4, AC5] TC-32-06: the Coordinator cancels the reported reservation, which returns its stock and records who", async () => {
      await reportUnprovidableEquipment({ reservationId, reason: REASON });
      mockAuth.mockResolvedValue(COORDINATOR);

      expect(
        await resolveReconsiderationFlag({ kind: "reservation", id: reservationId, decision: "CANCEL" }),
      ).toMatchObject({ ok: true });

      expect((await read()).status).toBe("CANCELLED");
      expect(
        await prisma.reservation.findUniqueOrThrow({
          where: { id: reservationId },
          select: { reconsiderationResolvedById: true, reconsiderationResolvedAt: true },
        }),
      ).toEqual({
        reconsiderationResolvedById: COORDINATOR_ID,
        reconsiderationResolvedAt: expect.any(Date),
      });
    });
  },
);

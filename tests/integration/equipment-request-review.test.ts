import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  suggestAlternativeEquipment,
  updateEquipmentRequestStatus,
} from "@/app/(app)/equipment-requests/actions";
import {
  getCoordinatorEquipmentRequests,
  getEquipmentRequestQueue,
} from "@/lib/equipment/request-queries";

// SCRUM-28 — Review and Update Equipment Request, against a real Postgres. The
// unit tests mock Prisma; these prove the conditional status update under two
// reviewers acting at once, that each update writes exactly one history entry
// and one notification, and that alternatives are judged against the
// reservations actually in the database.
//
// They use the seeded "Registration Not Yet Open — Summer Camp" rather than
// creating an event: other suites count Event rows while this one runs in
// parallel (permission-guard.test.ts), so it must never add or remove one. The
// seed gives that event no request and no reservation; each test removes the
// request, reservations and notifications it created.
//
// They WRITE, so they only run against a localhost database (CI's service
// container or the Docker DB) — never the shared Supabase database.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

// Seeded accounts, event and equipment (prisma/seed.ts). Lectern has 4 units
// and nothing seeded against it.
const TECH = "usr_techsupport";
const COORDINATOR = "usr_coordinator";
const eventId = "evt_reg_not_open"; // CONFIRMED, coordinated by COORDINATOR

const techSession: Session = {
  user: {
    id: TECH,
    role: "TECH_SUPPORT",
    name: "Theo Tech",
    email: "techsupport@test.local",
  },
  expires: "2999-01-01T00:00:00.000Z",
};

describe.skipIf(!usesLocalDatabase)(
  "SCRUM-28 — reviewing equipment requests against Postgres",
  () => {
    let requestId: string;
    let lecternLineId: string;
    // The event's own period: the queue and suggestions check availability
    // against it, so the reservations below must fall inside it.
    let START: Date;
    let END: Date;

    // Lines and history cascade with their request.
    const cleanUp = async () => {
      await prisma.notification.deleteMany({
        where: { eventId, type: "EQUIPMENT_REQUEST_UPDATED" },
      });
      await prisma.reservation.deleteMany({ where: { eventId } });
      await prisma.equipmentRequest.deleteMany({ where: { eventId } });
    };

    beforeAll(async () => {
      (auth as unknown as Mock).mockResolvedValue(techSession);
      const event = await prisma.event.findUniqueOrThrow({
        where: { id: eventId },
        select: { startAt: true, endAt: true },
      });
      START = event.startAt!;
      END = event.endAt!;
    });

    beforeEach(async () => {
      await cleanUp();
      const request = await prisma.equipmentRequest.create({
        data: {
          eventId,
          requestedById: COORDINATOR,
          status: "PENDING_REVIEW",
          lines: {
            create: [
              {
                equipmentId: "eqp_lectern",
                quantity: 3,
                technicalRequirements: "Gooseneck mic",
              },
              { equipmentId: "eqp_laptop", quantity: 1 },
            ],
          },
        },
        select: {
          id: true,
          lines: { select: { id: true, equipmentId: true } },
        },
      });
      requestId = request.id;
      lecternLineId = request.lines.find(
        (line) => line.equipmentId === "eqp_lectern",
      )!.id;
    });

    afterEach(cleanUp);

    afterAll(async () => {
      await prisma.$disconnect();
    });

    const reserveLecterns = (quantity: number) =>
      prisma.reservation.create({
        data: {
          eventId,
          equipmentId: "eqp_lectern",
          quantity,
          startAt: START,
          endAt: END,
          reservedById: TECH,
        },
      });

    it("SCRUM-28 [AC2, AC3, AC5, AC6] TC-28-02, TC-28-03, TC-28-09, TC-28-10: review then approval each move the request, log one entry and notify the coordinator once", async () => {
      await expect(
        updateEquipmentRequestStatus({ requestId, toStatus: "IN_REVIEW" }),
      ).resolves.toEqual({ ok: true, data: { status: "IN_REVIEW" } });
      await expect(
        updateEquipmentRequestStatus({
          requestId,
          toStatus: "APPROVED",
          note: "Reserved.",
        }),
      ).resolves.toEqual({ ok: true, data: { status: "APPROVED" } });

      const saved = await prisma.equipmentRequest.findUniqueOrThrow({
        where: { id: requestId },
      });
      expect(saved.status).toBe("APPROVED");
      expect(saved.decidedAt).toBeInstanceOf(Date);

      const [{ updates }] = (
        await getCoordinatorEquipmentRequests(COORDINATOR)
      ).filter((row) => row.id === requestId);
      expect(updates).toMatchObject([
        {
          fromStatus: "PENDING_REVIEW",
          toStatus: "IN_REVIEW",
          note: null,
          actor: { name: "Theo Tech" },
        },
        { fromStatus: "IN_REVIEW", toStatus: "APPROVED", note: "Reserved." },
      ]);

      const notifications = await prisma.notification.findMany({
        where: { eventId, type: "EQUIPMENT_REQUEST_UPDATED" },
        orderBy: { createdAt: "asc" },
      });
      expect(notifications).toHaveLength(2);
      expect(notifications.every((n) => n.userId === COORDINATOR)).toBe(true);
      expect(
        notifications.every((n) => n.type === "EQUIPMENT_REQUEST_UPDATED"),
      ).toBe(true);
      expect(notifications[1].message).toContain(
        "is now Approved. Note: Reserved.",
      );
    });

    it("SCRUM-28 [AC7] TC-28-06: two reviewers taking the same request at once — one succeeds, one is told, nothing is doubled", async () => {
      const results = await Promise.all([
        updateEquipmentRequestStatus({ requestId, toStatus: "IN_REVIEW" }),
        updateEquipmentRequestStatus({ requestId, toStatus: "IN_REVIEW" }),
      ]);

      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(results.find((result) => !result.ok)).toMatchObject({
        error:
          "Someone else updated this request first. Refresh to see its current status.",
      });
      expect(
        await prisma.equipmentRequestUpdate.count({ where: { requestId } }),
      ).toBe(1);
      expect(
        await prisma.notification.count({
          where: { eventId, type: "EQUIPMENT_REQUEST_UPDATED" },
        }),
      ).toBe(1);
    });

    /**
     * SCRUM-227: two updates "at the same moment", on every run rather than by
     * luck. The request's row is held while the updates start, one at a time,
     * each waiting until its write is queued behind the hold, so every one of
     * them read the request before any could write. Postgres hands the row to
     * waiters in the order they queued, so `starts` also fixes who goes first.
     */
    async function inTurn<T>(starts: (() => Promise<T>)[]): Promise<T[]> {
      const running: Promise<T>[] = [];
      await prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "EquipmentRequest" WHERE "id" = ${requestId} FOR UPDATE`;
          const [{ holder }] = await tx.$queryRaw<{ holder: number }[]>`
            SELECT pg_backend_pid() AS holder
          `;
          for (const start of starts) {
            running.push(start());
            await queuedBehind(holder, running.length);
          }
        },
        { timeout: 15_000 },
      );
      return Promise.all(running);
    }

    /**
     * Waits until `count` sessions are queued behind the `holder` session.
     * Only the first waits on the holder itself; each later one waits on the
     * one before it, so the queue is followed link by link.
     */
    async function queuedBehind(holder: number, count: number) {
      for (let tries = 0; tries < 200; tries++) {
        const [{ queued }] = await prisma.$queryRaw<{ queued: number }[]>`
          WITH RECURSIVE queue(pid) AS (
            SELECT pid FROM pg_stat_activity
             WHERE ${holder}::int = ANY(pg_blocking_pids(pid))
            UNION
            SELECT a.pid FROM pg_stat_activity a
              JOIN queue q ON q.pid = ANY(pg_blocking_pids(a.pid))
          )
          SELECT count(*)::int AS queued FROM queue
        `;
        if (queued >= count) return;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      throw new Error(`Only some of the ${count} updates queued behind the held request.`);
    }

    it("SCRUM-227 [AC1, AC3] SCRUM-28 [AC7] TC-28-12: two suggestions on the same request at once — the first is saved, the second is told, nothing is doubled", async () => {
      await updateEquipmentRequestStatus({ requestId, toStatus: "IN_REVIEW" });
      await reserveLecterns(2);

      const [first, second] = await inTurn([
        () => suggestAlternativeEquipment({ requestId, lineId: lecternLineId, alternativeId: "eqp_projector" }),
        () => suggestAlternativeEquipment({ requestId, lineId: lecternLineId, alternativeId: "eqp_mic" }),
      ]);

      expect(first).toEqual({ ok: true, data: { alternativeId: "eqp_projector" } });
      expect(second).toMatchObject({
        ok: false,
        error:
          "Someone else updated this request first. Refresh to see its current status.",
      });
      const line = await prisma.equipmentRequestLine.findUniqueOrThrow({
        where: { id: lecternLineId },
      });
      expect(line.suggestedAlternativeId).toBe("eqp_projector");
      // The review's own entry and notice, then the first suggestion's only.
      expect(
        await prisma.equipmentRequestUpdate.count({ where: { requestId } }),
      ).toBe(2);
      expect(
        await prisma.notification.count({
          where: { eventId, type: "EQUIPMENT_REQUEST_UPDATED" },
        }),
      ).toBe(2);
    });

    it("SCRUM-227 [AC1, AC3] SCRUM-28 [AC7] TC-28-13: a suggestion and an approval at once — the suggestion is saved, the approval is told, the request stays In Review", async () => {
      await updateEquipmentRequestStatus({ requestId, toStatus: "IN_REVIEW" });
      await reserveLecterns(2);

      const [suggested, approved] = await inTurn<{ ok: boolean; error?: string }>([
        () => suggestAlternativeEquipment({ requestId, lineId: lecternLineId, alternativeId: "eqp_projector" }),
        () => updateEquipmentRequestStatus({ requestId, toStatus: "APPROVED" }),
      ]);

      expect(suggested).toMatchObject({ ok: true });
      expect(approved).toMatchObject({
        ok: false,
        error:
          "Someone else updated this request first. Refresh to see its current status.",
      });
      const request = await prisma.equipmentRequest.findUniqueOrThrow({
        where: { id: requestId },
        select: {
          status: true,
          decidedAt: true,
          lines: { where: { id: lecternLineId }, select: { suggestedAlternativeId: true } },
        },
      });
      expect(request).toEqual({
        status: "IN_REVIEW",
        decidedAt: null,
        lines: [{ suggestedAlternativeId: "eqp_projector" }],
      });
      expect(
        await prisma.equipmentRequestUpdate.count({ where: { requestId } }),
      ).toBe(2);
      expect(
        await prisma.notification.count({
          where: { eventId, type: "EQUIPMENT_REQUEST_UPDATED" },
        }),
      ).toBe(2);
    });

    it("SCRUM-28 [AC2, AC3] TC-28-05: a request cannot be approved before it is reviewed, and stays Pending Review", async () => {
      const result = await updateEquipmentRequestStatus({
        requestId,
        toStatus: "APPROVED",
      });

      expect(result).toMatchObject({ ok: false });
      const saved = await prisma.equipmentRequest.findUniqueOrThrow({
        where: { id: requestId },
      });
      expect(saved.status).toBe("PENDING_REVIEW");
    });

    it("SCRUM-28 [AC1, AC4] TC-28-01, TC-28-07: the queue shows each line against real reservations, and offers alternatives for a short one", async () => {
      await updateEquipmentRequestStatus({ requestId, toStatus: "IN_REVIEW" });
      await reserveLecterns(2);

      const queued = (await getEquipmentRequestQueue()).find(
        (row) => row.id === requestId,
      )!;
      const lectern = queued.lines.find(
        (line) => line.equipment.id === "eqp_lectern",
      )!;
      const laptop = queued.lines.find(
        (line) => line.equipment.id === "eqp_laptop",
      )!;

      expect(lectern).toMatchObject({
        quantity: 3,
        technicalRequirements: "Gooseneck mic",
        equipment: {
          type: "Lectern",
          description: "Podium with gooseneck mic",
        },
      });
      expect(lectern.review).toMatchObject({
        available: 2,
        total: 4,
        shortfall: 1,
      });
      expect(lectern.review?.alternatives.map((item) => item.id)).toContain(
        "eqp_projector",
      );
      expect(lectern.review?.alternatives.map((item) => item.id)).not.toContain(
        "eqp_lectern",
      );
      expect(laptop.review).toMatchObject({ shortfall: 0, alternatives: [] });
    });

    it("SCRUM-28 [AC4, AC5] TC-28-07, TC-28-09: suggesting an alternative for the short line saves it, logs it and tells the coordinator", async () => {
      await updateEquipmentRequestStatus({ requestId, toStatus: "IN_REVIEW" });
      await reserveLecterns(2);

      const result = await suggestAlternativeEquipment({
        requestId,
        lineId: lecternLineId,
        alternativeId: "eqp_projector",
      });

      expect(result).toEqual({
        ok: true,
        data: { alternativeId: "eqp_projector" },
      });
      const line = await prisma.equipmentRequestLine.findUniqueOrThrow({
        where: { id: lecternLineId },
      });
      expect(line.suggestedAlternativeId).toBe("eqp_projector");
      expect(
        await prisma.equipmentRequestUpdate.findFirst({
          where: {
            requestId,
            note: { startsWith: "Suggested Projector instead of Lectern" },
          },
        }),
      ).not.toBeNull();
      expect(
        await prisma.notification.count({
          where: {
            eventId,
            message: { contains: "suggested Projector instead of Lectern" },
          },
        }),
      ).toBe(1);
    });

    it("SCRUM-28 [AC4] TC-28-08: no alternative is taken for a line that is available", async () => {
      await updateEquipmentRequestStatus({ requestId, toStatus: "IN_REVIEW" });

      const result = await suggestAlternativeEquipment({
        requestId,
        lineId: lecternLineId,
        alternativeId: "eqp_projector",
      });

      expect(result).toMatchObject({ ok: false });
      const line = await prisma.equipmentRequestLine.findUniqueOrThrow({
        where: { id: lecternLineId },
      });
      expect(line.suggestedAlternativeId).toBeNull();
    });
  },
);

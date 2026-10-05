import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  afterEach,
  type Mock,
} from "vitest";
import type { Session } from "next-auth";
import type { EquipmentRequestStatus, EventStatus } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  createReservation,
  reserveEquipmentRequest,
} from "@/app/(app)/equipment/actions";
import { getReservableRequests } from "@/lib/equipment/request-queries";

// SCRUM-155 — reserving an approved request in one step, against a real
// Postgres: all rows or none, the locks under two staff at once, and which
// requests are offered. These write throwaway events, equipment pools,
// requests and reservations (removed afterwards), so they run only against a
// localhost database, never the shared Supabase one.
vi.mock("@/auth", () => ({ auth: vi.fn() }));

const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

const TECH_SUPPORT: Session = {
  user: {
    id: "usr_techsupport",
    role: "TECH_SUPPORT",
    name: "Theo Tech",
    email: "techsupport@test.local",
  },
  expires: "2999-01-01T00:00:00.000Z",
};

// Every test event runs over this period, far in the future, so seeded
// reservations and maintenance never overlap it.
const PERIOD = {
  startAt: "2032-03-01T01:00:00.000Z",
  endAt: "2032-03-01T09:00:00.000Z",
};

describe.skipIf(!usesLocalDatabase)(
  "reserve an approved request (SCRUM-155)",
  () => {
    // A pool with room for both racing requests, and a single contended unit.
    let roomy: string;
    let scarce: string;
    const eventIds: string[] = [];
    const requestIds: string[] = [];

    async function event(
      status: EventStatus,
      period: { startAt: string; endAt: string } = PERIOD,
    ) {
      const created = await prisma.event.create({
        data: {
          name: `SCRUM-155 integration ${status} ${Date.now()}`,
          description:
            "Owned by tests/integration/request-reservation.test.ts.",
          status,
          organiserId: "usr_organiser",
          coordinatorId: "usr_coordinator",
          startAt: new Date(period.startAt),
          endAt: new Date(period.endAt),
          expectedAttendance: 20,
          submittedAt: new Date(),
        },
        select: { id: true },
      });
      eventIds.push(created.id);
      return created.id;
    }

    async function approvedRequest(
      eventId: string,
      lines: { equipmentId: string; quantity: number }[],
      status: EquipmentRequestStatus = "APPROVED",
    ) {
      const request = await prisma.equipmentRequest.create({
        data: {
          eventId,
          requestedById: "usr_coordinator",
          status,
          lines: { create: lines },
        },
        select: { id: true },
      });
      requestIds.push(request.id);
      return request.id;
    }

    const reservedFor = (requestId: string) =>
      prisma.reservation.findMany({
        where: { requestId, status: "CONFIRMED" },
        select: { equipmentId: true, quantity: true },
        orderBy: { equipmentId: "asc" },
      });

    const totalReserved = async (equipmentId: string) =>
      (
        await prisma.reservation.aggregate({
          where: { equipmentId, status: "CONFIRMED" },
          _sum: { quantity: true },
        })
      )._sum.quantity ?? 0;

    const offered = async () =>
      (await getReservableRequests()).map((request) => request.id);

    // Resolves once some other connection is queued behind a row lock.
    async function someoneIsWaitingForALock() {
      for (let attempt = 0; attempt < 250; attempt++) {
        const [{ waiting }] = await prisma.$queryRaw<{ waiting: number }[]>`
          SELECT count(*)::int AS "waiting" FROM pg_stat_activity
          WHERE datname = current_database() AND wait_event_type = 'Lock'
        `;
        if (waiting > 0) return;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      throw new Error("Nothing ever waited for a lock.");
    }

    // Holds the event row as another action would, starts `action`, and once
    // the action is queued tries to take `nextLock` without waiting. Taking it
    // means the action was queued on the event, holding nothing; a lock error
    // means it already held that row while waiting for the event, which is the
    // half of a deadlock.
    async function takeEventThen(
      eventId: string,
      nextLock: (tx: typeof prisma) => Promise<unknown>,
      action: () => Promise<unknown>,
    ) {
      let pending: Promise<unknown> | undefined;
      const taken = await prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`;
          pending = action();
          await someoneIsWaitingForALock();
          return nextLock(tx as typeof prisma).then(
            () => true,
            () => false,
          );
        },
        { timeout: 15000 },
      );
      return { taken, result: await pending };
    }

    beforeAll(async () => {
      (auth as unknown as Mock).mockResolvedValue(TECH_SUPPORT);
      const stamp = Date.now();
      roomy = (
        await prisma.equipment.create({
          data: { type: `SCRUM-155 roomy pool ${stamp}`, totalQuantity: 3 },
        })
      ).id;
      scarce = (
        await prisma.equipment.create({
          data: { type: `SCRUM-155 scarce pool ${stamp}`, totalQuantity: 1 },
        })
      ).id;
    });

    afterEach(async () => {
      await prisma.reservation.deleteMany({
        where: { equipmentId: { in: [roomy, scarce] } },
      });
      await prisma.equipmentRequest.deleteMany({
        where: { id: { in: requestIds.splice(0) } },
      });
      await prisma.event.deleteMany({
        where: { id: { in: eventIds.splice(0) } },
      });
    });

    afterAll(async () => {
      await prisma.equipment.deleteMany({
        where: { id: { in: [roomy, scarce] } },
      });
    });

    it("SCRUM-155 [AC3] TC-155-04: reserves every row together, Confirmed and linked to the event and the request", async () => {
      const eventId = await event("PLANNING");
      const requestId = await approvedRequest(eventId, [
        { equipmentId: roomy, quantity: 2 },
        { equipmentId: scarce, quantity: 1 },
      ]);

      const result = await reserveEquipmentRequest({
        requestId,
        ...PERIOD,
        lines: [
          { equipmentId: roomy, quantity: 2 },
          { equipmentId: scarce, quantity: 1 },
        ],
      });

      expect(result).toEqual({ ok: true, data: { reserved: 2 } });
      const reserved = await prisma.reservation.findMany({
        where: { requestId, status: "CONFIRMED" },
        select: { eventId: true, equipmentId: true, quantity: true },
      });
      expect(reserved).toHaveLength(2);
      expect(reserved).toEqual(
        expect.arrayContaining([
          { eventId, equipmentId: roomy, quantity: 2 },
          { eventId, equipmentId: scarce, quantity: 1 },
        ]),
      );
    });

    it("SCRUM-155 [AC4] TC-155-05: when one row is short, nothing is reserved — not even the rows that fit", async () => {
      const eventId = await event("PLANNING");
      const requestId = await approvedRequest(eventId, [
        { equipmentId: roomy, quantity: 2 },
        { equipmentId: scarce, quantity: 2 },
      ]);

      const result = await reserveEquipmentRequest({
        requestId,
        ...PERIOD,
        lines: [
          { equipmentId: roomy, quantity: 2 },
          { equipmentId: scarce, quantity: 2 },
        ],
      });

      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(result.fieldErrors).toEqual({
          "lines.1.quantity": ["Only 1 of 1 free for this period — 1 short."],
        });
      expect(await totalReserved(roomy)).toBe(0);
      expect(await totalReserved(scarce)).toBe(0);
    });

    it("SCRUM-155 [AC5] TC-155-07: the same request reserved twice at the same moment is reserved once", async () => {
      const eventId = await event("PLANNING");
      const requestId = await approvedRequest(eventId, [
        { equipmentId: roomy, quantity: 1 },
      ]);
      const input = {
        requestId,
        ...PERIOD,
        lines: [{ equipmentId: roomy, quantity: 1 }],
      };

      const results = await Promise.all([
        reserveEquipmentRequest(input),
        reserveEquipmentRequest(input),
      ]);

      expect(results.filter((r) => r.ok)).toHaveLength(1);
      const refused = results.find((r) => !r.ok);
      if (refused && !refused.ok)
        expect(refused.error).toMatch(/already reserved/);
      expect(await totalReserved(roomy)).toBe(1);
    });

    it("SCRUM-155 [AC5] TC-155-08: two requests racing for the last unit never over-allocate, even with their rows in opposite order", async () => {
      const first = await approvedRequest(await event("PLANNING"), [
        { equipmentId: roomy, quantity: 1 },
        { equipmentId: scarce, quantity: 1 },
      ]);
      const second = await approvedRequest(await event("APPROVED"), [
        { equipmentId: scarce, quantity: 1 },
        { equipmentId: roomy, quantity: 1 },
      ]);

      const results = await Promise.all([
        reserveEquipmentRequest({
          requestId: first,
          ...PERIOD,
          lines: [
            { equipmentId: roomy, quantity: 1 },
            { equipmentId: scarce, quantity: 1 },
          ],
        }),
        reserveEquipmentRequest({
          requestId: second,
          ...PERIOD,
          lines: [
            { equipmentId: scarce, quantity: 1 },
            { equipmentId: roomy, quantity: 1 },
          ],
        }),
      ]);

      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(await totalReserved(scarce)).toBe(1);
      // The loser reserved nothing at all, so only one unit of the roomy pool went.
      expect(await totalReserved(roomy)).toBe(1);
    });

    it("SCRUM-155 [AC5] TC-155-15: reserving waits for the event before taking the request, so it can't deadlock with rejecting the event", async () => {
      const eventId = await event("PLANNING");
      const requestId = await approvedRequest(eventId, [
        { equipmentId: roomy, quantity: 1 },
      ]);

      // Rejecting a Planning event (SCRUM-117) locks the event, then cancels
      // its requests.
      const { taken, result } = await takeEventThen(
        eventId,
        (tx) =>
          tx.$queryRaw`SELECT "id" FROM "EquipmentRequest" WHERE "id" = ${requestId} FOR UPDATE NOWAIT`,
        () =>
          reserveEquipmentRequest({
            requestId,
            ...PERIOD,
            lines: [{ equipmentId: roomy, quantity: 1 }],
          }),
      );

      expect(taken).toBe(true);
      expect(result).toEqual({ ok: true, data: { reserved: 1 } });
    });

    it("SCRUM-155 [AC5, AC6] TC-155-16: the one-type form waits for the event before the equipment, so it takes turns with this card", async () => {
      const eventId = await event("PLANNING");

      // The card holds the event while it checks nothing is reserved yet, then
      // locks the equipment.
      const { taken, result } = await takeEventThen(
        eventId,
        (tx) =>
          tx.$queryRaw`SELECT "id" FROM "Equipment" WHERE "id" = ${roomy} FOR UPDATE NOWAIT`,
        () =>
          createReservation({
            eventId,
            equipmentId: roomy,
            quantity: 1,
            ...PERIOD,
          }),
      );

      expect(taken).toBe(true);
      expect(result).toMatchObject({ ok: true });
    });

    it("SCRUM-155 [AC1, AC6] TC-155-01, TC-155-06: offers approved, unreserved requests for events that haven't started, and a cancelled reservation offers it again", async () => {
      const approved = await approvedRequest(await event("PLANNING"), [
        { equipmentId: roomy, quantity: 1 },
      ]);
      const inReview = await approvedRequest(
        await event("APPROVED"),
        [{ equipmentId: roomy, quantity: 1 }],
        "IN_REVIEW",
      );
      const forConfirmedEvent = await approvedRequest(
        await event("CONFIRMED"),
        [{ equipmentId: roomy, quantity: 1 }],
      );
      const forStartedEvent = await approvedRequest(
        await event("PLANNING", {
          startAt: "2026-01-01T01:00:00.000Z",
          endAt: "2026-01-01T09:00:00.000Z",
        }),
        [{ equipmentId: roomy, quantity: 1 }],
      );

      expect(await offered()).toContain(approved);
      expect(await offered()).not.toContain(inReview);
      expect(await offered()).not.toContain(forConfirmedEvent);
      expect(await offered()).not.toContain(forStartedEvent);

      await reserveEquipmentRequest({
        requestId: approved,
        ...PERIOD,
        lines: [{ equipmentId: roomy, quantity: 1 }],
      });
      expect(await offered()).not.toContain(approved);

      const again = await reserveEquipmentRequest({
        requestId: approved,
        ...PERIOD,
        lines: [{ equipmentId: roomy, quantity: 1 }],
      });
      expect(again.ok).toBe(false);

      await prisma.reservation.updateMany({
        where: { requestId: approved },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });
      expect(await offered()).toContain(approved);
    });

    it("SCRUM-155 [AC6] TC-155-12: stock already reserved for the event with the one-type form is not reserved twice", async () => {
      const eventId = await event("PLANNING");
      const requestId = await approvedRequest(eventId, [
        { equipmentId: roomy, quantity: 2 },
      ]);
      // How Technical Support reserved before this card: one type at a time,
      // with no link to the request.
      const manual = await createReservation({
        eventId,
        equipmentId: roomy,
        quantity: 2,
        ...PERIOD,
      });
      expect(manual.ok).toBe(true);

      expect(await offered()).not.toContain(requestId);
      const result = await reserveEquipmentRequest({
        requestId,
        ...PERIOD,
        lines: [{ equipmentId: roomy, quantity: 2 }],
      });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/already reserved/);
      expect(await totalReserved(roomy)).toBe(2);
    });

    it("SCRUM-155 [AC2] TC-155-13: a period that doesn't cover the whole event is refused; a longer one is accepted", async () => {
      const eventId = await event("PLANNING");
      const requestId = await approvedRequest(eventId, [
        { equipmentId: roomy, quantity: 1 },
      ]);
      const lines = [{ equipmentId: roomy, quantity: 1 }];

      // 10:00–12:00 for a 09:00–17:00 event: the readiness checklist would
      // never count it, so the request must not drop off the list.
      const shortened = await reserveEquipmentRequest({
        requestId,
        startAt: "2032-03-01T02:00:00.000Z",
        endAt: "2032-03-01T04:00:00.000Z",
        lines,
      });
      expect(shortened.ok).toBe(false);
      if (!shortened.ok)
        expect(Object.keys(shortened.fieldErrors ?? {})).toEqual([
          "startAt",
          "endAt",
        ]);
      expect(await totalReserved(roomy)).toBe(0);
      expect(await offered()).toContain(requestId);

      // An hour either side for set-up and pack-down still covers it.
      const longer = await reserveEquipmentRequest({
        requestId,
        startAt: "2032-03-01T00:00:00.000Z",
        endAt: "2032-03-01T10:00:00.000Z",
        lines,
      });
      expect(longer).toEqual({ ok: true, data: { reserved: 1 } });
      expect(await reservedFor(requestId)).toEqual([
        { equipmentId: roomy, quantity: 1 },
      ]);
    });

    it("SCRUM-155 [AC1] TC-155-10: a request for a Confirmed event is refused and nothing is written", async () => {
      const requestId = await approvedRequest(await event("CONFIRMED"), [
        { equipmentId: roomy, quantity: 1 },
      ]);

      const result = await reserveEquipmentRequest({
        requestId,
        ...PERIOD,
        lines: [{ equipmentId: roomy, quantity: 1 }],
      });

      expect(result.ok).toBe(false);
      expect(await totalReserved(roomy)).toBe(0);
    });
  },
);

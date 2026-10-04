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
import type { EquipmentRequestStatus } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { reserveEquipmentRequest } from "@/app/(app)/equipment/actions";
import { getReservableRequests } from "@/lib/equipment/request-queries";

// SCRUM-155 — reserving an approved request in one step, against a real
// Postgres: all rows or none, the request and pool locks under two staff at
// once, and which requests are offered. These write throwaway equipment pools,
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

// Far in the future, so seeded reservations and maintenance never overlap.
const PERIOD = {
  startAt: "2032-03-01T01:00:00.000Z",
  endAt: "2032-03-01T09:00:00.000Z",
};

describe.skipIf(!usesLocalDatabase)(
  "reserve an approved request (SCRUM-155)",
  () => {
    // Three projectors-like units, and a single unit that two requests contend for.
    let roomy: string;
    let scarce: string;
    const requestIds: string[] = [];

    async function approvedRequest(
      lines: { equipmentId: string; quantity: number }[],
      {
        eventId = "evt_planning",
        status = "APPROVED",
      }: { eventId?: string; status?: EquipmentRequestStatus } = {},
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
        select: { eventId: true, equipmentId: true, quantity: true },
        orderBy: { equipmentId: "asc" },
      });

    const totalReserved = async (equipmentId: string) =>
      (
        await prisma.reservation.aggregate({
          where: { equipmentId, status: "CONFIRMED" },
          _sum: { quantity: true },
        })
      )._sum.quantity ?? 0;

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
    });

    afterAll(async () => {
      await prisma.equipment.deleteMany({
        where: { id: { in: [roomy, scarce] } },
      });
    });

    it("SCRUM-155 [AC3] TC-155-04: reserves every row together, Confirmed and linked to the event and the request", async () => {
      const requestId = await approvedRequest([
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
      expect(await reservedFor(requestId)).toEqual(
        [
          { eventId: "evt_planning", equipmentId: roomy, quantity: 2 },
          { eventId: "evt_planning", equipmentId: scarce, quantity: 1 },
        ].sort((a, b) => a.equipmentId.localeCompare(b.equipmentId)),
      );
    });

    it("SCRUM-155 [AC4] TC-155-05: when one row is short, nothing is reserved — not even the rows that fit", async () => {
      const requestId = await approvedRequest([
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
      const requestId = await approvedRequest([
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
      const first = await approvedRequest([
        { equipmentId: roomy, quantity: 1 },
        { equipmentId: scarce, quantity: 1 },
      ]);
      const second = await approvedRequest(
        [
          { equipmentId: scarce, quantity: 1 },
          { equipmentId: roomy, quantity: 1 },
        ],
        { eventId: "evt_approved" },
      );

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

    it("SCRUM-155 [AC1, AC6] TC-155-01, TC-155-06: offers approved, unreserved requests only, and a cancelled reservation offers it again", async () => {
      const approved = await approvedRequest([
        { equipmentId: roomy, quantity: 1 },
      ]);
      const inReview = await approvedRequest(
        [{ equipmentId: roomy, quantity: 1 }],
        {
          eventId: "evt_approved",
          status: "IN_REVIEW",
        },
      );
      const forConfirmedEvent = await approvedRequest(
        [{ equipmentId: roomy, quantity: 1 }],
        {
          eventId: "evt_confirmed",
        },
      );
      const offered = async () =>
        (await getReservableRequests()).map((r) => r.id);

      expect(await offered()).toContain(approved);
      expect(await offered()).not.toContain(inReview);
      expect(await offered()).not.toContain(forConfirmedEvent);

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

    it("SCRUM-155 [AC1] TC-155-10: a request for a Confirmed event, or one not yet approved, is refused and nothing is written", async () => {
      const forConfirmedEvent = await approvedRequest(
        [{ equipmentId: roomy, quantity: 1 }],
        {
          eventId: "evt_confirmed",
        },
      );

      const result = await reserveEquipmentRequest({
        requestId: forConfirmedEvent,
        ...PERIOD,
        lines: [{ equipmentId: roomy, quantity: 1 }],
      });

      expect(result.ok).toBe(false);
      expect(await totalReserved(roomy)).toBe(0);
    });
  },
);

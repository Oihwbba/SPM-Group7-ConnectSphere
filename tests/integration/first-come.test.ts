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
import { decideBookingRequest } from "@/app/(app)/bookings/actions";
import { getPendingBookingQueue } from "@/app/(app)/bookings/queries";
import { reserveEquipmentRequest } from "@/app/(app)/equipment/actions";
import { getEquipmentRequestQueue } from "@/lib/equipment/request-queries";

// SCRUM-134 against a real, seeded Postgres: competing venue requests and
// competing equipment requests are settled in the order they were made. Only
// the session is mocked. These write their own events, venue, equipment type,
// requests and bookings, so they only run on a localhost database. Test
// cases: docs/testing/SCRUM-134.md.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
const mockAuth = auth as unknown as Mock;

const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

const session = (id: string, role: "VENUE_STAFF" | "TECH_SUPPORT"): Session => ({
  user: { id, role, name: id, email: `${id}@test.local` },
  expires: "2999-01-01T00:00:00.000Z",
});
const VENUE_STAFF = session("usr_venuestaff", "VENUE_STAFF");
const TECH = session("usr_techsupport", "TECH_SUPPORT");
// The second seeded Coordinator, as tests/integration/holds.test.ts explains.
const COORDINATOR_ID = "usr_coordinator_2";
const STAMP = Date.now();
const HOUR = 60 * 60 * 1000;

const START = new Date("2036-08-04T02:00:00.000Z");
const END = new Date("2036-08-04T06:00:00.000Z");
const FIRST = new Date("2036-01-01T00:00:00.000Z");
const SECOND = new Date("2036-01-02T00:00:00.000Z");

describe.skipIf(!usesLocalDatabase)(
  "first come, first served — real database (SCRUM-134)",
  () => {
    let venueId: string;
    let equipmentId: string;
    let eventIds: string[];

    const pending = (eventId: string, createdAt: Date, startAt = START, endAt = END) =>
      prisma.booking.create({
        data: {
          eventId,
          venueId,
          startAt,
          endAt,
          status: "PENDING",
          requestedAttendance: 40,
          requestedById: COORDINATOR_ID,
          createdAt,
        },
        select: { id: true },
      });
    const statusOf = async (id: string) =>
      (await prisma.booking.findUniqueOrThrow({ where: { id }, select: { status: true } }))
        .status;

    const approvedRequest = (eventId: string, createdAt: Date, quantity: number) =>
      prisma.equipmentRequest.create({
        data: {
          eventId,
          requestedById: COORDINATOR_ID,
          status: "APPROVED",
          createdAt,
          lines: { create: [{ equipmentId, quantity }] },
        },
        select: { id: true },
      });
    const reserve = (requestId: string, quantity: number) =>
      reserveEquipmentRequest({
        requestId,
        startAt: START.toISOString(),
        endAt: END.toISOString(),
        lines: [{ equipmentId, quantity: String(quantity) }],
      });

    async function clear() {
      const bookingIds = (
        await prisma.booking.findMany({ where: { venueId }, select: { id: true } })
      ).map((b) => b.id);
      await prisma.notification.deleteMany({ where: { eventId: { in: eventIds } } });
      await prisma.auditLog.deleteMany({ where: { entityId: { in: bookingIds } } });
      await prisma.booking.deleteMany({ where: { venueId } });
      await prisma.reservation.deleteMany({ where: { eventId: { in: eventIds } } });
      const requests = { request: { eventId: { in: eventIds } } };
      await prisma.equipmentRequestUpdate.deleteMany({ where: requests });
      await prisma.equipmentRequestLine.deleteMany({ where: requests });
      await prisma.equipmentRequest.deleteMany({ where: { eventId: { in: eventIds } } });
    }

    beforeAll(async () => {
      eventIds = [];
      for (const n of [1, 2, 3]) {
        eventIds.push(
          (
            await prisma.event.create({
              data: {
                name: `First-come event ${n} ${STAMP}`,
                status: "PLANNING",
                organiserId: "usr_organiser",
                coordinatorId: COORDINATOR_ID,
                startAt: START,
                endAt: END,
                expectedAttendance: 40,
              },
              select: { id: true },
            })
          ).id,
        );
      }
      venueId = (
        await prisma.venue.create({
          data: { name: `First-come venue ${STAMP}`, location: "Test block", capacity: 500 },
          select: { id: true },
        })
      ).id;
      equipmentId = (
        await prisma.equipment.create({
          data: { type: `First-come projector ${STAMP}`, totalQuantity: 4 },
          select: { id: true },
        })
      ).id;
    });

    beforeEach(clear);

    afterAll(async () => {
      await clear();
      await prisma.venue.delete({ where: { id: venueId } });
      await prisma.equipment.delete({ where: { id: equipmentId } });
      await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
    });

    describe("venue requests (AC1–AC3, AC6)", () => {
      beforeEach(() => mockAuth.mockResolvedValue(VENUE_STAFF));

      it("SCRUM-134 [AC2] TC-134-02: the later of two overlapping requests can't be approved while the earlier is pending; once the earlier is approved, the later conflicts", async () => {
        const first = await pending(eventIds[0], FIRST);
        const second = await pending(eventIds[1], SECOND);

        const refused = await decideBookingRequest({ bookingId: second.id, decision: "APPROVED" });
        expect(refused).toMatchObject({
          ok: false,
          error: expect.stringContaining(`"First-come event 1 ${STAMP}"`),
        });
        expect(await statusOf(second.id)).toBe("PENDING");

        expect((await decideBookingRequest({ bookingId: first.id, decision: "APPROVED" })).ok).toBe(true);
        expect(await decideBookingRequest({ bookingId: second.id, decision: "APPROVED" })).toMatchObject({
          ok: false,
          error: expect.stringMatching(/^Conflicting:/),
        });
      });

      it("SCRUM-134 [AC6] TC-134-06: the later request can be rejected while the earlier is pending, and the earlier rejected, after which the later can be approved", async () => {
        const first = await pending(eventIds[0], FIRST);
        const second = await pending(eventIds[1], SECOND);

        expect(
          (await decideBookingRequest({ bookingId: first.id, decision: "REJECTED", reason: "Clash." })).ok,
        ).toBe(true);
        expect((await decideBookingRequest({ bookingId: second.id, decision: "APPROVED" })).ok).toBe(true);
        expect(await statusOf(second.id)).toBe("APPROVED");
      });

      it("SCRUM-134 [AC3] TC-134-03: requests that only touch don't compete", async () => {
        await pending(eventIds[0], FIRST, new Date(START.getTime() - 2 * HOUR), START);
        const later = await pending(eventIds[1], SECOND);

        expect((await decideBookingRequest({ bookingId: later.id, decision: "APPROVED" })).ok).toBe(true);
      });

      it("SCRUM-134 [AC1] TC-134-01: the queue shows each pending request's competitors with when they were submitted, the earlier marked", async () => {
        const first = await pending(eventIds[0], FIRST);
        const second = await pending(eventIds[1], SECOND);

        const queue = await getPendingBookingQueue();
        const row = (id: string) => queue.find((b) => b.id === id)!;
        expect(row(second.id).competing).toEqual([
          expect.objectContaining({ id: first.id, createdAt: FIRST, earlier: true }),
        ]);
        expect(row(first.id).competing).toEqual([
          expect.objectContaining({ id: second.id, createdAt: SECOND, earlier: false }),
        ]);
      });
    });

    describe("equipment requests (AC4, AC5)", () => {
      beforeEach(() => mockAuth.mockResolvedValue(TECH));

      it("SCRUM-134 [AC5] TC-134-05: stock can't be reserved for a later request while an earlier one still needs it; once the earlier is reserved, the later fits what is left or not", async () => {
        const first = await approvedRequest(eventIds[0], FIRST, 3);
        const second = await approvedRequest(eventIds[1], SECOND, 2);

        expect(await reserve(second.id, 2)).toMatchObject({
          ok: false,
          error: "Nothing was reserved: an earlier request comes first for the rows marked below.",
        });
        expect(await prisma.reservation.count({ where: { equipmentId } })).toBe(0);

        expect((await reserve(first.id, 3)).ok).toBe(true);
        // Only 1 of the 4 is left now: SCRUM-155's shortfall, not this rule.
        expect(await reserve(second.id, 2)).toMatchObject({
          ok: false,
          error: "Nothing was reserved: not enough is free for the rows marked below.",
        });
      });

      it("SCRUM-134 [AC5] TC-134-05: once the earlier request is rejected, the later one is reserved", async () => {
        const first = await approvedRequest(eventIds[0], FIRST, 3);
        const second = await approvedRequest(eventIds[1], SECOND, 2);
        await prisma.equipmentRequest.update({ where: { id: first.id }, data: { status: "REJECTED" } });

        expect(await reserve(second.id, 2)).toEqual({ ok: true, data: { reserved: 1 } });
      });

      it("SCRUM-134 [AC4] TC-134-04: the review queue shows, on each line, the other open requests for the type with when they were submitted and what is reserved", async () => {
        const first = await approvedRequest(eventIds[0], FIRST, 3);
        const second = await approvedRequest(eventIds[1], SECOND, 2);
        await reserve(first.id, 3);

        const queue = await getEquipmentRequestQueue();
        const lineOf = (id: string) => queue.find((r) => r.id === id)!.lines[0];
        expect(lineOf(second.id).competing).toEqual([
          {
            requestId: first.id,
            eventName: `First-come event 1 ${STAMP}`,
            submittedAt: FIRST,
            quantity: 3,
            reserved: 3,
          },
        ]);
        expect(lineOf(first.id).competing).toEqual([
          expect.objectContaining({ requestId: second.id, submittedAt: SECOND, reserved: 0 }),
        ]);
      });
    });
  },
);

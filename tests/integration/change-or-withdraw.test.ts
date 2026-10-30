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
import type { EventStatus, Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  changeEquipmentRequest,
  updateEquipmentRequestStatus,
  withdrawEquipmentRequest,
} from "@/app/(app)/equipment-requests/actions";
import { confirmEvent } from "@/app/(app)/events/actions";
import { getReadinessChecklist } from "@/lib/event-readiness";
import {
  submitBookingRequest,
  withdrawBookingRequest,
} from "@/app/(app)/bookings/actions";
import { eventBookingPeriod } from "@/lib/schemas/booking";
import { reserveEquipmentRequest } from "@/app/(app)/equipment/actions";
import { getReservableRequests } from "@/lib/equipment/request-queries";
import { withHours } from "../venue-hours-fixture";

// SCRUM-142 against a real, seeded Postgres: what changing or withdrawing an
// equipment request, and withdrawing a venue request, write — the lines, the
// reservations returned to the pool, the history, the staff notices and the
// safety check — and what is refused. Only the session is mocked. Each test
// makes its own events (assigned to the second seeded Coordinator), venue,
// requests and reservations, and the suite removes them, so it only runs on
// a localhost database.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
const mockAuth = auth as unknown as Mock;

const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

const COORDINATOR = "usr_coordinator_2";
const signIn = (id: string, role: Role) =>
  mockAuth.mockResolvedValue({
    user: { id, role, name: id, email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  });
const STAMP = Date.now();
const DAY = 24 * 60 * 60 * 1000;
const PROJECTOR = "eqp_projector";
const MIC = "eqp_mic";
const LECTERN = "eqp_lectern";
// Reserved only by TC-142-17, so the pool for the shared period has room.
const SPEAKER = "eqp_speaker";

describe.skipIf(!usesLocalDatabase)(
  "changing or withdrawing requests — real database (SCRUM-142)",
  () => {
    const eventIds: string[] = [];
    let venueId: string;

    async function event(status: EventStatus = "PLANNING") {
      const startAt = new Date(Date.now() + 40 * DAY);
      const row = await prisma.event.create({
        data: {
          name: `SCRUM-142 ${eventIds.length} ${STAMP}`,
          status,
          organiserId: "usr_organiser",
          coordinatorId: COORDINATOR,
          startAt,
          endAt: new Date(startAt.getTime() + 4 * 60 * 60 * 1000),
          expectedAttendance: 40,
        },
        select: { id: true, startAt: true, endAt: true },
      });
      eventIds.push(row.id);
      return row;
    }

    /** An Approved request for Projector × 2, Mic × 3 and Lectern × 1, each reserved. */
    async function reservedRequest(eventStatus: EventStatus = "PLANNING") {
      const ev = await event(eventStatus);
      const request = await prisma.equipmentRequest.create({
        data: {
          eventId: ev.id,
          requestedById: COORDINATOR,
          status: "APPROVED",
          lines: {
            create: [
              { equipmentId: PROJECTOR, quantity: 2 },
              { equipmentId: MIC, quantity: 3 },
              { equipmentId: LECTERN, quantity: 1 },
            ],
          },
        },
        select: { id: true },
      });
      for (const [equipmentId, quantity] of [
        [PROJECTOR, 2],
        [MIC, 3],
        [LECTERN, 1],
      ] as const) {
        await prisma.reservation.create({
          data: {
            eventId: ev.id,
            equipmentId,
            requestId: request.id,
            quantity,
            startAt: ev.startAt!,
            endAt: ev.endAt!,
            reservedById: "usr_techsupport",
          },
        });
      }
      return { eventId: ev.id, requestId: request.id };
    }

    const reservations = (eventId: string) =>
      prisma.reservation.findMany({
        where: { eventId },
        select: { equipmentId: true, status: true },
        orderBy: { equipmentId: "asc" },
      });
    const lines = (requestId: string) =>
      prisma.equipmentRequestLine.findMany({
        where: { requestId },
        select: {
          id: true,
          equipmentId: true,
          quantity: true,
          removedAt: true,
        },
        orderBy: { equipmentId: "asc" },
      });
    const statusOf = async (requestId: string) =>
      (
        await prisma.equipmentRequest.findUniqueOrThrow({
          where: { id: requestId },
          select: { status: true },
        })
      ).status;
    const history = (requestId: string) =>
      prisma.equipmentRequestUpdate.findMany({
        where: { requestId },
        select: { fromStatus: true, toStatus: true, note: true },
        orderBy: { createdAt: "asc" },
      });
    const staffNotices = (eventId: string) =>
      prisma.notification.findMany({
        where: { eventId },
        select: { type: true, user: { select: { role: true, additionalRoles: true } } },
      });
    /** AC7: one notice of this type for every member of the role, and no other. */
    const expectRoleNotified = async (
      eventId: string,
      type: string,
      role: "TECH_SUPPORT" | "VENUE_STAFF",
    ) => {
      // SCRUM-121: everyone who holds the role, as primary or additional.
      const members = await prisma.user.count({
        where: { OR: [{ role }, { additionalRoles: { has: role } }] },
      });
      expect(members).toBeGreaterThan(0);
      const notices = await staffNotices(eventId);
      expect(notices).toHaveLength(members);
      expect(
        notices.every(
          (n) =>
            n.type === type &&
            (n.user.role === role || n.user.additionalRoles.includes(role)),
        ),
      ).toBe(true);
    };
    const safetyCheck = (
      eventId: string,
      status: "AWAITING_REVIEW" | "APPROVED" | "REJECTED",
    ) =>
      prisma.safetyCheck.create({
        data: {
          eventId,
          status,
          requestedById: COORDINATOR,
          // An outcome records who and when, and a rejection its note.
          ...(status === "AWAITING_REVIEW"
            ? {}
            : {
                decidedById: "usr_venuestaff",
                decidedAt: new Date(),
                note: "Exit route blocked.",
              }),
        },
        select: { id: true },
      });
    const safetyStatus = async (id: string) =>
      await prisma.safetyCheck.findUniqueOrThrow({
        where: { id },
        select: { status: true, outdatedAt: true },
      });

    beforeAll(async () => {
      venueId = (
        await prisma.venue.create({
          data: {
            name: `SCRUM-142 venue ${STAMP}`,
            location: "Test block",
            capacity: 500,
            ...withHours,
          },
        })
      ).id;
    });

    beforeEach(() => signIn(COORDINATOR, "COORDINATOR"));

    afterAll(async () => {
      const requestIds = (
        await prisma.equipmentRequest.findMany({
          where: { eventId: { in: eventIds } },
          select: { id: true },
        })
      ).map((r) => r.id);
      const bookingIds = (
        await prisma.booking.findMany({
          where: { eventId: { in: eventIds } },
          select: { id: true },
        })
      ).map((b) => b.id);
      await prisma.notification.deleteMany({
        where: { eventId: { in: eventIds } },
      });
      await prisma.auditLog.deleteMany({
        where: { entityId: { in: [...eventIds, ...bookingIds] } },
      });
      await prisma.reservation.deleteMany({
        where: { eventId: { in: eventIds } },
      });
      await prisma.equipmentRequestUpdate.deleteMany({
        where: { requestId: { in: requestIds } },
      });
      await prisma.equipmentRequest.deleteMany({
        where: { id: { in: requestIds } },
      });
      await prisma.booking.deleteMany({ where: { eventId: { in: eventIds } } });
      await prisma.safetyCheck.deleteMany({
        where: { eventId: { in: eventIds } },
      });
      await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
      // TC-142-18's own venue, should that test time out before its finally.
      await prisma.venue.deleteMany({
        where: { name: `SCRUM-142 AC10 venue ${STAMP}` },
      });
      await prisma.venue.delete({ where: { id: venueId } });
    });

    it("SCRUM-142 [AC1, AC2, AC7] TC-142-01, TC-142-02: changing lines sends the request back to Pending Review, releases what changed lines had reserved, records it and tells Technical Support", async () => {
      const { eventId, requestId } = await reservedRequest();

      const result = await changeEquipmentRequest({
        requestId,
        lines: [
          { equipmentId: PROJECTOR, quantity: 2 },
          { equipmentId: MIC, quantity: 4 },
          { equipmentId: "eqp_laptop", quantity: 1 },
        ],
      });

      expect(result).toEqual({
        ok: true,
        data: { id: requestId, changed: true },
      });
      expect(await statusOf(requestId)).toBe("PENDING_REVIEW");
      expect(
        (await lines(requestId)).map((l) => [
          l.equipmentId,
          l.quantity,
          l.removedAt !== null,
        ]),
      ).toEqual([
        ["eqp_laptop", 1, false],
        [LECTERN, 1, true],
        [MIC, 4, false],
        [PROJECTOR, 2, false],
      ]);
      // The unchanged projector line keeps its reservation; mic and lectern return.
      expect(await reservations(eventId)).toEqual([
        { equipmentId: LECTERN, status: "CANCELLED" },
        { equipmentId: MIC, status: "CANCELLED" },
        { equipmentId: PROJECTOR, status: "CONFIRMED" },
      ]);
      expect(await history(requestId)).toEqual([
        {
          fromStatus: "APPROVED",
          toStatus: "PENDING_REVIEW",
          note: expect.stringMatching(
            /^Changed by the Coordinator: added Laptop × 1; .* 3 → 4; removed .*\. 2 reservation\(s\) cancelled\.$/,
          ),
        },
      ]);
      await expectRoleNotified(
        eventId,
        "EQUIPMENT_REQUEST_CHANGED",
        "TECH_SUPPORT",
      );
    });

    it("SCRUM-142 [AC1] TC-142-03: adding a removed type again brings its line back rather than adding a second", async () => {
      const { requestId } = await reservedRequest();
      await changeEquipmentRequest({
        requestId,
        lines: [
          { equipmentId: PROJECTOR, quantity: 2 },
          { equipmentId: MIC, quantity: 3 },
        ],
      });
      const removed = (await lines(requestId)).find(
        (l) => l.equipmentId === LECTERN,
      )!;

      await changeEquipmentRequest({
        requestId,
        lines: [
          { equipmentId: PROJECTOR, quantity: 2 },
          { equipmentId: MIC, quantity: 3 },
          { equipmentId: LECTERN, quantity: 2 },
        ],
      });

      const lectern = (await lines(requestId)).filter(
        (l) => l.equipmentId === LECTERN,
      );
      expect(lectern).toEqual([
        { id: removed.id, equipmentId: LECTERN, quantity: 2, removedAt: null },
      ]);
    });

    it("SCRUM-142 [AC8] TC-142-04: the same lines again change nothing: no status, history, reservation or notice is written", async () => {
      const { eventId, requestId } = await reservedRequest();

      const result = await changeEquipmentRequest({
        requestId,
        lines: [
          { equipmentId: LECTERN, quantity: 1 },
          { equipmentId: PROJECTOR, quantity: 2 },
          { equipmentId: MIC, quantity: 3 },
        ],
      });

      expect(result).toEqual({
        ok: true,
        data: { id: requestId, changed: false },
      });
      expect(await statusOf(requestId)).toBe("APPROVED");
      expect(await history(requestId)).toEqual([]);
      expect(
        (await reservations(eventId)).every((r) => r.status === "CONFIRMED"),
      ).toBe(true);
      expect(await staffNotices(eventId)).toEqual([]);
    });

    it("SCRUM-142 [AC3, AC7, AC8] TC-142-05: withdrawing the whole request cancels it and returns all its reserved equipment, once", async () => {
      const { eventId, requestId } = await reservedRequest();

      expect(await withdrawEquipmentRequest({ requestId })).toEqual({
        ok: true,
        data: { id: requestId },
      });
      expect(await withdrawEquipmentRequest({ requestId })).toEqual({
        ok: false,
        error: "This request has already been withdrawn.",
      });

      expect(await statusOf(requestId)).toBe("CANCELLED");
      expect((await reservations(eventId)).map((r) => r.status)).toEqual([
        "CANCELLED",
        "CANCELLED",
        "CANCELLED",
      ]);
      expect(await history(requestId)).toEqual([
        {
          fromStatus: "APPROVED",
          toStatus: "CANCELLED",
          note: "Withdrawn by the Coordinator. 3 reservation(s) cancelled.",
        },
      ]);
      await expectRoleNotified(
        eventId,
        "EQUIPMENT_REQUEST_WITHDRAWN",
        "TECH_SUPPORT",
      );
    });

    it("SCRUM-142 [AC3] TC-142-06: a Rejected request can't be changed or withdrawn; a new one is raised instead", async () => {
      const { requestId } = await reservedRequest();
      await prisma.equipmentRequest.update({
        where: { id: requestId },
        data: { status: "REJECTED" },
      });

      for (const attempt of [
        () => withdrawEquipmentRequest({ requestId }),
        () =>
          changeEquipmentRequest({
            requestId,
            lines: [{ equipmentId: PROJECTOR, quantity: 1 }],
          }),
      ]) {
        expect(await attempt()).toEqual({
          ok: false,
          error: "This request was rejected. Raise a new request instead.",
        });
      }
      expect(await history(requestId)).toEqual([]);
    });

    it("SCRUM-142 [AC5] TC-142-09: once the event is Confirmed, nothing can be changed or withdrawn here, and nothing is written", async () => {
      const { eventId, requestId } = await reservedRequest("CONFIRMED");
      const booking = await prisma.booking.create({
        data: {
          eventId,
          venueId,
          startAt: new Date(Date.now() + 40 * DAY),
          endAt: new Date(Date.now() + 41 * DAY),
          status: "PENDING",
          requestedById: COORDINATOR,
        },
        select: { id: true },
      });
      const confirmed =
        "This event is confirmed, so its arrangements change through a change request.";

      expect(await withdrawEquipmentRequest({ requestId })).toEqual({
        ok: false,
        error: confirmed,
      });
      expect(
        await changeEquipmentRequest({
          requestId,
          lines: [{ equipmentId: MIC, quantity: 1 }],
        }),
      ).toEqual({ ok: false, error: confirmed });
      expect(await withdrawBookingRequest({ bookingId: booking.id })).toEqual({
        ok: false,
        error: confirmed,
      });

      expect(await statusOf(requestId)).toBe("APPROVED");
      expect(
        (await reservations(eventId)).every((r) => r.status === "CONFIRMED"),
      ).toBe(true);
      expect(
        (await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } }))
          .status,
      ).toBe("PENDING");
    });

    it("SCRUM-142 [AC7] TC-142-11: a Coordinator not assigned to the event gets the same not found as a missing request", async () => {
      const { requestId } = await reservedRequest();
      signIn("usr_coordinator", "COORDINATOR");

      expect(await withdrawEquipmentRequest({ requestId })).toEqual({
        ok: false,
        error: "Equipment request not found.",
      });
      expect(
        await withdrawEquipmentRequest({ requestId: "eqr_missing" }),
      ).toEqual({
        ok: false,
        error: "Equipment request not found.",
      });
      expect(await statusOf(requestId)).toBe("APPROVED");
    });

    it("SCRUM-142 [AC3] TC-142-13: two withdrawals at the same moment cancel the request once, with one history entry", async () => {
      const { eventId, requestId } = await reservedRequest();

      const results = await Promise.all([
        withdrawEquipmentRequest({ requestId }),
        withdrawEquipmentRequest({ requestId }),
      ]);

      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(await history(requestId)).toHaveLength(1);
      expect(
        (await reservations(eventId)).filter((r) => r.status === "CANCELLED"),
      ).toHaveLength(3);
    });

    it("SCRUM-142 [AC5] TC-142-16: a withdrawal waiting behind a Confirm for the event lock is refused once the event is Confirmed", async () => {
      const { eventId, requestId } = await reservedRequest();
      let commitConfirm!: () => void;
      const confirmHeld = new Promise<void>(
        (resolve) => (commitConfirm = resolve),
      );
      let locked!: () => void;
      const eventLocked = new Promise<void>((resolve) => (locked = resolve));

      // What confirmEvent does: lock the event, confirm it, commit.
      const confirming = prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`;
          await tx.event.update({
            where: { id: eventId },
            data: { status: "CONFIRMED" },
          });
          locked();
          await confirmHeld;
        },
        { timeout: 15_000 },
      );
      await eventLocked;
      // Read before the Confirm commits, so its first check passes; it then
      // waits for the event lock.
      const withdrawing = withdrawEquipmentRequest({ requestId });
      // Commit only once the withdrawal is waiting on that lock, so the test
      // proves the re-check under the lock and not the first check.
      const waitingOnLock = async () =>
        (
          await prisma.$queryRaw<{ waiting: number }[]>`
            SELECT count(*)::int AS waiting FROM pg_locks WHERE NOT granted`
        )[0].waiting > 0;
      try {
        for (let tries = 0; !(await waitingOnLock()); tries++) {
          if (tries > 60)
            throw new Error("the withdrawal never waited for the event lock");
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      } finally {
        // Never leave the Confirm's transaction open for the next test.
        commitConfirm();
        await confirming;
      }

      expect(await withdrawing).toEqual({
        ok: false,
        error:
          "This event is confirmed, so its arrangements change through a change request.",
      });
      expect(await statusOf(requestId)).toBe("APPROVED");
      expect(
        (await reservations(eventId)).every((r) => r.status === "CONFIRMED"),
      ).toBe(true);
    });

    it("SCRUM-142 [AC1] TC-142-14: an Approved request can't go back to review while the event already has another request waiting", async () => {
      const { eventId, requestId } = await reservedRequest();
      await prisma.equipmentRequest.create({
        data: { eventId, requestedById: COORDINATOR, status: "PENDING_REVIEW" },
      });

      expect(
        await changeEquipmentRequest({
          requestId,
          lines: [{ equipmentId: MIC, quantity: 1 }],
        }),
      ).toEqual({
        ok: false,
        error:
          "This event already has another equipment request waiting for review. Change that one instead.",
      });
      expect(await statusOf(requestId)).toBe("APPROVED");
      expect(
        (await reservations(eventId)).every((r) => r.status === "CONFIRMED"),
      ).toBe(true);
    });

    it("SCRUM-142 [AC4, AC7, AC8] TC-142-07: withdrawing a pending venue request cancels only it, tells Venue Staff, and lets the event request the venue again", async () => {
      const ev = await event();
      const period = eventBookingPeriod({
        startAt: ev.startAt!,
        endAt: ev.endAt!,
      })!;
      const pending = await prisma.booking.create({
        data: {
          eventId: ev.id,
          venueId,
          ...period,
          status: "PENDING",
          requestedById: COORDINATOR,
        },
        select: { id: true },
      });
      const other = await prisma.booking.create({
        data: {
          eventId: ev.id,
          venueId: "ven_hall",
          ...period,
          status: "APPROVED",
          requestedById: COORDINATOR,
        },
        select: { id: true },
      });

      expect(await withdrawBookingRequest({ bookingId: pending.id })).toEqual({
        ok: true,
        data: { status: "CANCELLED" },
      });
      expect(await withdrawBookingRequest({ bookingId: pending.id })).toEqual({
        ok: false,
        error: "This request has already been withdrawn.",
      });

      const statuses = await prisma.booking.findMany({
        where: { id: { in: [pending.id, other.id] } },
        select: { id: true, status: true },
      });
      expect(Object.fromEntries(statuses.map((b) => [b.id, b.status]))).toEqual(
        {
          [pending.id]: "CANCELLED",
          [other.id]: "APPROVED",
        },
      );
      await expectRoleNotified(
        ev.id,
        "BOOKING_REQUEST_WITHDRAWN",
        "VENUE_STAFF",
      );

      // The event's approved booking is still its one venue (SCRUM-50 AC8), so
      // it is returned rather than a new request made; the withdrawn one isn't.
      await prisma.booking.update({
        where: { id: other.id },
        data: { status: "CANCELLED" },
      });
      expect(
        await submitBookingRequest({
          eventId: ev.id,
          venueId,
          startAt: period.startAt.toISOString(),
          endAt: period.endAt.toISOString(),
          requestedAttendance: 40,
        }),
      ).toMatchObject({ ok: true, data: { created: true } });
    });

    it("SCRUM-142 [AC4, AC6] TC-142-08, TC-142-10: a Held booking is released instead, and an Approved one isn't withdrawn here", async () => {
      const ev = await event();
      const period = eventBookingPeriod({
        startAt: ev.startAt!,
        endAt: ev.endAt!,
      })!;
      const held = await prisma.booking.create({
        data: {
          eventId: ev.id,
          venueId,
          ...period,
          status: "HELD",
          requestedById: COORDINATOR,
          heldAt: new Date(Date.now() - 60 * 1000),
          holdExpiresAt: new Date(Date.now() + DAY),
          holdNote: "Confirm numbers.",
        },
        select: { id: true },
      });
      const approved = await prisma.booking.create({
        data: {
          eventId: ev.id,
          venueId: "ven_hall",
          ...period,
          status: "APPROVED",
          requestedById: COORDINATOR,
        },
        select: { id: true },
      });

      expect(await withdrawBookingRequest({ bookingId: held.id })).toEqual({
        ok: true,
        data: { status: "CANCELLED" },
      });
      expect(await withdrawBookingRequest({ bookingId: approved.id })).toEqual({
        ok: false,
        error:
          "An approved booking isn't withdrawn here. It is cancelled by resolving its flag, or by cancelling or rejecting the event.",
      });
      expect(
        (await prisma.booking.findUniqueOrThrow({ where: { id: approved.id } }))
          .status,
      ).toBe("APPROVED");
    });

    it("SCRUM-142 [AC9] TC-142-12: a change or withdrawal puts an Approved or awaiting safety check out of date, and leaves a Rejected one", async () => {
      const first = await reservedRequest();
      const awaiting = await safetyCheck(first.eventId, "AWAITING_REVIEW");
      const rejected = await safetyCheck(first.eventId, "REJECTED");
      await changeEquipmentRequest({
        requestId: first.requestId,
        lines: [{ equipmentId: PROJECTOR, quantity: 1 }],
      });

      const second = await reservedRequest();
      const approved = await safetyCheck(second.eventId, "APPROVED");
      await withdrawEquipmentRequest({ requestId: second.requestId });

      expect(await safetyStatus(awaiting.id)).toEqual({
        status: "OUTDATED",
        outdatedAt: expect.any(Date),
      });
      expect(await safetyStatus(approved.id)).toMatchObject({
        status: "OUTDATED",
      });
      expect(await safetyStatus(rejected.id)).toEqual({
        status: "REJECTED",
        outdatedAt: null,
      });
    });

    it("SCRUM-142 [AC8] TC-142-13: the same change sent twice at once, on a request already in Pending Review, is written once", async () => {
      const { requestId } = await reservedRequest();
      await prisma.equipmentRequest.update({
        where: { id: requestId },
        data: { status: "PENDING_REVIEW" },
      });
      const change = () =>
        changeEquipmentRequest({
          requestId,
          lines: [
            { equipmentId: PROJECTOR, quantity: 2 },
            { equipmentId: MIC, quantity: 3 },
            { equipmentId: LECTERN, quantity: 1 },
            { equipmentId: "eqp_laptop", quantity: 1 },
          ],
        });

      const results = await Promise.all([change(), change()]);

      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(results.find((r) => !r.ok)).toMatchObject({
        error: expect.stringMatching(
          /^Someone else updated this request first/,
        ),
      });
      expect(await history(requestId)).toHaveLength(1);
      expect(
        (await lines(requestId)).filter((l) => l.equipmentId === "eqp_laptop"),
      ).toHaveLength(1);
    });

    it("SCRUM-142 [AC9] TC-142-12: withdrawing a venue request, or releasing a hold, puts the event's safety check out of date", async () => {
      const ev = await event();
      const period = eventBookingPeriod({
        startAt: ev.startAt!,
        endAt: ev.endAt!,
      })!;
      const pending = await prisma.booking.create({
        data: {
          eventId: ev.id,
          venueId,
          ...period,
          status: "PENDING",
          requestedById: COORDINATOR,
        },
        select: { id: true },
      });
      const first = await safetyCheck(ev.id, "AWAITING_REVIEW");

      await withdrawBookingRequest({ bookingId: pending.id });
      expect(await safetyStatus(first.id)).toMatchObject({
        status: "OUTDATED",
      });

      const held = await prisma.booking.create({
        data: {
          eventId: ev.id,
          venueId,
          ...period,
          status: "HELD",
          requestedById: COORDINATOR,
          heldAt: new Date(Date.now() - 60 * 1000),
          holdExpiresAt: new Date(Date.now() + DAY),
          holdNote: "Confirm numbers.",
        },
        select: { id: true },
      });
      const second = await safetyCheck(ev.id, "APPROVED");

      await withdrawBookingRequest({ bookingId: held.id });
      expect(await safetyStatus(second.id)).toMatchObject({
        status: "OUTDATED",
      });
    });

    it("SCRUM-142 [AC1, AC2] TC-142-17: a reserve form opened before the lines changed is refused, even once the request is approved again", async () => {
      const ev = await event();
      const { id: requestId } = await prisma.equipmentRequest.create({
        data: {
          eventId: ev.id,
          requestedById: COORDINATOR,
          status: "APPROVED",
          lines: { create: [{ equipmentId: SPEAKER, quantity: 3 }] },
        },
        select: { id: true },
      });
      // What Technical Support's reserve form loaded.
      const opened = (await getReservableRequests()).find(
        (r) => r.id === requestId,
      )!;
      const reserve = (requestVersion: string) =>
        reserveEquipmentRequest({
          requestId,
          requestVersion,
          startAt: ev.startAt!.toISOString(),
          endAt: ev.endAt!.toISOString(),
          lines: [{ equipmentId: SPEAKER, quantity: 3 }],
        });

      // The Coordinator cuts the speakers to 1; Technical Support approve it again.
      expect(
        (
          await changeEquipmentRequest({
            requestId,
            lines: [{ equipmentId: SPEAKER, quantity: 1 }],
          })
        ).ok,
      ).toBe(true);
      await prisma.equipmentRequest.update({
        where: { id: requestId },
        data: { status: "APPROVED" },
      });

      signIn("usr_techsupport", "TECH_SUPPORT");
      expect(await reserve(opened.version)).toEqual({
        ok: false,
        error:
          "This request has changed since you opened it. Choose it again to see it as it is now.",
      });
      expect(await reservations(ev.id)).toEqual([]);

      const reopened = (await getReservableRequests()).find(
        (r) => r.id === requestId,
      )!;
      expect(reopened.lines.map((l) => l.quantity)).toEqual([1]);
      expect((await reserve(reopened.version)).ok).toBe(true);
    });

    it("SCRUM-142 [AC2, AC10] TC-142-19: when Technical Support rejects a changed request, what its unchanged lines still reserve returns to the pool, once", async () => {
      const { eventId, requestId } = await reservedRequest();

      // Removing the lectern releases it and keeps the projectors and mics (AC10).
      await changeEquipmentRequest({
        requestId,
        lines: [
          { equipmentId: PROJECTOR, quantity: 2 },
          { equipmentId: MIC, quantity: 3 },
        ],
      });
      expect((await reservations(eventId)).map((r) => r.status)).toEqual(
        expect.arrayContaining(["CONFIRMED", "CANCELLED"]),
      );

      signIn("usr_techsupport", "TECH_SUPPORT");
      for (const toStatus of ["IN_REVIEW", "REJECTED"] as const) {
        const note = toStatus === "REJECTED" ? "Not enough microphones." : undefined;
        expect(await updateEquipmentRequestStatus({ requestId, toStatus, note })).toEqual({
          ok: true,
          data: { status: toStatus },
        });
      }

      expect((await reservations(eventId)).every((r) => r.status === "CANCELLED")).toBe(true);
      const history = await prisma.equipmentRequestUpdate.findFirstOrThrow({
        where: { requestId, toStatus: "REJECTED" },
        select: { note: true },
      });
      expect(history.note).toBe("Not enough microphones. 2 reservation(s) cancelled.");
      // Rejecting again is refused, and nothing is released twice.
      expect(
        (await updateEquipmentRequestStatus({ requestId, toStatus: "REJECTED", note: "Again." })).ok,
      ).toBe(false);
    });

    it("SCRUM-142 [AC10] TC-142-18: after a line is only removed, Confirm waits for Technical Support to approve the request again", async () => {
      const { eventId, requestId } = await reservedRequest();
      const ev = await prisma.event.findUniqueOrThrow({
        where: { id: eventId },
        select: { startAt: true, endAt: true },
      });
      // Its own venue, so this approved booking can't overlap another test's.
      const venueName = `SCRUM-142 AC10 venue ${STAMP}`;
      // The setup is inside the try, so a later failure still removes the venue.
      try {
        const venue = await prisma.venue.create({
          data: {
            name: venueName,
            location: "Test block",
            capacity: 100,
            ...withHours,
          },
          select: { id: true },
        });
        await prisma.booking.create({
          data: {
            eventId,
            venueId: venue.id,
            ...eventBookingPeriod({ startAt: ev.startAt!, endAt: ev.endAt! })!,
            status: "APPROVED",
            requestedById: COORDINATOR,
          },
          select: { id: true },
        });
        const equipmentItem = async () =>
          (await getReadinessChecklist(prisma, eventId))!.items.find(
            (i) => i.name === "Equipment",
          );
        // SCRUM-166 AC9: ready also needs an approved safety check.
        await safetyCheck(eventId, "APPROVED");

        expect(await equipmentItem()).toMatchObject({
          complete: true,
          state: "Reserved",
        });
        expect((await getReadinessChecklist(prisma, eventId))!.ready).toBe(true);

        // Removing the lectern leaves the projectors and mics reserved.
        await changeEquipmentRequest({
          requestId,
          lines: [
            { equipmentId: PROJECTOR, quantity: 2 },
            { equipmentId: MIC, quantity: 3 },
          ],
        });
        expect(await statusOf(requestId)).toBe("PENDING_REVIEW");
        expect(await equipmentItem()).toMatchObject({
          complete: false,
          state: "Awaiting Technical Support review",
        });
        // The change also outdated the approved safety check (SCRUM-166 AC13).
        expect(await confirmEvent({ eventId })).toEqual({
          ok: false,
          error:
            "This event isn't ready to confirm yet. Outstanding: Equipment (Awaiting Technical Support review), Safety check (Outdated).",
        });
        expect(
          (
            await prisma.event.findUniqueOrThrow({
              where: { id: eventId },
              select: { status: true },
            })
          ).status,
        ).toBe("PLANNING");

        signIn("usr_techsupport", "TECH_SUPPORT");
        for (const toStatus of ["IN_REVIEW", "APPROVED"] as const) {
          expect(
            await updateEquipmentRequestStatus({ requestId, toStatus }),
          ).toEqual({ ok: true, data: { status: toStatus } });
        }
        expect(await equipmentItem()).toMatchObject({
          complete: true,
          state: "Reserved",
        });
        // Equipment is complete again; only a new safety check is outstanding.
        const after = (await getReadinessChecklist(prisma, eventId))!;
        expect(after.items.filter((i) => !i.complete).map((i) => i.state)).toEqual([
          "Outdated",
        ]);
      } finally {
        // By name and with deleteMany: afterAll may already have deleted the
        // booking, and the setup may have stopped before either was made.
        await prisma.booking.deleteMany({ where: { venue: { name: venueName } } });
        await prisma.venue.deleteMany({ where: { name: venueName } });
      }
      // About twenty round trips: over Vitest's 5 s default alongside other files.
    }, 30_000);
  },
);

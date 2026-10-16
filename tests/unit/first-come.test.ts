import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { Prisma, Role } from "@prisma/client";

import { auth } from "@/auth";
import {
  findCompetingRequests,
  submittedBefore,
} from "@/lib/venue-availability";
import {
  competingLines,
  openRequestLines,
  submittedFirst,
  type OpenRequestLine,
} from "@/lib/equipment/competing";
import { formatDateTime } from "@/lib/datetime";
import {
  decideBookingRequest,
  holdBookingRequest,
} from "@/app/(app)/bookings/actions";
import { getPendingBookingQueue } from "@/app/(app)/bookings/queries";
import { reserveEquipmentRequest } from "@/app/(app)/equipment/actions";

// SCRUM-134 — competing venue and equipment requests settled in the order
// they were made, with the database mocked. Against a real Postgres:
// tests/integration/first-come.test.ts. Test cases: docs/testing/SCRUM-134.md.
const db = vi.hoisted(() => ({
  booking: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  venueUnavailability: { findMany: vi.fn() },
  equipmentRequest: { findFirst: vi.fn(), findMany: vi.fn() },
  reservation: { findMany: vi.fn(), createMany: vi.fn() },
  equipmentUnavailability: { findMany: vi.fn() },
  auditLog: { create: vi.fn() },
  notification: { create: vi.fn(), createMany: vi.fn() },
  user: { findMany: vi.fn() },
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockAuth = auth as unknown as Mock;
const sessionFor = (role: Role, id: string): Session => ({
  user: { id, role, name: "Test User", email: `${id}@test.local` },
  expires: "2999-01-01T00:00:00.000Z",
});

const HOUR = 60 * 60 * 1000;
const at = (iso: string) => new Date(iso);
// The request being decided: 10:00 to 12:00 UTC on 1 Jun 2036, submitted at 09:00 on 1 Jan.
const START = at("2036-06-01T10:00:00.000Z");
const END = at("2036-06-01T12:00:00.000Z");
const SUBMITTED = at("2036-01-01T09:00:00.000Z");

const competitor = (
  id: string,
  createdAt: Date,
  startAt = START,
  endAt = END,
  name = `Event ${id}`,
) => ({ id, startAt, endAt, createdAt, event: { name } });

/** Answers the blocker lookup (Approved or Held) and the competitor lookup (Pending) apart. */
function pendingOthers(rows: ReturnType<typeof competitor>[]) {
  db.booking.findMany.mockImplementation(
    ({ where }: { where: { status?: unknown } }) =>
      Promise.resolve(where.status === "PENDING" ? rows : []),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation((cb: (tx: typeof db) => unknown) => cb(db));
  db.venueUnavailability.findMany.mockResolvedValue([]);
  db.user.findMany.mockResolvedValue([]);
  db.booking.updateMany.mockResolvedValue({ count: 1 });
  pendingOthers([]);
});

describe("submittedBefore and submittedFirst — SCRUM-134 AC2, AC5", () => {
  it("SCRUM-134 [AC2] TC-134-02: the earlier submission comes first, and the id settles a tie", () => {
    const a = { id: "a", createdAt: SUBMITTED };
    const b = { id: "b", createdAt: SUBMITTED };
    const later = { id: "0", createdAt: new Date(SUBMITTED.getTime() + 1) };
    expect(submittedBefore(a, later)).toBe(true);
    expect(submittedBefore(later, a)).toBe(false);
    expect(submittedBefore(a, b)).toBe(true);
    expect(submittedBefore(b, a)).toBe(false);
    expect(submittedBefore(a, a)).toBe(false);

    expect(submittedFirst({ requestId: "a", submittedAt: SUBMITTED }, { requestId: "b", submittedAt: SUBMITTED })).toBe(true);
    expect(submittedFirst({ requestId: "b", submittedAt: SUBMITTED }, { requestId: "a", submittedAt: SUBMITTED })).toBe(false);
  });
});

describe("findCompetingRequests — SCRUM-134 AC1, AC3", () => {
  const booking = { id: "bkg_me", venueId: "ven_1", startAt: START, endAt: END };

  it("SCRUM-134 [AC1, AC3] TC-134-01, TC-134-03: lists the other Pending requests whose occupied periods overlap, not ones that only touch", async () => {
    pendingOthers([
      competitor("overlap", SUBMITTED, at("2036-06-01T11:00:00.000Z"), at("2036-06-01T13:00:00.000Z"), "Overlap"),
      competitor("touchesEnd", SUBMITTED, END, at("2036-06-01T14:00:00.000Z")),
      competitor("touchesStart", SUBMITTED, at("2036-06-01T08:00:00.000Z"), START),
    ]);

    const found = await findCompetingRequests(
      db as unknown as Prisma.TransactionClient,
      booking,
      { setupMinutes: 0, turnaroundMinutes: 0 },
    );

    expect(found).toEqual([
      {
        id: "overlap",
        startAt: at("2036-06-01T11:00:00.000Z"),
        endAt: at("2036-06-01T13:00:00.000Z"),
        createdAt: SUBMITTED,
        eventName: "Overlap",
      },
    ]);
    const { where, orderBy } = db.booking.findMany.mock.calls[0][0];
    expect(where).toMatchObject({ venueId: "ven_1", status: "PENDING", id: { not: "bkg_me" } });
    expect(orderBy).toEqual([{ createdAt: "asc" }, { id: "asc" }]);
  });

  it("SCRUM-134 [AC1, AC3] TC-134-03: with the venue's setup and turnaround, requests that touched now compete (SCRUM-159)", async () => {
    pendingOthers([competitor("touchesEnd", SUBMITTED, END, at("2036-06-01T14:00:00.000Z"))]);

    const found = await findCompetingRequests(
      db as unknown as Prisma.TransactionClient,
      booking,
      { setupMinutes: 0, turnaroundMinutes: 30 },
    );

    expect(found.map((c) => c.id)).toEqual(["touchesEnd"]);
  });
});

describe("approving or holding with an earlier request pending — SCRUM-134 AC2, AC6", () => {
  const me = {
    id: "bkg_me",
    venueId: "ven_1",
    startAt: START,
    endAt: END,
    status: "PENDING",
    holdExpiresAt: null,
    holdApprovedAt: null,
    needsReconsideration: false,
    createdAt: SUBMITTED,
    requestedById: "usr_coord",
    venue: { name: "Hall A", setupMinutes: 0, turnaroundMinutes: 0 },
    event: { id: "evt_1", name: "Expo", coordinatorId: "usr_coord" },
  };
  const earlier = competitor("bkg_first", at("2035-12-31T09:00:00.000Z"), START, END, "First Fair");
  const refusal = `An earlier request for Hall A overlapping this period is still pending: "First Fair", submitted ${formatDateTime(at("2035-12-31T09:00:00.000Z"))}. Approve, hold or reject it first. This request is still pending.`;

  beforeEach(() => {
    mockAuth.mockResolvedValue(sessionFor("VENUE_STAFF", "usr_staff"));
    db.booking.findUnique.mockResolvedValue(me);
  });

  it("SCRUM-134 [AC2] TC-134-02: approving the later of two competing requests is refused, and nothing is written", async () => {
    pendingOthers([earlier]);

    expect(await decideBookingRequest({ bookingId: "bkg_me", decision: "APPROVED" })).toEqual({
      ok: false,
      error: refusal,
    });
    expect(db.booking.updateMany).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
    expect(db.notification.create).not.toHaveBeenCalled();
  });

  it("SCRUM-134 [AC2] TC-134-02: holding the later of two competing requests is refused, and nothing is written", async () => {
    pendingOthers([earlier]);

    expect(
      await holdBookingRequest({
        bookingId: "bkg_me",
        holdExpiresAt: new Date(Date.now() + 48 * HOUR).toISOString(),
        holdNote: "Confirm numbers.",
      }),
    ).toEqual({ ok: false, error: refusal });
    expect(db.booking.updateMany).not.toHaveBeenCalled();
  });

  it("SCRUM-134 [AC2] TC-134-02: the earlier request can be approved with a later one still pending", async () => {
    pendingOthers([competitor("bkg_later", at("2036-01-02T09:00:00.000Z"))]);

    expect(await decideBookingRequest({ bookingId: "bkg_me", decision: "APPROVED" })).toEqual({
      ok: true,
      data: { status: "APPROVED" },
    });
  });

  it("SCRUM-134 [AC6] TC-134-06: rejecting the later request is never blocked, and the lookup isn't even made", async () => {
    pendingOthers([earlier]);

    expect(
      await decideBookingRequest({ bookingId: "bkg_me", decision: "REJECTED", reason: "Taken." }),
    ).toEqual({ ok: true, data: { status: "REJECTED" } });
    expect(db.booking.findMany).not.toHaveBeenCalled();
  });
});

describe("the pending queue — SCRUM-134 AC1", () => {
  const row = (status: "PENDING" | "HELD") => ({
    id: `bkg_${status}`,
    status,
    holdExpiresAt: status === "HELD" ? new Date(Date.now() + HOUR) : null,
    startAt: START,
    endAt: END,
    setupMinutes: 0,
    turnaroundMinutes: 0,
    createdAt: SUBMITTED,
    venue: { id: "ven_1", name: "Hall A", setupMinutes: 0, turnaroundMinutes: 0 },
  });

  it("SCRUM-134 [AC1] TC-134-01: each pending request carries its competitors, marked earlier or later; a hold carries none", async () => {
    const competitors = [
      competitor("bkg_first", at("2035-12-31T09:00:00.000Z")),
      competitor("bkg_after", at("2036-01-02T09:00:00.000Z")),
    ];
    db.booking.findMany.mockImplementation(({ where }: { where: { status?: unknown; OR?: unknown } }) =>
      Promise.resolve(where.OR ? [row("PENDING"), row("HELD")] : where.status === "PENDING" ? competitors : []),
    );

    const queue = await getPendingBookingQueue();

    expect(queue[0].competing.map((c) => [c.id, c.earlier])).toEqual([
      ["bkg_first", true],
      ["bkg_after", false],
    ]);
    expect(queue[1].competing).toEqual([]);
  });
});

describe("competingLines and openRequestLines — SCRUM-134 AC4", () => {
  const line = (requestId: string, submittedAt: Date, event: { startAt: Date; endAt: Date }, extra: Partial<OpenRequestLine> = {}): OpenRequestLine => ({
    requestId,
    submittedAt,
    eventName: `Event ${requestId}`,
    event,
    equipmentId: "eqp_projector",
    quantity: 2,
    reserved: 0,
    ...extra,
  });

  it("SCRUM-134 [AC4] TC-134-04: other open requests for the type whose events overlap, earliest first; touching events, other types and the request itself are left out", () => {
    const lines = [
      line("eqr_late", at("2036-01-03T00:00:00.000Z"), { startAt: START, endAt: END }),
      line("eqr_early", at("2036-01-01T00:00:00.000Z"), { startAt: at("2036-06-01T11:00:00.000Z"), endAt: at("2036-06-01T15:00:00.000Z") }),
      line("eqr_touch", SUBMITTED, { startAt: END, endAt: at("2036-06-01T15:00:00.000Z") }),
      line("eqr_other", SUBMITTED, { startAt: START, endAt: END }, { equipmentId: "eqp_mic" }),
      line("eqr_me", SUBMITTED, { startAt: START, endAt: END }),
    ];

    expect(
      competingLines(lines, "eqr_me", "eqp_projector", { startAt: START, endAt: END }).map(
        (l) => l.requestId,
      ),
    ).toEqual(["eqr_early", "eqr_late"]);
  });

  it("SCRUM-134 [AC4] TC-134-04: reads each open request's lines with how much is reserved for each, from Pending Review, In Review and Approved requests with a dated event", async () => {
    db.equipmentRequest.findMany.mockResolvedValue([
      {
        id: "eqr_1",
        createdAt: SUBMITTED,
        event: {
          name: "Expo",
          startAt: START,
          endAt: END,
          reservations: [
            { requestId: "eqr_1", equipmentId: "eqp_projector", quantity: 1, startAt: START, endAt: END },
          ],
        },
        lines: [
          { equipmentId: "eqp_projector", quantity: 3 },
          { equipmentId: "eqp_mic", quantity: 2 },
        ],
      },
    ]);

    expect(await openRequestLines(db as unknown as Prisma.TransactionClient)).toEqual([
      { requestId: "eqr_1", submittedAt: SUBMITTED, eventName: "Expo", event: { startAt: START, endAt: END }, equipmentId: "eqp_projector", quantity: 3, reserved: 1 },
      { requestId: "eqr_1", submittedAt: SUBMITTED, eventName: "Expo", event: { startAt: START, endAt: END }, equipmentId: "eqp_mic", quantity: 2, reserved: 0 },
    ]);
    expect(db.equipmentRequest.findMany.mock.calls[0][0].where).toEqual({
      status: { in: ["PENDING_REVIEW", "IN_REVIEW", "APPROVED"] },
      event: { startAt: { not: null }, endAt: { not: null } },
    });
  });
});

describe("reserving with an earlier request waiting — SCRUM-134 AC5", () => {
  // The request being reserved was submitted on 2 Jan; a pool of 4 projectors.
  const request = {
    eventId: "evt_me",
    updatedAt: SUBMITTED,
    createdAt: at("2036-01-02T00:00:00.000Z"),
    event: { startAt: START, endAt: END, reservations: [] },
    lines: [{ equipmentId: "eqp_projector", quantity: 2 }],
  };
  const reserve = (quantity: number) =>
    reserveEquipmentRequest({
      requestId: "eqr_me",
      startAt: START.toISOString(),
      endAt: END.toISOString(),
      lines: [{ equipmentId: "eqp_projector", quantity: String(quantity) }],
    });
  const openRequest = (id: string, createdAt: Date, quantity: number, reserved: number) => ({
    id,
    createdAt,
    event: {
      name: `Event ${id}`,
      startAt: START,
      endAt: END,
      reservations: reserved
        ? [{ requestId: id, equipmentId: "eqp_projector", quantity: reserved, startAt: START, endAt: END }]
        : [],
    },
    lines: [{ equipmentId: "eqp_projector", quantity }],
  });

  beforeEach(() => {
    mockAuth.mockResolvedValue(sessionFor("TECH_SUPPORT", "usr_tech"));
    db.$queryRaw
      .mockResolvedValueOnce([{ id: "evt_me" }])
      .mockResolvedValueOnce([{ id: "eqr_me" }])
      .mockResolvedValueOnce([{ id: "eqp_projector", totalQuantity: 4 }]);
    db.equipmentRequest.findFirst.mockResolvedValue(request);
    db.reservation.findMany.mockResolvedValue([]);
    db.equipmentUnavailability.findMany.mockResolvedValue([]);
  });

  it("SCRUM-134 [AC5] TC-134-05: reserving for a later request is refused when it would leave too little for an earlier one, and nothing is reserved", async () => {
    db.equipmentRequest.findMany.mockResolvedValue([
      openRequest("eqr_first", at("2036-01-01T00:00:00.000Z"), 3, 0),
    ]);

    expect(await reserve(2)).toEqual({
      ok: false,
      error: "Nothing was reserved: an earlier request comes first for the rows marked below.",
      fieldErrors: {
        "lines.0.quantity": [
          `Reserving 2 would leave 2 free, but an earlier request still needs 3: "Event eqr_first", submitted ${formatDateTime(at("2036-01-01T00:00:00.000Z"))}. Reserve it first, or wait until it is rejected or cancelled.`,
        ],
      },
    });
    expect(db.reservation.createMany).not.toHaveBeenCalled();
  });

  it("SCRUM-134 [AC5] TC-134-05: leaving exactly what the earlier request still needs is allowed", async () => {
    db.equipmentRequest.findMany.mockResolvedValue([
      openRequest("eqr_first", at("2036-01-01T00:00:00.000Z"), 3, 1),
    ]);
    db.reservation.createMany.mockResolvedValue({ count: 1 });

    expect(await reserve(2)).toEqual({ ok: true, data: { reserved: 1 } });
  });

  it("SCRUM-134 [AC5] TC-134-05: an earlier request reserved in full, or a later one, doesn't stand in the way", async () => {
    db.equipmentRequest.findMany.mockResolvedValue([
      openRequest("eqr_first", at("2036-01-01T00:00:00.000Z"), 3, 3),
      openRequest("eqr_after", at("2036-01-05T00:00:00.000Z"), 4, 0),
    ]);
    db.reservation.createMany.mockResolvedValue({ count: 1 });

    expect(await reserve(2)).toEqual({ ok: true, data: { reserved: 1 } });
  });
});

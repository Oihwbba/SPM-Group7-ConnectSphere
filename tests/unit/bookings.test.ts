import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";
import type { Session } from "next-auth";
import type { Role } from "@prisma/client";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import {
  decideBookingRequest,
  submitBookingRequest,
} from "@/app/(app)/bookings/actions";

// SCRUM-50 / SCRUM-53 server actions with the database mocked: permission,
// validation and every refusal branch. The same criteria are proven against a
// real Postgres in tests/integration/bookings.test.ts, and the simultaneous
// approvals in tests/integration/concurrency.test.ts.
const db = vi.hoisted(() => ({
  event: { findUnique: vi.fn() },
  venue: { findFirst: vi.fn() },
  booking: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  venueUnavailability: { findMany: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockAuth = auth as unknown as Mock;

function sessionFor(role: Role, id = `usr_${role.toLowerCase()}`): Session {
  return {
    user: { id, role, name: "Test User", email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  };
}

/** What Prisma's pg adapter throws when Postgres refuses a write. */
function postgresRefusal(code: string, message: string) {
  return Object.assign(new Error(message), {
    name: "DriverAdapterError",
    cause: { originalCode: code, originalMessage: message },
  });
}
const duplicatePending = () =>
  postgresRefusal(
    "23P01",
    'conflicting key value violates exclusion constraint "booking_no_duplicate_pending_request"',
  );
const overlapsUnavailability = () =>
  postgresRefusal(
    "23P01",
    'conflicting key value violates exclusion constraint "booking_overlaps_unavailability"',
  );
const doubleBooking = () =>
  postgresRefusal(
    "23P01",
    'conflicting key value violates exclusion constraint "booking_no_double_booking"',
  );
const deadlock = () => postgresRefusal("40P01", "deadlock detected");

const START = "2030-06-01T06:00:00.000Z";
const END = "2030-06-01T08:00:00.000Z";

const validRequest = {
  eventId: "evt_1",
  venueId: "ven_1",
  startAt: START,
  endAt: END,
  requestedAttendance: 40,
  requiredFacilities: ["projector"],
  requestedLayout: "classroom",
};

const summaryRow = {
  id: "bkg_1",
  startAt: new Date(START),
  endAt: new Date(END),
  status: "PENDING",
  venue: { name: "Seminar Room" },
};
const summary = {
  id: "bkg_1",
  startAt: new Date(START),
  endAt: new Date(END),
  status: "PENDING",
  venueName: "Seminar Room",
};

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((cb: (tx: typeof db) => unknown) =>
    cb(db),
  );
  mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_coord"));
  db.event.findUnique.mockResolvedValue({
    organiserId: "usr_org",
    coordinatorId: "usr_coord",
    status: "APPROVED",
  });
  db.venue.findFirst.mockResolvedValue({ name: "Seminar Room", capacity: 60 });
  db.booking.findFirst.mockResolvedValue(null);
  db.booking.findMany.mockResolvedValue([]);
  db.venueUnavailability.findMany.mockResolvedValue([]);
  db.booking.create.mockResolvedValue(summaryRow);
});

describe("submitBookingRequest — SCRUM-50", () => {
  it("SCRUM-50 AC2 — a request for a free period is created PENDING", async () => {
    const result = await submitBookingRequest(validRequest);

    expect(result).toEqual({
      ok: true,
      data: { booking: summary, created: true },
    });
    expect(db.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PENDING",
          requestedById: "usr_coord",
          requestedAttendance: 40,
          requiredFacilities: ["projector"],
          requestedLayout: "classroom",
          requestNotes: null,
        }),
      }),
    );
  });

  it('SCRUM-50 AC1 — a layout or notes left blank ("No preference") is stored as not stated', async () => {
    await submitBookingRequest({
      ...validRequest,
      requestedLayout: "",
      requestNotes: "   ",
    });

    expect(db.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          requestedLayout: null,
          requestNotes: null,
        }),
      }),
    );
  });

  it("SCRUM-50 AC1 — over-long notes are refused against the notes field, so the form can show it there", async () => {
    const result = await submitBookingRequest({
      ...validRequest,
      requestNotes: "x".repeat(2001),
    });

    expect(result).toMatchObject({
      ok: false,
      fieldErrors: { requestNotes: [expect.any(String)] },
    });
    expect(db.booking.create).not.toHaveBeenCalled();
  });

  it("SCRUM-50 — expected attendance above the venue's capacity is refused against the attendance field, and nothing is written", async () => {
    const result = await submitBookingRequest({
      ...validRequest,
      requestedAttendance: 61,
    });

    const message =
      "Seminar Room holds up to 60 people; 61 expected is over its capacity.";
    expect(result).toEqual({
      ok: false,
      error: message,
      fieldErrors: { requestedAttendance: [message] },
    });
    expect(db.booking.create).not.toHaveBeenCalled();
  });

  it("SCRUM-50 — expected attendance exactly equal to the venue's capacity fits", async () => {
    const result = await submitBookingRequest({
      ...validRequest,
      requestedAttendance: 60,
    });

    expect(result.ok).toBe(true);
    expect(db.booking.create).toHaveBeenCalled();
  });

  describe("a start in the past", () => {
    afterEach(() => vi.useRealTimers());

    it("SCRUM-50 — a period that has already started is refused against the start field, and nothing is read or written", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(new Date(START).getTime() + 2 * 60_000));

      const result = await submitBookingRequest(validRequest);

      expect(result).toMatchObject({
        ok: false,
        error: "The start time cannot be in the past.",
        fieldErrors: { startAt: ["The start time cannot be in the past."] },
      });
      expect(db.event.findUnique).not.toHaveBeenCalled();
      expect(db.booking.create).not.toHaveBeenCalled();
    });

    it("SCRUM-50 — a start less than a minute ago still counts as now", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(new Date(START).getTime() + 30_000));

      const result = await submitBookingRequest(validRequest);

      expect(result.ok).toBe(true);
    });
  });

  it("SCRUM-50 — every role except Event Coordinator is refused before anything is read", async () => {
    for (const role of [
      "ORGANISER",
      "VENUE_STAFF",
      "TECH_SUPPORT",
      "ATTENDEE",
    ] as Role[]) {
      mockAuth.mockResolvedValue(sessionFor(role));
      const result = await submitBookingRequest(validRequest);
      expect(result).toEqual({
        ok: false,
        error: "You do not have permission to do that.",
      });
    }
    mockAuth.mockResolvedValue(null);
    expect((await submitBookingRequest(validRequest)).ok).toBe(false);
    expect(db.event.findUnique).not.toHaveBeenCalled();
    expect(db.booking.create).not.toHaveBeenCalled();
  });

  it("SCRUM-50 AC5 — an end before or equal to the start is reported as an invalid period", async () => {
    for (const endAt of ["2030-06-01T05:00:00.000Z", START]) {
      const result = await submitBookingRequest({ ...validRequest, endAt });
      expect(result).toMatchObject({
        ok: false,
        error:
          "The requested period is invalid: the end must be after the start.",
      });
    }
    expect(db.event.findUnique).not.toHaveBeenCalled();
  });

  it("SCRUM-50 AC1 — a request missing what the staff need is refused with field errors", async () => {
    const result = await submitBookingRequest({
      ...validRequest,
      venueId: "",
      requestedAttendance: 0,
    });

    expect(result).toMatchObject({
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: {
        venueId: ["Choose a venue."],
        requestedAttendance: ["Attendance must be greater than zero."],
      },
    });
  });

  it("SCRUM-50 — an event that does not exist, or is another coordinator's, reads as not found", async () => {
    db.event.findUnique.mockResolvedValueOnce(null);
    expect(await submitBookingRequest(validRequest)).toEqual({
      ok: false,
      error: "Event not found.",
    });

    db.event.findUnique.mockResolvedValueOnce({
      organiserId: "usr_org",
      coordinatorId: "usr_someone_else",
      status: "APPROVED",
    });
    expect(await submitBookingRequest(validRequest)).toEqual({
      ok: false,
      error: "Event not found.",
    });
    expect(db.booking.create).not.toHaveBeenCalled();
  });

  it("SCRUM-50 — a venue cannot be requested for an event that has not been approved", async () => {
    db.event.findUnique.mockResolvedValue({
      organiserId: "usr_org",
      coordinatorId: "usr_coord",
      status: "UNDER_REVIEW",
    });

    expect(await submitBookingRequest(validRequest)).toEqual({
      ok: false,
      error: "A venue can only be requested for an approved event.",
    });
  });

  it("SCRUM-50 — a retired or unknown venue is refused", async () => {
    db.venue.findFirst.mockResolvedValue(null);

    expect(await submitBookingRequest(validRequest)).toEqual({
      ok: false,
      error: "Venue not found.",
    });
  });

  it("SCRUM-50 AC6 — this coordinator's overlapping pending request for the same venue is returned instead of a new one, whatever its event", async () => {
    db.booking.findFirst.mockResolvedValue(summaryRow);

    const result = await submitBookingRequest(validRequest);

    expect(result).toEqual({
      ok: true,
      data: { booking: summary, created: false },
    });
    expect(db.booking.create).not.toHaveBeenCalled();
    expect(db.booking.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          requestedById: "usr_coord",
          venueId: "ven_1",
          status: "PENDING",
          startAt: { lt: new Date(END) },
          endAt: { gt: new Date(START) },
        },
      }),
    );
  });

  it("SCRUM-50 AC3 — a venue already booked for part of the period refuses the request and names the clash", async () => {
    db.booking.findMany.mockResolvedValue([
      {
        id: "bkg_x",
        startAt: new Date("2030-06-01T07:00:00.000Z"),
        endAt: new Date("2030-06-01T09:00:00.000Z"),
      },
    ]);

    const result = await submitBookingRequest(validRequest);

    expect(result).toEqual({
      ok: false,
      error:
        "Seminar Room is unavailable for that period: already booked from 1 Jun 2030, 3:00 pm SGT to 1 Jun 2030, 5:00 pm SGT.",
    });
    expect(db.booking.create).not.toHaveBeenCalled();
  });

  it("SCRUM-50 AC6 — a duplicate that races past the check is caught by the database and the winner is returned", async () => {
    db.booking.create.mockRejectedValue(duplicatePending());
    db.booking.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(summaryRow);

    expect(await submitBookingRequest(validRequest)).toEqual({
      ok: true,
      data: { booking: summary, created: false },
    });
  });

  it("SCRUM-50 AC6 — a deadlock between two identical submissions is retried once and then resolved", async () => {
    db.booking.create
      .mockRejectedValueOnce(deadlock())
      .mockResolvedValueOnce(summaryRow);

    const result = await submitBookingRequest(validRequest);

    expect(result.ok && result.data.created).toBe(true);
    expect(db.booking.create).toHaveBeenCalledTimes(2);
  });

  it("does not swallow a second deadlock, a vanished winner, or any other database error", async () => {
    db.booking.create.mockRejectedValue(deadlock());
    await expect(submitBookingRequest(validRequest)).rejects.toThrow(
      "deadlock detected",
    );

    db.booking.create.mockRejectedValue(duplicatePending());
    await expect(submitBookingRequest(validRequest)).rejects.toThrow(
      "booking_no_duplicate_pending_request",
    );

    db.booking.create.mockRejectedValue(new Error("connection lost"));
    await expect(submitBookingRequest(validRequest)).rejects.toThrow(
      "connection lost",
    );
  });
});

describe("decideBookingRequest — SCRUM-53", () => {
  const pendingBooking = {
    id: "bkg_1",
    venueId: "ven_1",
    startAt: new Date(START),
    endAt: new Date(END),
    status: "PENDING",
    venue: { name: "Seminar Room" },
  };

  beforeEach(() => {
    mockAuth.mockResolvedValue(sessionFor("VENUE_STAFF", "usr_staff"));
    db.booking.findUnique.mockResolvedValue(pendingBooking);
    db.booking.updateMany.mockResolvedValue({ count: 1 });
  });

  it("SCRUM-53 AC1 & AC3 — approving sets the request APPROVED and records who decided, when, and an audit entry", async () => {
    const result = await decideBookingRequest({
      bookingId: "bkg_1",
      decision: "APPROVED",
    });

    expect(result).toEqual({ ok: true, data: { status: "APPROVED" } });
    expect(db.booking.updateMany).toHaveBeenCalledWith({
      where: { id: "bkg_1", status: "PENDING" },
      data: expect.objectContaining({
        status: "APPROVED",
        decidedById: "usr_staff",
        decidedAt: expect.any(Date),
        decisionReason: null,
      }),
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityType: "Booking",
        entityId: "bkg_1",
        action: "APPROVED",
        actorId: "usr_staff",
        oldValue: "PENDING",
        newValue: "APPROVED",
      }),
    });
  });

  it("SCRUM-53 AC2 — rejecting saves the trimmed free-text reason", async () => {
    const result = await decideBookingRequest({
      bookingId: "bkg_1",
      decision: "REJECTED",
      reason: "  Too small for 40.  ",
    });

    expect(result).toEqual({ ok: true, data: { status: "REJECTED" } });
    expect(db.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "REJECTED",
          decisionReason: "Too small for 40.",
        }),
      }),
    );
    // Rejecting never needs the venue's availability.
    expect(db.booking.findMany).not.toHaveBeenCalled();
  });

  it("SCRUM-53 AC2 — rejecting with a blank reason is refused and nothing is read or written", async () => {
    for (const reason of [undefined, "", "   "]) {
      const result = await decideBookingRequest({
        bookingId: "bkg_1",
        decision: "REJECTED",
        reason,
      });
      expect(result).toMatchObject({
        ok: false,
        error: "A reason is required to reject a booking request.",
        fieldErrors: {
          reason: ["A reason is required to reject a booking request."],
        },
      });
    }
    expect(db.booking.findUnique).not.toHaveBeenCalled();
    expect(db.booking.updateMany).not.toHaveBeenCalled();
  });

  it("SCRUM-53 — a malformed decision is refused", async () => {
    const result = await decideBookingRequest({
      bookingId: "bkg_1",
      decision: "MAYBE",
    });

    expect(result).toMatchObject({
      ok: false,
      error: "Please provide a valid decision.",
    });
  });

  it("SCRUM-53 — every role except Venue Staff is refused", async () => {
    for (const role of [
      "ORGANISER",
      "COORDINATOR",
      "TECH_SUPPORT",
      "ATTENDEE",
    ] as Role[]) {
      mockAuth.mockResolvedValue(sessionFor(role));
      const result = await decideBookingRequest({
        bookingId: "bkg_1",
        decision: "APPROVED",
      });
      expect(result).toEqual({
        ok: false,
        error: "You do not have permission to do that.",
      });
    }
    expect(db.booking.updateMany).not.toHaveBeenCalled();
  });

  it("SCRUM-53 — an unknown request is reported as not found", async () => {
    db.booking.findUnique.mockResolvedValue(null);

    expect(
      await decideBookingRequest({ bookingId: "nope", decision: "APPROVED" }),
    ).toEqual({ ok: false, error: "Booking request not found." });
  });

  it("SCRUM-53 AC6 — a request that has already been decided keeps its first decision", async () => {
    db.booking.findUnique.mockResolvedValue({
      ...pendingBooking,
      status: "REJECTED",
    });

    expect(
      await decideBookingRequest({ bookingId: "bkg_1", decision: "APPROVED" }),
    ).toEqual({
      ok: false,
      error:
        "This request has already been rejected; the original decision stands.",
    });
    expect(db.booking.updateMany).not.toHaveBeenCalled();
  });

  it("SCRUM-53 AC6 — a decision that lands after another one wins writes nothing and says what stands", async () => {
    db.booking.updateMany.mockResolvedValue({ count: 0 });
    db.booking.findUniqueOrThrow.mockResolvedValue({ status: "APPROVED" });

    expect(
      await decideBookingRequest({
        bookingId: "bkg_1",
        decision: "REJECTED",
        reason: "No.",
      }),
    ).toEqual({
      ok: false,
      error:
        "This request has already been approved; the original decision stands.",
    });
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it("SCRUM-53 AC4 — approving over an approved booking or recorded unavailability is returned as conflicting", async () => {
    db.venueUnavailability.findMany.mockResolvedValue([
      {
        id: "vun_1",
        startAt: new Date("2030-06-01T07:00:00.000Z"),
        endAt: new Date("2030-06-01T10:00:00.000Z"),
        reason: "MAINTENANCE",
      },
    ]);

    expect(
      await decideBookingRequest({ bookingId: "bkg_1", decision: "APPROVED" }),
    ).toEqual({
      ok: false,
      error:
        "Conflicting: Seminar Room is unavailable (maintenance) from 1 Jun 2030, 3:00 pm SGT to 1 Jun 2030, 6:00 pm SGT. This request is still pending.",
    });
    expect(db.booking.updateMany).not.toHaveBeenCalled();
  });

  it("SCRUM-53 AC4 — when the database refuses a simultaneous overlapping approval, it is returned as conflicting", async () => {
    db.$transaction.mockRejectedValue(doubleBooking());

    const result = await decideBookingRequest({
      bookingId: "bkg_1",
      decision: "APPROVED",
    });

    expect(result).toMatchObject({
      ok: false,
      error: expect.stringMatching(
        /^Conflicting: .*approved at the same moment/,
      ),
    });
  });

  it("SCRUM-53 AC4 — a deadlock between simultaneous approvals is retried once", async () => {
    db.$transaction
      .mockRejectedValueOnce(deadlock())
      .mockImplementationOnce((cb: (tx: typeof db) => unknown) => cb(db));

    const result = await decideBookingRequest({
      bookingId: "bkg_1",
      decision: "APPROVED",
    });

    expect(result).toEqual({ ok: true, data: { status: "APPROVED" } });
    expect(db.$transaction).toHaveBeenCalledTimes(2);
  });

  it("SCRUM-37 AC4 — maintenance recorded at the same instant as an approval: the database refuses the approval, and it is returned as conflicting", async () => {
    db.$transaction.mockRejectedValue(overlapsUnavailability());

    const result = await decideBookingRequest({
      bookingId: "bkg_1",
      decision: "APPROVED",
    });

    expect(result).toMatchObject({
      ok: false,
      error: expect.stringMatching(
        /^Conflicting: the venue was recorded as unavailable/,
      ),
    });
  });

  it("SCRUM-37 AC1 — approving refreshes the availability calendar; rejecting does not need to", async () => {
    await decideBookingRequest({ bookingId: "bkg_1", decision: "APPROVED" });
    expect(revalidatePath).toHaveBeenCalledWith("/venues/availability");

    vi.mocked(revalidatePath).mockClear();
    await decideBookingRequest({
      bookingId: "bkg_1",
      decision: "REJECTED",
      reason: "No.",
    });
    expect(revalidatePath).not.toHaveBeenCalledWith("/venues/availability");
  });

  it("does not swallow an unexpected database error", async () => {
    db.$transaction.mockRejectedValue(new Error("connection lost"));

    await expect(
      decideBookingRequest({ bookingId: "bkg_1", decision: "APPROVED" }),
    ).rejects.toThrow("connection lost");
  });
});

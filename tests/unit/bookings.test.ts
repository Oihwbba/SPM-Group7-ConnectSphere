import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { Role } from "@prisma/client";

import { auth } from "@/auth";
import { submitBookingRequest } from "@/app/(app)/bookings/actions";

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
  db.venue.findFirst.mockResolvedValue({ name: "Seminar Room" });
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

  it("SCRUM-50 AC6 — an overlapping pending request for the same event and venue is returned instead of a new one", async () => {
    db.booking.findFirst.mockResolvedValue(summaryRow);

    const result = await submitBookingRequest(validRequest);

    expect(result).toEqual({
      ok: true,
      data: { booking: summary, created: false },
    });
    expect(db.booking.create).not.toHaveBeenCalled();
    expect(db.booking.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          eventId: "evt_1",
          venueId: "ven_1",
          status: "PENDING",
        }),
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
        "Seminar Room is unavailable for that period: already booked from 1 Jun 2030, 3:00 pm to 1 Jun 2030, 5:00 pm.",
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

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { recordUnavailability } from "@/app/(app)/venues/availability/actions";

// SCRUM-37 — recording non-booking unavailability, with the database mocked:
// permission, validation and every refusal branch. The same criteria are
// proven against real Postgres in tests/integration/unavailability.test.ts.
const db = vi.hoisted(() => ({
  venue: { findFirst: vi.fn() },
  booking: { findMany: vi.fn() },
  venueUnavailability: { findMany: vi.fn(), create: vi.fn() },
  $queryRaw: vi.fn(),
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

const START = "2034-05-03T01:00:00.000Z";
const END = "2034-05-03T09:00:00.000Z";
const valid = {
  venueId: "ven_1",
  startAt: START,
  endAt: END,
  reason: "MAINTENANCE",
};

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((work: (tx: typeof db) => unknown) =>
    work(db),
  );
  mockAuth.mockResolvedValue(sessionFor("VENUE_STAFF", "usr_staff"));
  db.venue.findFirst.mockResolvedValue({ name: "Seminar Room" });
  db.booking.findMany.mockResolvedValue([]);
  db.venueUnavailability.findMany.mockResolvedValue([]);
  db.venueUnavailability.create.mockResolvedValue({ id: "vun_1" });
});

describe("recordUnavailability — SCRUM-37", () => {
  it("SCRUM-37 AC2 — venue staff record a period and a reason; the calendar is refreshed", async () => {
    const result = await recordUnavailability({
      ...valid,
      note: "  Aircon.  ",
    });

    expect(result).toEqual({ ok: true, data: { id: "vun_1" } });
    expect(db.venueUnavailability.create).toHaveBeenCalledWith({
      data: {
        venueId: "ven_1",
        startAt: new Date(START),
        endAt: new Date(END),
        reason: "MAINTENANCE",
        note: "Aircon.",
        recordedById: "usr_staff",
      },
      select: { id: true },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/venues/availability");
  });

  it("SCRUM-37 AC2 — a blank note is stored as none", async () => {
    await recordUnavailability({ ...valid, note: "   " });

    expect(db.venueUnavailability.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ note: null }),
      }),
    );
  });

  it("SCRUM-37 AC2 — only venue staff may record unavailability", async () => {
    for (const role of [
      "ORGANISER",
      "COORDINATOR",
      "TECH_SUPPORT",
      "ATTENDEE",
      "COORDINATOR_LEAD",
      "SAFETY_OFFICER",
    ] as Role[]) {
      mockAuth.mockResolvedValue(sessionFor(role));
      expect(await recordUnavailability(valid)).toEqual({
        ok: false,
        error: "You do not have permission to do that.",
      });
    }
    expect(db.venueUnavailability.create).not.toHaveBeenCalled();
  });

  it("SCRUM-37 AC2 — an end at or before the start is refused as an invalid period", async () => {
    const result = await recordUnavailability({ ...valid, endAt: START });

    expect(result).toMatchObject({
      ok: false,
      error:
        "The requested period is invalid: the end must be after the start.",
    });
    expect(db.venue.findFirst).not.toHaveBeenCalled();
  });

  it("SCRUM-37 AC2 — a period with no reason is refused with field errors", async () => {
    const result = await recordUnavailability({ ...valid, reason: "" });

    expect(result).toMatchObject({
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: { reason: ["Choose a reason."] },
    });
  });

  it("SCRUM-37 — an unknown or retired venue is refused", async () => {
    db.venue.findFirst.mockResolvedValue(null);

    expect(await recordUnavailability(valid)).toEqual({
      ok: false,
      error: "Venue not found.",
    });
  });

  it("SCRUM-37 AC4 — an overlapping approved booking is surfaced and nothing is saved", async () => {
    db.booking.findMany.mockResolvedValue([
      {
        id: "bkg_1",
        startAt: new Date("2034-05-03T00:00:00.000Z"),
        endAt: new Date("2034-05-03T02:00:00.000Z"),
      },
    ]);

    expect(await recordUnavailability(valid)).toEqual({
      ok: false,
      error:
        "Not recorded: Seminar Room is already booked from 3 May 2034, 8:00 am SGT to 3 May 2034, 10:00 am SGT.",
    });
    expect(db.venueUnavailability.create).not.toHaveBeenCalled();
  });

  // Since SCRUM-172 the database accepts unavailability over a booking, so an
  // approval landing between the check and the write is no longer refused
  // there. The venue lock, which every approval also takes, keeps it out.
  it("SCRUM-37 AC4 — the venue is locked before the check and the write, so an approval can't land between them", async () => {
    await recordUnavailability(valid);

    const [lock] = db.$queryRaw.mock.calls[0];
    expect(lock.join("?")).toBe(
      'SELECT "id" FROM "Venue" WHERE "id" = ? FOR NO KEY UPDATE',
    );
    expect(db.$queryRaw.mock.calls[0].slice(1)).toEqual(["ven_1"]);
    const locked = db.$queryRaw.mock.invocationCallOrder[0];
    expect(locked).toBeLessThan(
      db.booking.findMany.mock.invocationCallOrder[0],
    );
    expect(locked).toBeLessThan(
      db.venueUnavailability.create.mock.invocationCallOrder[0],
    );
  });

  it("SCRUM-172 [AC5] TC-172-05: the five venue reasons are accepted, and Damaged and Closure no longer are", async () => {
    for (const reason of [
      "MAINTENANCE",
      "EQUIPMENT_FAILURE",
      "RENOVATION",
      "SAFETY_CONCERN",
      "OTHER",
    ]) {
      expect(await recordUnavailability({ ...valid, reason })).toMatchObject({
        ok: true,
      });
    }
    for (const reason of ["DAMAGED", "CLOSURE"]) {
      expect(await recordUnavailability({ ...valid, reason })).toMatchObject({
        ok: false,
        fieldErrors: { reason: ["Choose a reason."] },
      });
    }
    expect(db.venueUnavailability.create).toHaveBeenCalledTimes(5);
  });

  it("does not swallow an unexpected database error", async () => {
    db.venueUnavailability.create.mockRejectedValue(
      new Error("connection lost"),
    );

    await expect(recordUnavailability(valid)).rejects.toThrow(
      "connection lost",
    );
  });
});

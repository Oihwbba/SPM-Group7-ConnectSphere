import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { can } from "@/lib/auth/can";
import { recordSuitabilityJudgement } from "@/app/(app)/venues/suitability-actions";

// SCRUM-40 AC8 — the assigned Coordinator records a venue's suitability for
// their event, with the database mocked: the happy path, invalid input, and
// every refusal. tests/integration/venue-suitability.test.ts runs it against
// a real Postgres.
const db = vi.hoisted(() => ({
  event: { findUnique: vi.fn() },
  venue: { findFirst: vi.fn() },
  venueSuitabilityJudgement: { upsert: vi.fn() },
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

const valid = {
  eventId: "evt_1",
  venueId: "ven_1",
  suitable: false,
  note: "  Stairs only to the stage.  ",
};

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((work: (tx: typeof db) => unknown) =>
    work(db),
  );
  mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_coord"));
  db.event.findUnique.mockResolvedValue({
    organiserId: "usr_org",
    coordinatorId: "usr_coord",
    status: "PLANNING",
  });
  db.venue.findFirst.mockResolvedValue({ id: "ven_1" });
  db.venueSuitabilityJudgement.upsert.mockResolvedValue({ id: "vsj_1" });
});

describe("recordSuitabilityJudgement — SCRUM-40 AC8", () => {
  it("SCRUM-40 [AC8] TC-40-08: the assigned Coordinator records Not suitable with a note, one per event and venue, audited", async () => {
    const result = await recordSuitabilityJudgement(valid);

    expect(result).toEqual({ ok: true, data: { suitable: false } });
    expect(db.venueSuitabilityJudgement.upsert).toHaveBeenCalledWith({
      where: { eventId_venueId: { eventId: "evt_1", venueId: "ven_1" } },
      update: {
        suitable: false,
        note: "Stairs only to the stage.",
        recordedById: "usr_coord",
        recordedAt: expect.any(Date),
      },
      create: {
        eventId: "evt_1",
        venueId: "ven_1",
        suitable: false,
        note: "Stairs only to the stage.",
        recordedById: "usr_coord",
      },
      select: { id: true },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        entityType: "VenueSuitabilityJudgement",
        entityId: "vsj_1",
        action: "RECORDED",
        actorId: "usr_coord",
        fieldName: "suitable",
        newValue: "NOT_SUITABLE",
        summary: "Stairs only to the stage.",
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/bookings/new");
    expect(revalidatePath).toHaveBeenCalledWith("/bookings");
  });

  it("SCRUM-40 [AC8] TC-40-08: Suitable is recorded the same way", async () => {
    const result = await recordSuitabilityJudgement({ ...valid, suitable: true });

    expect(result).toEqual({ ok: true, data: { suitable: true } });
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ newValue: "SUITABLE" }),
      }),
    );
  });

  it.each(["", "   ", undefined])(
    "SCRUM-40 [AC8] TC-40-09: a judgement without a note (%j) is refused against the note and nothing is written",
    async (note) => {
      const result = await recordSuitabilityJudgement({ ...valid, note });

      expect(result).toMatchObject({
        ok: false,
        error: "Add a note explaining your judgement.",
        fieldErrors: { note: ["Add a note explaining your judgement."] },
      });
      expect(db.venueSuitabilityJudgement.upsert).not.toHaveBeenCalled();
    },
  );

  it("SCRUM-40 [AC8] TC-40-09: a judgement that is neither Suitable nor Not suitable is refused", async () => {
    const result = await recordSuitabilityJudgement({ ...valid, suitable: null });

    expect(result).toMatchObject({
      ok: false,
      error: "Choose Suitable or Not suitable.",
    });
    expect(db.event.findUnique).not.toHaveBeenCalled();
  });

  it("SCRUM-40 [AC8] TC-40-09: input without an event points at the highlighted fields", async () => {
    const result = await recordSuitabilityJudgement({ ...valid, eventId: "" });

    expect(result).toMatchObject({
      ok: false,
      error: "Please fix the highlighted fields.",
    });
  });

  it.each([
    ["another Coordinator's event", { coordinatorId: "usr_other" }],
    ["an event nobody is assigned to yet", { coordinatorId: null }],
  ])(
    "SCRUM-40 [AC8] TC-40-09: %s reads as not found, and nothing is written",
    async (_, patch) => {
      db.event.findUnique.mockResolvedValue({
        organiserId: "usr_org",
        status: "PLANNING",
        ...patch,
      });

      expect(await recordSuitabilityJudgement(valid)).toEqual({
        ok: false,
        error: "Event not found.",
      });
      expect(db.venueSuitabilityJudgement.upsert).not.toHaveBeenCalled();
    },
  );

  it("SCRUM-40 [AC8] TC-40-09: an event that doesn't exist reads the same", async () => {
    db.event.findUnique.mockResolvedValue(null);

    expect(await recordSuitabilityJudgement(valid)).toEqual({
      ok: false,
      error: "Event not found.",
    });
  });

  it.each(["UNDER_REVIEW", "CONFIRMED", "CANCELLED"] as const)(
    "SCRUM-40 [AC8] TC-40-09: an event that is %s, not being planned, can't be judged for",
    async (status) => {
      db.event.findUnique.mockResolvedValue({
        organiserId: "usr_org",
        coordinatorId: "usr_coord",
        status,
      });

      expect(await recordSuitabilityJudgement(valid)).toEqual({
        ok: false,
        error: "Suitability can only be judged while the event is being planned.",
      });
      expect(db.venueSuitabilityJudgement.upsert).not.toHaveBeenCalled();
    },
  );

  it("SCRUM-40 [AC8] TC-40-09: a retired or unknown venue reads as not found", async () => {
    db.venue.findFirst.mockResolvedValue(null);

    expect(await recordSuitabilityJudgement(valid)).toEqual({
      ok: false,
      error: "Venue not found.",
    });
    expect(db.venue.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "ven_1", isActive: true } }),
    );
    expect(db.venueSuitabilityJudgement.upsert).not.toHaveBeenCalled();
  });

  it.each([
    "ORGANISER",
    "VENUE_STAFF",
    "TECH_SUPPORT",
    "ATTENDEE",
    "COORDINATOR_LEAD",
    "SAFETY_OFFICER",
  ] as const)(
    "SCRUM-40 [AC8] TC-40-09: %s can't record a judgement, and nothing is read",
    async (role) => {
      mockAuth.mockResolvedValue(sessionFor(role));

      expect(await recordSuitabilityJudgement(valid)).toEqual({
        ok: false,
        error: "You do not have permission to do that.",
      });
      expect(db.event.findUnique).not.toHaveBeenCalled();
    },
  );

  it("SCRUM-40 [AC8]: does not swallow an unexpected database error", async () => {
    const failure = new Error("connection reset");
    db.$transaction.mockRejectedValue(failure);

    await expect(recordSuitabilityJudgement(valid)).rejects.toBe(failure);
  });
});

describe("venue:judge in the permission table — SCRUM-40 AC8", () => {
  const event = (coordinatorId: string | null) => ({
    kind: "event" as const,
    organiserId: "usr_org",
    coordinatorId,
    status: "PLANNING" as const,
  });

  it("SCRUM-40 [AC8] TC-40-09: only the event's assigned Coordinator may judge for it", () => {
    const coordinator = { id: "usr_coord", role: "COORDINATOR" as const };
    expect(can(coordinator, "venue:judge", event("usr_coord"))).toBe(true);
    expect(can(coordinator, "venue:judge", event("usr_other"))).toBe(false);
    expect(can(coordinator, "venue:judge", event(null))).toBe(false);
  });
});

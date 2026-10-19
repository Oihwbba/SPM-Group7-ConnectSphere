import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { EventStatus, Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can, REASSIGNABLE } from "@/lib/auth/can";
import { reassignCoordinator } from "@/app/(app)/all-events/actions";

// SCRUM-21 — the Lead reassigns an event to another Coordinator. `can()` runs
// for real; the database is mocked, and the transaction runs against `tx`.
const tx = vi.hoisted(() => ({
  event: { findUnique: vi.fn(), updateMany: vi.fn() },
  user: { findFirst: vi.fn() },
  auditLog: { create: vi.fn() },
  notification: { createMany: vi.fn() },
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { $transaction: vi.fn() } }));

const mockAuth = auth as unknown as Mock;
const mockTransaction = prisma.$transaction as unknown as Mock;

function sessionFor(role: Role, id: string): Session {
  return {
    user: { id, role, name: "Test User", email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  };
}

const lead = () => sessionFor("COORDINATOR_LEAD", "usr_lead");
const event = (overrides: Record<string, unknown> = {}) => ({
  name: "Career Fair",
  organiserId: "usr_org",
  coordinatorId: "usr_cody",
  status: "PLANNING",
  coordinator: { name: "Cody" },
  ...overrides,
});
const reassign = (coordinatorId = "usr_cara") =>
  reassignCoordinator({ eventId: "evt1", coordinatorId });

beforeEach(() => {
  vi.clearAllMocks();
  mockTransaction.mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx));
  tx.event.findUnique.mockResolvedValue(event());
  tx.user.findFirst.mockResolvedValue({ id: "usr_cara", name: "Cara" });
  tx.event.updateMany.mockResolvedValue({ count: 1 });
});

describe("can — event:reassign (SCRUM-21)", () => {
  const resource = (status: EventStatus, coordinatorId: string | null = "usr_cody") => ({
    kind: "event" as const,
    organiserId: "usr_org",
    coordinatorId,
    status,
  });

  it.each(REASSIGNABLE)(
    "SCRUM-21 [AC1] TC-21-01: the Lead may reassign a %s event that has a Coordinator",
    (status) => {
      expect(can(lead().user, "event:reassign", resource(status))).toBe(true);
    },
  );

  it.each(["DRAFT", "SUBMITTED", "REJECTED", "CANCELLED", "COMPLETED"] as const)(
    "SCRUM-21 [AC4] TC-21-05: the Lead may not reassign a %s event",
    (status) => {
      expect(can(lead().user, "event:reassign", resource(status))).toBe(false);
    },
  );

  it("SCRUM-21 [AC4] TC-21-05: an event with no Coordinator is assigned from the queue, not reassigned", () => {
    expect(
      can(lead().user, "event:reassign", resource("UNDER_REVIEW", null)),
    ).toBe(false);
  });

  it.each([
    "ORGANISER",
    "COORDINATOR",
    "VENUE_STAFF",
    "TECH_SUPPORT",
    "ATTENDEE",
    "SAFETY_OFFICER",
  ] as const)(
    "SCRUM-21 [AC10] TC-21-09: a %s may not reassign, even an event they organise or coordinate",
    (role) => {
      const user = { id: "usr_cody", role };
      expect(can(user, "event:reassign")).toBe(false);
      expect(
        can(user, "event:reassign", {
          ...resource("PLANNING"),
          organiserId: "usr_cody",
        }),
      ).toBe(false);
    },
  );

  it("SCRUM-21 [AC5] TC-21-06: after a reassignment the previous Coordinator can no longer edit the event; the new one can", () => {
    const moved = resource("PLANNING", "usr_cara");
    expect(can({ id: "usr_cody", role: "COORDINATOR" }, "event:edit", moved)).toBe(false);
    expect(can({ id: "usr_cara", role: "COORDINATOR" }, "event:edit", moved)).toBe(true);
    // Read-only access stays, through the all-events list (SCRUM-141).
    expect(can({ id: "usr_cody", role: "COORDINATOR" }, "event:view-all")).toBe(true);
  });
});

describe("reassignCoordinator — SCRUM-21", () => {
  it("SCRUM-21 [AC1, AC7] TC-21-01: the new Coordinator is assigned at once, the Lead becomes supervisor, and the history says who, from whom and to whom", async () => {
    mockAuth.mockResolvedValue(lead());

    expect(await reassign()).toEqual({
      ok: true,
      data: { coordinatorName: "Cara", changed: true },
    });
    expect(tx.event.updateMany).toHaveBeenCalledWith({
      where: {
        id: "evt1",
        coordinatorId: "usr_cody",
        status: { in: REASSIGNABLE },
      },
      data: { coordinatorId: "usr_cara", supervisingLeadId: "usr_lead" },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityType: "Event",
        entityId: "evt1",
        action: "REASSIGNED",
        actorId: "usr_lead",
        fieldName: "coordinatorId",
        oldValue: "usr_cody",
        newValue: "usr_cara",
      }),
    });
  });

  it.each(REASSIGNABLE)(
    "SCRUM-135 [AC16] TC-135-16: reassigning a %s event changes its Coordinator, never its status",
    async (status) => {
      mockAuth.mockResolvedValue(lead());
      tx.event.findUnique.mockResolvedValue(event({ status }));

      expect(await reassign()).toMatchObject({ ok: true, data: { changed: true } });
      // The one write to the event: who coordinates and supervises it.
      expect(tx.event.updateMany).toHaveBeenCalledTimes(1);
      expect(Object.keys(tx.event.updateMany.mock.calls[0][0].data).sort()).toEqual([
        "coordinatorId",
        "supervisingLeadId",
      ]);
      expect(tx.auditLog.create).not.toHaveBeenCalledWith({
        data: expect.objectContaining({ fieldName: "status" }),
      });
    },
  );

  it("SCRUM-21 [AC6] TC-21-07: the new and previous Coordinators and the Organiser are each notified once", async () => {
    mockAuth.mockResolvedValue(lead());

    await reassign();

    const { data } = tx.notification.createMany.mock.calls[0][0];
    expect(data.map((n: { userId: string }) => n.userId)).toEqual([
      "usr_cara",
      "usr_cody",
      "usr_org",
    ]);
    for (const n of data) {
      expect(n).toMatchObject({ type: "COORDINATOR_REASSIGNED", eventId: "evt1" });
    }
  });

  it("SCRUM-21 [AC3] TC-21-04: choosing the current Coordinator changes nothing", async () => {
    mockAuth.mockResolvedValue(lead());
    tx.user.findFirst.mockResolvedValue({ id: "usr_cody", name: "Cody" });

    expect(await reassign("usr_cody")).toEqual({
      ok: true,
      data: { coordinatorName: "Cody", changed: false },
    });
    expect(tx.event.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
    expect(tx.notification.createMany).not.toHaveBeenCalled();
  });

  it("SCRUM-21 [AC3] TC-21-03: the event's own Organiser can't be its Coordinator, and nothing is written", async () => {
    mockAuth.mockResolvedValue(lead());
    tx.user.findFirst.mockResolvedValue({ id: "usr_org", name: "Olivia" });

    expect(await reassign("usr_org")).toMatchObject({
      ok: false,
      error: "The event's own Organiser can't be its Coordinator.",
    });
    expect(tx.event.updateMany).not.toHaveBeenCalled();
  });

  it("SCRUM-21 [AC3] TC-21-10: someone who isn't a Coordinator is refused", async () => {
    mockAuth.mockResolvedValue(lead());
    tx.user.findFirst.mockResolvedValue(null);

    expect(await reassign("usr_attendee")).toMatchObject({
      ok: false,
      error: "Choose someone who is a Coordinator.",
    });
    expect(tx.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "usr_attendee", role: "COORDINATOR" },
      }),
    );
    expect(tx.event.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    ["REJECTED", "Only an Under Review, Planning or Confirmed event can be reassigned."],
    ["CANCELLED", "Only an Under Review, Planning or Confirmed event can be reassigned."],
    ["COMPLETED", "Only an Under Review, Planning or Confirmed event can be reassigned."],
    ["SUBMITTED", "This request has no Coordinator yet: assign it from the Unassigned queue."],
  ] as const)(
    "SCRUM-21 [AC4] TC-21-05: a direct request to reassign a %s event is refused, and nothing is written",
    async (status, message) => {
      mockAuth.mockResolvedValue(lead());
      tx.event.findUnique.mockResolvedValue(
        event({ status, ...(status === "SUBMITTED" && { coordinatorId: null, coordinator: null }) }),
      );

      expect(await reassign()).toMatchObject({ ok: false, error: message });
      expect(tx.event.updateMany).not.toHaveBeenCalled();
    },
  );

  it.each([null, event({ status: "DRAFT" })])(
    "SCRUM-21 [AC4] TC-21-05: a missing event or a draft reads not found (%#)",
    async (row) => {
      mockAuth.mockResolvedValue(lead());
      tx.event.findUnique.mockResolvedValue(row);

      expect(await reassign()).toMatchObject({
        ok: false,
        error: "Event not found.",
      });
      expect(tx.user.findFirst).not.toHaveBeenCalled();
    },
  );

  it("SCRUM-21 [AC2, AC9] TC-21-02: a reassignment that loses a race to another Lead saves nothing and says where the event is now", async () => {
    mockAuth.mockResolvedValue(lead());
    tx.event.updateMany.mockResolvedValue({ count: 0 });
    tx.event.findUnique
      .mockResolvedValueOnce(event())
      .mockResolvedValueOnce({ coordinator: { name: "Casey" } });

    expect(await reassign()).toMatchObject({
      ok: false,
      error:
        "This event was just changed by someone else; it is now with Casey. Check it and try again.",
    });
    expect(tx.auditLog.create).not.toHaveBeenCalled();
    expect(tx.notification.createMany).not.toHaveBeenCalled();
  });

  it("SCRUM-21 [AC2, AC9] TC-21-02: if the event lost its Coordinator meanwhile, it says so", async () => {
    mockAuth.mockResolvedValue(lead());
    tx.event.updateMany.mockResolvedValue({ count: 0 });
    tx.event.findUnique
      .mockResolvedValueOnce(event())
      .mockResolvedValueOnce(null);

    expect(await reassign()).toMatchObject({
      ok: false,
      error: expect.stringContaining("it is now with no Coordinator"),
    });
  });

  it.each(["COORDINATOR", "ORGANISER"] as const)(
    "SCRUM-21 [AC10] TC-21-09: a %s calling the action directly is refused before anything is read",
    async (role) => {
      mockAuth.mockResolvedValue(sessionFor(role, "usr_cody"));

      expect((await reassign()).ok).toBe(false);
      expect(mockTransaction).not.toHaveBeenCalled();
    },
  );

  it("SCRUM-21 [AC10] TC-21-09: a signed-out caller is refused", async () => {
    mockAuth.mockResolvedValue(null);

    expect((await reassign()).ok).toBe(false);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("SCRUM-21 [AC1]: a missing Coordinator choice is refused before anything is read", async () => {
    mockAuth.mockResolvedValue(lead());

    expect(await reassign("")).toMatchObject({
      ok: false,
      error: "Choose a Coordinator for this event.",
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("an unexpected database error is not swallowed", async () => {
    mockAuth.mockResolvedValue(lead());
    mockTransaction.mockRejectedValue(new Error("DB down"));

    await expect(reassign()).rejects.toThrow("DB down");
  });
});

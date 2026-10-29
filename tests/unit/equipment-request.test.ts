import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import { Prisma, type Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { createEquipmentRequest } from "@/app/(app)/equipment-requests/actions";
import { EQUIPMENT_REQUEST_STATUS_LABEL } from "@/lib/equipment/requests";

// SCRUM-27 — Create Equipment Request. Database mocked; the partial unique
// index and the concurrent-submission case run against real Postgres in
// tests/integration/equipment-request.test.ts.
const tx = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  event: { updateMany: vi.fn() },
  // findFirst: SCRUM-186 AC4, the active request looked for again under the lock.
  equipmentRequest: { create: vi.fn(), findFirst: vi.fn() },
  equipmentRequestUpdate: { create: vi.fn() },
  // SCRUM-124 AC2: Technical Support are told of a submission
  // (the SCRUM-124 tests at the end of this file).
  user: { findMany: vi.fn() },
  notification: { createMany: vi.fn() },
}));
const db = vi.hoisted(() => ({
  event: { findUnique: vi.fn() },
  equipment: { findMany: vi.fn() },
  equipmentRequest: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockAuth = auth as unknown as Mock;

function sessionFor(role: Role, id = "usr_coord"): Session {
  return {
    user: { id, role, name: "Test User", email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  };
}

const approvedEvent = {
  organiserId: "usr_org",
  coordinatorId: "usr_coord",
  status: "APPROVED",
};

const input = (overrides: Record<string, unknown> = {}) => ({
  eventId: "evt_approved",
  notes: "Keynote in the main hall.",
  lines: [
    {
      equipmentId: "eqp_projector",
      quantity: "2",
      technicalRequirements: "HDMI at the lectern",
    },
    { equipmentId: "eqp_mic", quantity: "4", technicalRequirements: "" },
  ],
  ...overrides,
});

const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError(
    "Unique constraint failed on the fields: (`eventId`)",
    { code: "P2002", clientVersion: "6.19.3" },
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(sessionFor("COORDINATOR"));
  db.event.findUnique.mockResolvedValue(approvedEvent);
  db.equipment.findMany.mockResolvedValue([
    { id: "eqp_projector" },
    { id: "eqp_mic" },
  ]);
  db.equipmentRequest.findFirst.mockResolvedValue(null);
  db.$transaction.mockImplementation(
    async (fn: (client: typeof tx) => unknown) => fn(tx),
  );
  tx.equipmentRequest.create.mockResolvedValue({ id: "eqr_new" });
  tx.equipmentRequest.findFirst.mockResolvedValue(null);
  // The event's status as createEquipmentRequest re-reads it under its lock.
  tx.$queryRaw.mockResolvedValue([{ status: "PLANNING", organiserId: "usr_org", coordinatorId: "usr_coord" }]);
  tx.equipmentRequestUpdate.create.mockResolvedValue({});
  tx.user.findMany.mockResolvedValue([]);
});

describe("createEquipmentRequest — SCRUM-27", () => {
  it("SCRUM-27 [AC1, AC2, AC5, AC6] TC-27-01, TC-27-03, TC-27-07, TC-27-08: saves the request for the event, with each line's type, quantity and requirements, as Pending Review", async () => {
    const result = await createEquipmentRequest(input());

    expect(result).toEqual({
      ok: true,
      data: { id: "eqr_new", existing: false },
    });
    expect(tx.equipmentRequest.create).toHaveBeenCalledWith({
      data: {
        eventId: "evt_approved",
        requestedById: "usr_coord",
        status: "PENDING_REVIEW",
        notes: "Keynote in the main hall.",
        lines: {
          create: [
            {
              equipmentId: "eqp_projector",
              quantity: 2,
              technicalRequirements: "HDMI at the lectern",
            },
            {
              equipmentId: "eqp_mic",
              quantity: 4,
              technicalRequirements: null,
            },
          ],
        },
      },
      select: { id: true },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/equipment-requests");
  });

  it("SCRUM-170 [AC4] TC-170-11: creating a request locks the event, then clears a No equipment needed decision before the request is written", async () => {
    await createEquipmentRequest(input());

    expect(tx.event.updateMany).toHaveBeenCalledWith({
      where: { id: "evt_approved", noEquipmentNeededAt: { not: null } },
      data: { noEquipmentNeededAt: null, noEquipmentNeededById: null },
    });
    const order = (mock: Mock) => mock.mock.invocationCallOrder[0];
    expect(order(tx.$queryRaw)).toBeLessThan(order(tx.event.updateMany));
    expect(order(tx.event.updateMany)).toBeLessThan(
      order(tx.equipmentRequest.create),
    );
  });

  it("SCRUM-27 [AC6] TC-27-08: records the submission as the first entry in the request's history", async () => {
    await createEquipmentRequest(input());

    expect(tx.equipmentRequestUpdate.create).toHaveBeenCalledWith({
      data: {
        requestId: "eqr_new",
        actorId: "usr_coord",
        fromStatus: null,
        toStatus: "PENDING_REVIEW",
        note: "Request submitted.",
      },
    });
  });

  it("SCRUM-27 [AC6] TC-27-08: calls the saved status Pending Review, the story's own words", () => {
    expect(EQUIPMENT_REQUEST_STATUS_LABEL.PENDING_REVIEW).toBe(
      "Pending Review",
    );
    expect(EQUIPMENT_REQUEST_STATUS_LABEL.IN_REVIEW).toBe("In Review");
  });

  it("SCRUM-27 [AC2] TC-27-04: refuses a type that is not on the predefined list, naming the line", async () => {
    db.equipment.findMany.mockResolvedValue([{ id: "eqp_projector" }]);

    const result = await createEquipmentRequest(
      input({
        lines: [
          { equipmentId: "eqp_projector", quantity: "1" },
          { equipmentId: "eqp_retired", quantity: "1" },
        ],
      }),
    );

    expect(result).toEqual({
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: {
        "lines.1.equipmentId": ["Select an equipment type from the list."],
      },
    });
    expect(db.equipment.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["eqp_projector", "eqp_retired"] }, isActive: true },
      select: { id: true, type: true },
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it.each(["0", "-1", "1.5", ""])(
    "SCRUM-27 [AC3] TC-27-05: quantity %j is refused next to its line, and nothing is saved",
    async (quantity) => {
      const result = await createEquipmentRequest(
        input({ lines: [{ equipmentId: "eqp_projector", quantity }] }),
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("Please fix the highlighted fields.");
        expect(result.fieldErrors?.["lines.0.quantity"]).toContain(
          "Quantity must be a positive whole number.",
        );
      }
      expect(db.event.findUnique).not.toHaveBeenCalled();
      expect(db.$transaction).not.toHaveBeenCalled();
    },
  );

  it("SCRUM-27 [AC4] TC-27-06: the same type twice creates no duplicate line and says the type is already on the request", async () => {
    const result = await createEquipmentRequest(
      input({
        lines: [
          { equipmentId: "eqp_projector", quantity: "2" },
          { equipmentId: "eqp_projector", quantity: "1" },
        ],
      }),
    );

    expect(result).toEqual({
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: {
        "lines.1.equipmentId": [
          "This equipment type is already on the request.",
        ],
      },
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("SCRUM-27 [AC7] TC-27-09, SCRUM-186 [AC1] TC-186-02: an event with an active request (Pending Review, In Review or Approved) shows the oldest instead of creating a second", async () => {
    db.equipmentRequest.findFirst.mockResolvedValue({ id: "eqr_existing" });

    const result = await createEquipmentRequest(input());

    expect(result).toEqual({
      ok: true,
      data: { id: "eqr_existing", existing: true },
    });
    expect(db.equipmentRequest.findFirst).toHaveBeenCalledWith({
      where: {
        eventId: "evt_approved",
        status: { in: ["PENDING_REVIEW", "IN_REVIEW", "APPROVED"] },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    expect(db.$transaction).not.toHaveBeenCalled();
    // The existing request may postdate the coordinator's page, so the list
    // is refreshed for it to be there to highlight.
    expect(revalidatePath).toHaveBeenCalledWith("/equipment-requests");
  });

  it("SCRUM-186 [AC4] TC-186-05: a request that became active after the first check is found again under the event's lock, and nothing is written", async () => {
    tx.equipmentRequest.findFirst.mockResolvedValue({ id: "eqr_raced" });

    const result = await createEquipmentRequest(input());

    expect(result).toEqual({
      ok: true,
      data: { id: "eqr_raced", existing: true },
    });
    expect(tx.equipmentRequest.findFirst).toHaveBeenCalledWith({
      where: {
        eventId: "evt_approved",
        status: { in: ["PENDING_REVIEW", "IN_REVIEW", "APPROVED"] },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    const order = (fn: Mock) => fn.mock.invocationCallOrder[0];
    expect(order(tx.$queryRaw)).toBeLessThan(order(tx.equipmentRequest.findFirst));
    expect(tx.event.updateMany).not.toHaveBeenCalled();
    expect(tx.equipmentRequest.create).not.toHaveBeenCalled();
    expect(tx.equipmentRequestUpdate.create).not.toHaveBeenCalled();
    expect(tx.notification.createMany).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/equipment-requests");
  });

  it("SCRUM-27 [AC7] TC-27-10: when a simultaneous submission wins the race, the loser is shown the winner's request", async () => {
    db.equipmentRequest.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "eqr_winner" });
    db.$transaction.mockRejectedValue(uniqueViolation());

    const result = await createEquipmentRequest(input());

    expect(result).toEqual({
      ok: true,
      data: { id: "eqr_winner", existing: true },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/equipment-requests");
  });

  it("SCRUM-27: rethrows a unique violation that no open request explains, rather than hiding it", async () => {
    db.$transaction.mockRejectedValue(uniqueViolation());

    await expect(createEquipmentRequest(input())).rejects.toThrow(
      Prisma.PrismaClientKnownRequestError,
    );
  });

  it("SCRUM-27: rethrows an unexpected database failure", async () => {
    db.$transaction.mockRejectedValue(new Error("connection lost"));

    await expect(createEquipmentRequest(input())).rejects.toThrow(
      "connection lost",
    );
  });

  it.each([
    ["an event that does not exist", null],
    [
      "another coordinator's event",
      { ...approvedEvent, coordinatorId: "usr_other" },
    ],
    [
      "an event still under review",
      { ...approvedEvent, status: "UNDER_REVIEW" },
    ],
    ["a cancelled event", { ...approvedEvent, status: "CANCELLED" }],
    // AC 1 limits requests to a Planning event: once an event is Confirmed its
    // details are fixed, so equipment must be arranged before then.
    ["a confirmed event", { ...approvedEvent, status: "CONFIRMED" }],
  ])(
    "SCRUM-27 [AC1] TC-27-02: refuses %s with the same message, and saves nothing",
    async (_label, event) => {
      db.event.findUnique.mockResolvedValue(event);

      const result = await createEquipmentRequest(input());

      expect(result).toEqual({
        ok: false,
        error: "Choose one of your approved events.",
        fieldErrors: { eventId: ["Choose one of your approved events."] },
      });
      expect(db.$transaction).not.toHaveBeenCalled();
    },
  );

  it("SCRUM-27 [AC1] TC-27-01: accepts a Planning event", async () => {
    db.event.findUnique.mockResolvedValue({
      ...approvedEvent,
      status: "PLANNING",
    });

    const result = await createEquipmentRequest(input());

    expect(result.ok).toBe(true);
  });

  it.each(["ORGANISER", "VENUE_STAFF", "TECH_SUPPORT", "ATTENDEE"] as const)(
    "SCRUM-27 TC-27-12: refuses %s before reading anything",
    async (role) => {
      mockAuth.mockResolvedValue(sessionFor(role));

      const result = await createEquipmentRequest(input());

      expect(result).toEqual({
        ok: false,
        error: "You do not have permission to do that.",
        fieldErrors: undefined,
      });
      expect(db.event.findUnique).not.toHaveBeenCalled();
      expect(db.$transaction).not.toHaveBeenCalled();
    },
  );

  it("SCRUM-27 TC-27-12: refuses a signed-out caller", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await createEquipmentRequest(input());

    expect(result.ok).toBe(false);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

// SCRUM-124 AC2 — Technical Support are told of a submission. Test cases:
// docs/testing/SCRUM-124.md.
describe("the submission notice — SCRUM-124 AC2", () => {
  beforeEach(() => {
    db.event.findUnique.mockResolvedValue({ ...approvedEvent, name: "Graduation" });
    db.equipment.findMany.mockResolvedValue([
      { id: "eqp_projector", type: "Projector" },
      { id: "eqp_mic", type: "Wireless Microphone" },
    ]);
    tx.user.findMany.mockResolvedValue([{ id: "usr_ts1" }, { id: "usr_ts2" }]);
  });

  it("SCRUM-124 [AC2, AC12, AC13] TC-124-02: a new request tells every Technical Support member the event and each line, linking to their queue", async () => {
    expect((await createEquipmentRequest(input())).ok).toBe(true);

    expect(tx.user.findMany).toHaveBeenCalledWith({
      where: { OR: [{ role: "TECH_SUPPORT" }, { additionalRoles: { has: "TECH_SUPPORT" } }] },
      select: { id: true },
    });
    const notice = {
      eventId: "evt_approved",
      type: "EQUIPMENT_REQUEST_SUBMITTED",
      title: "An equipment request was submitted",
      message:
        'The Coordinator requested equipment for "Graduation": Projector × 2, Wireless Microphone × 4.',
      link: "/equipment-requests",
    };
    expect(tx.notification.createMany).toHaveBeenCalledWith({
      data: [
        { userId: "usr_ts1", ...notice },
        { userId: "usr_ts2", ...notice },
      ],
    });
  });

  it("SCRUM-124 [AC2, AC14] TC-124-02: submitting while the event already has an open request tells nobody", async () => {
    db.equipmentRequest.findFirst.mockResolvedValue({ id: "eqr_open" });

    expect(await createEquipmentRequest(input())).toEqual({
      ok: true,
      data: { id: "eqr_open", existing: true },
    });
    expect(tx.notification.createMany).not.toHaveBeenCalled();
  });

  it("SCRUM-124 [AC2] TC-124-02: a refused request tells nobody", async () => {
    db.equipment.findMany.mockResolvedValue([{ id: "eqp_projector", type: "Projector" }]);

    expect((await createEquipmentRequest(input())).ok).toBe(false);
    expect(tx.notification.createMany).not.toHaveBeenCalled();
  });
});

describe("createEquipmentRequest — the event's status under its lock", () => {
  it.each(["CONFIRMED", "REJECTED", "CANCELLED"])(
    "SCRUM-27 [AC1] TC-27-17: an event that became %s after its status was read gets no request, and nothing is written",
    async (status) => {
      tx.$queryRaw.mockResolvedValue([{ ...{ status: "PLANNING", organiserId: "usr_org", coordinatorId: "usr_coord" }, status }]);

      expect(await createEquipmentRequest(input())).toEqual({
        ok: false,
        error: "Choose one of your approved events.",
        fieldErrors: { eventId: ["Choose one of your approved events."] },
      });
      expect(tx.equipmentRequest.create).not.toHaveBeenCalled();
      expect(tx.event.updateMany).not.toHaveBeenCalled();
    },
  );
});

describe("createEquipmentRequest — the event's Coordinator under its lock", () => {
  it("SCRUM-27 [AC1] TC-27-17: an event reassigned to another Coordinator after it was read gets no request from the previous one", async () => {
    tx.$queryRaw.mockResolvedValue([{ status: "PLANNING", organiserId: "usr_org", coordinatorId: "usr_other" }]);

    expect((await createEquipmentRequest(input())).ok).toBe(false);
    expect(tx.equipmentRequest.create).not.toHaveBeenCalled();
  });
});

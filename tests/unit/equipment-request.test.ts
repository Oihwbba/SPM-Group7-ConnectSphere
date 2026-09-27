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
  equipmentRequest: { create: vi.fn() },
  equipmentRequestUpdate: { create: vi.fn() },
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
  tx.equipmentRequestUpdate.create.mockResolvedValue({});
});

describe("createEquipmentRequest — SCRUM-27", () => {
  it("AC 1, 2, 5 & 6: saves the request for the event, with each line's type, quantity and requirements, as Pending Review", async () => {
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

  it("AC 6: records the submission as the first entry in the request's history", async () => {
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

  it("AC 6: calls the saved status Pending Review, the story's own words", () => {
    expect(EQUIPMENT_REQUEST_STATUS_LABEL.PENDING_REVIEW).toBe(
      "Pending Review",
    );
    expect(EQUIPMENT_REQUEST_STATUS_LABEL.IN_REVIEW).toBe("In Review");
  });

  it("AC 2: refuses a type that is not on the predefined list, naming the line", async () => {
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
      select: { id: true },
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it.each(["0", "-1", "1.5", ""])(
    "AC 3: quantity %j is refused next to its line, and nothing is saved",
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

  it("AC 4: the same type twice creates no duplicate line and says the type is already on the request", async () => {
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

  it("AC 7: an event with a request pending review shows that request instead of creating a second", async () => {
    db.equipmentRequest.findFirst.mockResolvedValue({ id: "eqr_existing" });

    const result = await createEquipmentRequest(input());

    expect(result).toEqual({
      ok: true,
      data: { id: "eqr_existing", existing: true },
    });
    expect(db.equipmentRequest.findFirst).toHaveBeenCalledWith({
      where: {
        eventId: "evt_approved",
        status: { in: ["PENDING_REVIEW", "IN_REVIEW"] },
      },
      select: { id: true },
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("AC 7: when a simultaneous submission wins the race, the loser is shown the winner's request", async () => {
    db.equipmentRequest.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "eqr_winner" });
    db.$transaction.mockRejectedValue(uniqueViolation());

    const result = await createEquipmentRequest(input());

    expect(result).toEqual({
      ok: true,
      data: { id: "eqr_winner", existing: true },
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rethrows a unique violation that no open request explains, rather than hiding it", async () => {
    db.$transaction.mockRejectedValue(uniqueViolation());

    await expect(createEquipmentRequest(input())).rejects.toThrow(
      Prisma.PrismaClientKnownRequestError,
    );
  });

  it("rethrows an unexpected database failure", async () => {
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
  ])(
    "AC 1: refuses %s with the same message, and saves nothing",
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

  it.each(["PLANNING", "CONFIRMED"])(
    "AC 1: accepts a %s event",
    async (status) => {
      db.event.findUnique.mockResolvedValue({ ...approvedEvent, status });

      const result = await createEquipmentRequest(input());

      expect(result.ok).toBe(true);
    },
  );

  it.each(["ORGANISER", "VENUE_STAFF", "TECH_SUPPORT", "ATTENDEE"] as const)(
    "refuses %s before reading anything",
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

  it("refuses a signed-out caller", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await createEquipmentRequest(input());

    expect(result.ok).toBe(false);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

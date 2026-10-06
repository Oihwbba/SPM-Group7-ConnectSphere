import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  getCoordinatorEquipmentRequests,
  getEquipmentCatalogue,
  getRequestableEvents,
  getReservableRequests,
} from "@/lib/equipment/request-queries";
import { REQUESTABLE_EVENT_STATUSES } from "@/lib/equipment/requests";
import { RESERVABLE_EVENT_STATUSES } from "@/lib/schemas/reservation";

// SCRUM-27 — the reads behind the coordinator's Equipment Requests page. The
// database is mocked; these pin the WHERE clauses, because a looser clause
// here would show a coordinator other coordinators' events and requests.
// tests/integration/equipment-request.test.ts runs the same reads for real.
const db = vi.hoisted(() => ({
  event: { findMany: vi.fn() },
  equipmentRequest: { findMany: vi.fn() },
  equipment: { findMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: db }));

// The same relationship can() grants a coordinator on an event.
const coordinatorScope = (coordinatorId: string) => ({
  OR: [{ coordinatorId }, { coordinatorId: null, status: { not: "DRAFT" } }],
});

beforeEach(() => {
  vi.clearAllMocks();
  db.event.findMany.mockResolvedValue([]);
  db.equipmentRequest.findMany.mockResolvedValue([]);
  db.equipment.findMany.mockResolvedValue([]);
});

describe("getRequestableEvents — SCRUM-27 AC 1", () => {
  it("offers only this coordinator's events that are going ahead, soonest first", async () => {
    const events = [
      {
        id: "evt_approved",
        name: "Research Symposium",
        startAt: new Date("2030-06-01T01:00:00.000Z"),
        endAt: new Date("2030-06-01T09:00:00.000Z"),
      },
    ];
    db.event.findMany.mockResolvedValue(events);

    await expect(getRequestableEvents("usr_coord")).resolves.toEqual(events);
    expect(db.event.findMany).toHaveBeenCalledWith({
      where: {
        AND: [
          coordinatorScope("usr_coord"),
          { status: { in: [...REQUESTABLE_EVENT_STATUSES] } },
        ],
      },
      select: { id: true, name: true, startAt: true, endAt: true },
      orderBy: { startAt: "asc" },
    });
  });

  it("AC 1: treats only approved and planning events as ones equipment can be requested for", () => {
    // A Confirmed event's details are fixed, so equipment must be arranged
    // before it is confirmed (SCRUM-27 AC 1).
    expect([...REQUESTABLE_EVENT_STATUSES]).toEqual(["APPROVED", "PLANNING"]);
  });

  it("AC 1: stock can be reserved for exactly the events that can take a request", () => {
    // SCRUM-31 reserves against SCRUM-27's requests, so a request for an event
    // that cannot be reserved for would be unfulfillable.
    expect(RESERVABLE_EVENT_STATUSES).toEqual([...REQUESTABLE_EVENT_STATUSES]);
  });
});

describe("getCoordinatorEquipmentRequests — SCRUM-27", () => {
  it("lists requests for this coordinator's events only, newest first, with their lines", async () => {
    await getCoordinatorEquipmentRequests("usr_coord");

    const query = db.equipmentRequest.findMany.mock.calls[0][0];
    expect(query.where).toEqual({ event: coordinatorScope("usr_coord") });
    expect(query.orderBy).toEqual({ createdAt: "desc" });
    expect(query.select).toMatchObject({
      id: true,
      status: true,
      notes: true,
      createdAt: true,
      event: { select: { id: true, name: true, startAt: true, endAt: true } },
    });
    expect(query.select.lines.select).toMatchObject({
      quantity: true,
      technicalRequirements: true,
      equipment: { select: { id: true, type: true } },
    });
    expect(query.select.lines.orderBy).toEqual([
      { createdAt: "asc" },
      { id: "asc" },
    ]);
  });

  // SCRUM-28 — "so that Event Coordinators know the exact status": the
  // coordinator sees what Technical Support suggested and every update made.
  it("SCRUM-28 AC 3 & 5: includes suggested alternatives and the history, oldest first", async () => {
    await getCoordinatorEquipmentRequests("usr_coord");

    const query = db.equipmentRequest.findMany.mock.calls[0][0];
    expect(query.select.lines.select.suggestedAlternative).toEqual({
      select: { id: true, type: true },
    });
    expect(query.select.updates).toEqual({
      select: {
        id: true,
        createdAt: true,
        fromStatus: true,
        toStatus: true,
        note: true,
        actor: { select: { name: true } },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  });
});

describe("getEquipmentCatalogue — SCRUM-27 AC 2", () => {
  it("is the predefined list: every active equipment type, alphabetically", async () => {
    await getEquipmentCatalogue();

    expect(db.equipment.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: {
        id: true,
        type: true,
        totalQuantity: true,
        technicalSpecs: true,
      },
      orderBy: { type: "asc" },
    });
  });
});

describe("getReservableRequests — SCRUM-155", () => {
  const START = new Date("2030-06-01T01:00:00.000Z");
  const END = new Date("2030-06-01T09:00:00.000Z");
  const held = (
    equipmentId: string,
    quantity: number,
    requestId: string | null,
    period = { startAt: START, endAt: END },
  ) => ({ requestId, equipmentId, quantity, ...period });
  const line = (id: string, equipmentId: string, quantity: number) => ({
    id,
    equipmentId,
    quantity,
    technicalRequirements: id === "l1" ? "HDMI from the lectern." : null,
    equipment: { id: equipmentId, type: equipmentId },
  });
  const approved = (
    id: string,
    reservations: ReturnType<typeof held>[],
    lines = [line("l1", "eq_projector", 2), line("l2", "eq_mic", 3)],
  ) => ({
    id,
    notes: "Keynote at 10:00.",
    requestedBy: { name: "Cody Coordinator" },
    event: {
      id: `evt_${id}`,
      name: `Event ${id}`,
      startAt: START,
      endAt: END,
      reservations,
    },
    lines,
  });

  it("SCRUM-155 [AC1] TC-155-01: reads approved requests for events that can still take a reservation and haven't started", async () => {
    const now = new Date("2030-01-01T00:00:00.000Z");

    await getReservableRequests(now);

    expect(db.equipmentRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "APPROVED",
          event: {
            status: { in: RESERVABLE_EVENT_STATUSES },
            startAt: { gt: now },
          },
        },
        orderBy: { event: { startAt: "asc" } },
      }),
    );
  });

  it("SCRUM-155 [AC1]: judges \"not started\" against the current time when none is given", async () => {
    await getReservableRequests();

    const { where } = db.equipmentRequest.findMany.mock.calls[0][0];
    expect(where.event.startAt.gt).toBeInstanceOf(Date);
  });

  it("SCRUM-155 [AC2, AC6] TC-155-02: reads each event's period and confirmed reservations, who raised the request, its notes, and its lines with their requirements in the order they were entered", async () => {
    await getReservableRequests();

    const { select } = db.equipmentRequest.findMany.mock.calls[0][0];
    expect(select.event).toEqual({
      select: {
        id: true,
        name: true,
        startAt: true,
        endAt: true,
        reservations: {
          where: { status: "CONFIRMED" },
          select: {
            requestId: true,
            equipmentId: true,
            quantity: true,
            startAt: true,
            endAt: true,
          },
        },
      },
    });
    expect(select.notes).toBe(true);
    expect(select.requestedBy).toEqual({ select: { name: true } });
    expect(select.lines).toEqual({
      select: {
        id: true,
        equipmentId: true,
        quantity: true,
        technicalRequirements: true,
        equipment: { select: { id: true, type: true } },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  });

  it("SCRUM-155 [AC2] TC-155-02: offers a request with nothing reserved in full, not marked as partly reserved", async () => {
    db.equipmentRequest.findMany.mockResolvedValue([approved("r1", [])]);

    expect(await getReservableRequests()).toEqual([
      {
        id: "r1",
        notes: "Keynote at 10:00.",
        requestedBy: { name: "Cody Coordinator" },
        event: { id: "evt_r1", name: "Event r1", startAt: START, endAt: END },
        alreadyReserved: null,
        lines: [
          {
            id: "l1",
            quantity: 2,
            technicalRequirements: "HDMI from the lectern.",
            equipment: { id: "eq_projector", type: "eq_projector" },
          },
          {
            id: "l2",
            quantity: 3,
            technicalRequirements: null,
            equipment: { id: "eq_mic", type: "eq_mic" },
          },
        ],
      },
    ]);
  });

  it("SCRUM-156 [AC5] TC-156-07: a partly reserved request offers only what is still missing", async () => {
    db.equipmentRequest.findMany.mockResolvedValue([
      approved("r1", [held("eq_projector", 2, "r1"), held("eq_mic", 1, "r1")]),
    ]);

    const [offered] = await getReservableRequests();

    expect(offered.alreadyReserved).toBe("request");
    expect(offered.lines).toEqual([
      {
        id: "l2",
        quantity: 2,
        technicalRequirements: null,
        equipment: { id: "eq_mic", type: "eq_mic" },
      },
    ]);
  });

  it("SCRUM-155 [AC6] TC-155-06, TC-155-12: a request covered in full, by its own or old unlinked reservations, isn't offered", async () => {
    db.equipmentRequest.findMany.mockResolvedValue([
      approved("own", [held("eq_projector", 2, "own"), held("eq_mic", 3, "own")]),
      approved("legacy", [held("eq_projector", 2, null), held("eq_mic", 3, null)]),
    ]);

    expect(await getReservableRequests()).toEqual([]);
  });

  it("SCRUM-156 [AC5] TC-156-08: another request's reservations, or ones that don't span the event, don't cover a line; the event is marked partly reserved", async () => {
    db.equipmentRequest.findMany.mockResolvedValue([
      approved(
        "second",
        [
          held("eq_projector", 2, "first"),
          held("eq_mic", 3, "second", {
            startAt: new Date("2030-06-01T02:00:00.000Z"),
            endAt: END,
          }),
        ],
      ),
    ]);

    const [offered] = await getReservableRequests();

    expect(offered.alreadyReserved).toBe("event");
    expect(offered.lines.map((l) => [l.id, l.quantity])).toEqual([
      ["l1", 2],
      ["l2", 3],
    ]);
  });

  it("SCRUM-155 [AC2]: an event without dates has nothing covering it, so every line is offered", async () => {
    const request = approved("r1", [held("eq_projector", 2, "r1")]);
    db.equipmentRequest.findMany.mockResolvedValue([
      { ...request, event: { ...request.event, endAt: null } },
    ]);

    const [offered] = await getReservableRequests();

    expect(offered.lines).toHaveLength(2);
  });
});

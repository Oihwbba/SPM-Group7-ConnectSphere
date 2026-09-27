import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  getCoordinatorEquipmentRequests,
  getEquipmentCatalogue,
  getRequestableEvents,
} from "@/lib/equipment/request-queries";
import { REQUESTABLE_EVENT_STATUSES } from "@/lib/equipment/requests";

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

  it("treats approved, planning and confirmed events as ones equipment can be requested for", () => {
    expect([...REQUESTABLE_EVENT_STATUSES]).toEqual([
      "APPROVED",
      "PLANNING",
      "CONFIRMED",
    ]);
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

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { listEventReservations } from "@/app/(app)/events/queries";

// SCRUM-33 — a coordinator sees every reservation for their event, with its
// status and equipment details, and nothing for events that aren't theirs.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    event: { findUnique: vi.fn() },
    reservation: { findMany: vi.fn() },
  },
}));

const mockAuth = auth as unknown as Mock;
const mockFindEvent = prisma.event.findUnique as unknown as Mock;
const mockFindReservations = prisma.reservation.findMany as unknown as Mock;

function sessionFor(role: Role, id: string): Session {
  return {
    user: { id, role, name: "Test User", email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  };
}

const EVENT = {
  id: "evt_confirmed",
  organiserId: "usr_org",
  coordinatorId: "usr_coord",
  status: "CONFIRMED",
};

const RESERVATIONS = [
  {
    id: "res_1",
    quantity: 1,
    status: "CONFIRMED",
    startAt: new Date("2031-05-10T01:00:00.000Z"),
    endAt: new Date("2031-05-10T05:00:00.000Z"),
    equipment: { type: "Projector", description: "Portable 4000-lumen projector", technicalSpecs: "HDMI + USB-C, 1080p" },
  },
  {
    id: "res_2",
    quantity: 2,
    status: "CANCELLED",
    startAt: new Date("2031-05-10T01:00:00.000Z"),
    endAt: new Date("2031-05-10T05:00:00.000Z"),
    equipment: { type: "Wireless Microphone", description: "Handheld radio mic", technicalSpecs: "UHF, 8h battery" },
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_coord"));
  mockFindEvent.mockResolvedValue(EVENT);
});

describe("listEventReservations — SCRUM-33", () => {
  it("AC 1, 2 & 3: lists every reservation for the coordinator's event, cancelled ones included, with details and status", async () => {
    mockFindReservations.mockResolvedValue(RESERVATIONS);

    const result = await listEventReservations("evt_confirmed");

    expect(result).toEqual(RESERVATIONS);
    const query = mockFindReservations.mock.calls[0][0];
    expect(query.where).toEqual({ eventId: "evt_confirmed" });
    expect(query.select.status).toBe(true);
    expect(query.select.equipment.select).toEqual({ type: true, description: true, technicalSpecs: true });
  });

  it("AC 4: returns an empty list for an event with no reservations", async () => {
    mockFindReservations.mockResolvedValue([]);

    await expect(listEventReservations("evt_confirmed")).resolves.toEqual([]);
  });

  it("returns null for another coordinator's event, without reading its reservations (SCRUM-68)", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_other_coord"));

    await expect(listEventReservations("evt_confirmed")).resolves.toBeNull();
    expect(mockFindReservations).not.toHaveBeenCalled();
  });

  it("returns null for a missing event and for a signed-out caller", async () => {
    mockFindEvent.mockResolvedValue(null);
    await expect(listEventReservations("evt_missing")).resolves.toBeNull();

    mockAuth.mockResolvedValue(null);
    await expect(listEventReservations("evt_confirmed")).resolves.toBeNull();
    expect(mockFindReservations).not.toHaveBeenCalled();
  });
});

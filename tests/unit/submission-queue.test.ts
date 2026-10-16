import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { submitEventRequest } from "@/app/(app)/events/actions";

// SCRUM-165 AC1 — submitting no longer assigns a Coordinator: the request
// stays Submitted and waits in the Lead's Unassigned queue. (It replaces
// SCRUM-20's automatic assignment.)
const tx = vi.hoisted(() => ({
  event: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  notification: { createMany: vi.fn() },
  auditLog: { create: vi.fn() },
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: { $transaction: vi.fn() },
}));

const mockAuth = auth as unknown as Mock;
const mockTransaction = prisma.$transaction as unknown as Mock;

function sessionFor(role: Role, id: string): Session {
  return {
    user: { id, role, name: "Test User", email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  };
}

const futureStart = new Date(Date.now() + 86400000).toISOString();
const futureEnd = new Date(Date.now() + 86400000 + 7200000).toISOString();

const validInput = {
  name: "Career Fair",
  purpose: "Connect students with employers",
  description: "Annual careers fair",
  startAt: futureStart,
  endAt: futureEnd,
  expectedAttendance: 100,
  venueRequirements: "Large hall",
  accessibilityNeeds: "Wheelchair access",
  preferredLayout: "Booths",
  equipmentRequirements: "Tables and chairs",
  registrationNotes: "Open registration",
};

beforeEach(() => {
  vi.clearAllMocks();
  tx.event.create.mockResolvedValue({ id: "evt_new" });
  tx.notification.createMany.mockResolvedValue({ count: 2 });
  tx.auditLog.create.mockResolvedValue({});
  mockTransaction.mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx));
  mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));
});

describe("submitEventRequest — SCRUM-165 AC1 the request waits in the queue", () => {
  it("SCRUM-165 [AC1] TC-165-01: [Positive] a new request stays Submitted with no Coordinator", async () => {
    const result = await submitEventRequest(validInput);

    expect(result).toEqual({ ok: true, data: { id: "evt_new" } });
    expect(tx.event.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SUBMITTED" }),
      }),
    );
    expect(tx.event.create.mock.calls[0][0].data).not.toHaveProperty(
      "coordinatorId",
    );
    expect(tx.event.update).not.toHaveBeenCalled();
  });

  it("SCRUM-165 [AC1] TC-165-01: [Positive] nobody is recorded as assigned until the Lead chooses", async () => {
    await submitEventRequest(validInput);

    expect(tx.auditLog.create).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "ASSIGNED" }),
      }),
    );
  });
});

describe("submitEventRequest — SCRUM-45 AC1 submission notice", () => {
  it("SCRUM-45 [AC1, AC12] TC-45-01: the Organiser is told the request was submitted and is waiting to be assigned; no assignment notice is sent until the Lead assigns", async () => {
    await submitEventRequest(validInput);

    const written = tx.notification.createMany.mock.calls.map(
      (call) => call[0].data,
    );
    expect(written).toEqual([
      [
        {
          userId: "usr_organiser",
          type: "EVENT_STATUS_CHANGED",
          eventId: "evt_new",
          title: "Request submitted",
          message:
            '"Career Fair" was submitted and is waiting to be assigned to a Coordinator.',
        },
      ],
    ]);
  });
});

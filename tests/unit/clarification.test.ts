import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  requestClarification,
  respondToClarification,
  getClarificationForEvent,
} from "@/app/(app)/events/clarification-actions";

// SCRUM-18 — the clarification loop. Session and database are mocked; the
// transaction runs its callback against a mock `tx`, same convention as
// event-status.test.ts and event-auto-assignment.test.ts.
const tx = vi.hoisted(() => ({
  clarificationRequest: { create: vi.fn(), update: vi.fn() },
  notification: { create: vi.fn() },
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    event: { findUnique: vi.fn() },
    clarificationRequest: { findFirst: vi.fn(), findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const mockAuth = auth as unknown as Mock;
const mockEventFindUnique = prisma.event.findUnique as unknown as Mock;
const mockClarificationFindFirst =
  prisma.clarificationRequest.findFirst as unknown as Mock;
const mockClarificationFindUnique =
  prisma.clarificationRequest.findUnique as unknown as Mock;
const mockTransaction = prisma.$transaction as unknown as Mock;

function sessionFor(role: Role, id: string): Session {
  return {
    user: { id, role, name: "Test User", email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  };
}

function eventRow(
  over: Partial<{
    status: string;
    organiserId: string;
    coordinatorId: string | null;
  }> = {},
) {
  return {
    id: "evt1",
    name: "Career Fair",
    status: "UNDER_REVIEW",
    organiserId: "usr_org",
    coordinatorId: "usr_coord",
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  tx.clarificationRequest.create.mockResolvedValue({ id: "clar1" });
  tx.clarificationRequest.update.mockResolvedValue({});
  tx.notification.create.mockResolvedValue({});
  mockTransaction.mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx));
});

describe("requestClarification — SCRUM-18", () => {
  it("[Positive] AC: coordinator requests clarification, event status is untouched, organiser is notified", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_coord"));
    mockEventFindUnique.mockResolvedValue(eventRow());
    mockClarificationFindFirst.mockResolvedValue(null); // no open clarification yet

    const result = await requestClarification({
      eventId: "evt1",
      message: "What's your expected headcount?",
    });

    expect(result.ok).toBe(true);
    expect(tx.clarificationRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventId: "evt1",
          requestedById: "usr_coord",
          message: "What's your expected headcount?",
        }),
      }),
    );
    expect(tx.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "usr_org",
          type: "CLARIFICATION_REQUESTED",
        }),
      }),
    );
  });

  it("[Negative] AC: a blank message is rejected and nothing is written", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_coord"));

    const result = await requestClarification({ eventId: "evt1", message: "  " });

    expect(result.ok).toBe(false);
    expect(tx.clarificationRequest.create).not.toHaveBeenCalled();
  });

  it("[Negative] Security gate: an Organiser cannot request clarification on their own event", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_org"));

    const result = await requestClarification({
      eventId: "evt1",
      message: "Anything?",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/permission/i);
    expect(mockEventFindUnique).not.toHaveBeenCalled();
  });

  it("[Boundary] AC: no second open clarification is created for the same event", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_coord"));
    mockEventFindUnique.mockResolvedValue(eventRow());
    mockClarificationFindFirst.mockResolvedValue({ id: "clar_already_open" });

    const result = await requestClarification({
      eventId: "evt1",
      message: "Another question",
    });

    expect(result.ok).toBe(false);
    expect(tx.clarificationRequest.create).not.toHaveBeenCalled();
  });

  it("[Negative] a request cannot be clarified while it is still DRAFT", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_coord"));
    mockEventFindUnique.mockResolvedValue(eventRow({ status: "DRAFT", coordinatorId: null }));

    const result = await requestClarification({ eventId: "evt1", message: "Question" });

    expect(result.ok).toBe(false);
    expect(tx.clarificationRequest.create).not.toHaveBeenCalled();
  });

  it("[Negative] SCRUM-68: another coordinator's event is indistinguishable from a missing one", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_other_coord"));
    mockEventFindUnique.mockResolvedValue(eventRow({ coordinatorId: "usr_coord" }));

    const result = await requestClarification({ eventId: "evt1", message: "Question" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Event not found.");
  });
});

describe("respondToClarification — SCRUM-18", () => {
  function clarificationRow(
    over: Partial<{ status: string }> = {},
  ) {
    return {
      id: "clar1",
      status: "OPEN",
      event: eventRow(),
      ...over,
    };
  }

  it("[Positive] AC: organiser responds, clarification is marked answered, coordinator is notified", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_org"));
    mockClarificationFindUnique.mockResolvedValue(clarificationRow());

    const result = await respondToClarification({
      clarificationId: "clar1",
      response: "About 200 attendees.",
    });

    expect(result.ok).toBe(true);
    expect(tx.clarificationRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "clar1" },
        data: expect.objectContaining({
          status: "ANSWERED",
          response: "About 200 attendees.",
        }),
      }),
    );
    expect(tx.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "usr_coord",
          title: "Clarification answered",
        }),
      }),
    );
  });

  it("[Negative] AC: an empty response is rejected", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_org"));

    const result = await respondToClarification({ clarificationId: "clar1", response: "  " });

    expect(result.ok).toBe(false);
    expect(tx.clarificationRequest.update).not.toHaveBeenCalled();
  });

  it("[Negative] a Coordinator cannot respond on the organiser's behalf", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_coord"));

    const result = await respondToClarification({
      clarificationId: "clar1",
      response: "Answer",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/permission/i);
    expect(mockClarificationFindUnique).not.toHaveBeenCalled();
  });

  it("[Negative] Boundary: an already-answered clarification cannot be answered again", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_org"));
    mockClarificationFindUnique.mockResolvedValue(
      clarificationRow({ status: "ANSWERED" }),
    );

    const result = await respondToClarification({
      clarificationId: "clar1",
      response: "Another answer",
    });

    expect(result.ok).toBe(false);
    expect(tx.clarificationRequest.update).not.toHaveBeenCalled();
  });

  it("[Negative] another organiser's clarification is indistinguishable from a missing one", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_other_org"));
    mockClarificationFindUnique.mockResolvedValue(clarificationRow());

    const result = await respondToClarification({
      clarificationId: "clar1",
      response: "Trying to answer someone else's",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Clarification request not found.");
  });
});

describe("getClarificationForEvent — SCRUM-18/17 read path", () => {
  it("[Positive] returns the latest clarification thread for a related user", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_org"));
    mockEventFindUnique.mockResolvedValue(eventRow());
    mockClarificationFindFirst.mockResolvedValue({
      id: "clar1",
      message: "Question?",
      status: "OPEN",
      response: null,
      createdAt: new Date(),
      respondedAt: null,
    });

    const result = await getClarificationForEvent("evt1");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.clarification?.id).toBe("clar1");
  });

  it("[Positive] returns null when the event has never had a clarification", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_org"));
    mockEventFindUnique.mockResolvedValue(eventRow());
    mockClarificationFindFirst.mockResolvedValue(null);

    const result = await getClarificationForEvent("evt1");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.clarification).toBeNull();
  });

  it("[Negative] an unrelated user gets not-found, never the clarification content", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_stranger"));
    mockEventFindUnique.mockResolvedValue(eventRow());

    const result = await getClarificationForEvent("evt1");

    expect(result.ok).toBe(false);
    expect(mockClarificationFindFirst).not.toHaveBeenCalled();
  });
});
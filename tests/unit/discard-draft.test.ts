import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { EventStatus, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/auth/can";
import {
  createDraftEvent,
  discardDraftEvent,
  startRequestFromRejected,
  submitEventRequest,
} from "@/app/(app)/events/actions";
import { getOrganiserEvents } from "@/app/(app)/events/role-views";
import { getEventForUser } from "@/app/(app)/events/queries";
import {
  PAST_DRAFT_DATES_MESSAGE,
  draftStartIsInPast,
} from "@/lib/schemas/event";

// SCRUM-130 — an Organiser discards a Draft they no longer need. Session and
// database are mocked; `can()` is NOT, so every permission case below runs the
// real authorisation table. What the mocks can't prove (the filters actually
// hiding a row, the CHECK constraint, two requests racing) is proven against a
// real database in tests/integration/discard-draft.test.ts.
// Test cases: docs/testing/SCRUM-130.md.

const tx = vi.hoisted(() => ({
  event: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  $queryRaw: vi.fn(),
  auditLog: { create: vi.fn(), findFirst: vi.fn() },
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: { event: tx.event, $transaction: vi.fn() },
}));

const mockAuth = auth as unknown as Mock;
const mockTransaction = prisma.$transaction as unknown as Mock;
const mockRevalidate = revalidatePath as unknown as Mock;

function sessionFor(role: Role, id: string): Session {
  return {
    user: { id, role, name: "Test User", email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  };
}

const owner = () => sessionFor("ORGANISER", "usr_org");

/** The row discardDraftEvent selects: the fields `can()` and the rules read. */
function draftRow(
  over: Partial<{
    organiserId: string;
    coordinatorId: string | null;
    status: EventStatus;
    discardedAt: Date | null;
  }> = {},
) {
  return {
    organiserId: "usr_org",
    coordinatorId: null,
    status: "DRAFT" as EventStatus,
    discardedAt: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  tx.event.updateMany.mockResolvedValue({ count: 1 });
  tx.auditLog.create.mockResolvedValue({});
  tx.auditLog.findFirst.mockResolvedValue(null);
  mockTransaction.mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx));
});

/** Nothing about the event was changed, and no history was written. */
function expectNothingWritten() {
  expect(mockTransaction).not.toHaveBeenCalled();
  expect(tx.event.updateMany).not.toHaveBeenCalled();
  expect(tx.auditLog.create).not.toHaveBeenCalled();
  expect(mockRevalidate).not.toHaveBeenCalled();
}

describe("discardDraftEvent — SCRUM-130", () => {
  it("SCRUM-130 [AC1] TC-130-01: the Organiser's own Draft is marked discarded, not deleted, and the change is recorded with who did it", async () => {
    mockAuth.mockResolvedValue(owner());
    tx.event.findUnique.mockResolvedValue(draftRow());

    const before = Date.now();
    const result = await discardDraftEvent({ eventId: "evt_draft" });

    expect(result).toEqual({ ok: true, data: { id: "evt_draft" } });
    expect(tx.event.findUnique).toHaveBeenCalledWith({
      where: { id: "evt_draft" },
      select: {
        organiserId: true,
        coordinatorId: true,
        status: true,
        discardedAt: true,
      },
    });
    // Conditional on it still being an undiscarded Draft at write time.
    expect(tx.event.updateMany).toHaveBeenCalledTimes(1);
    const { where, data } = tx.event.updateMany.mock.calls[0][0];
    expect(where).toEqual({
      id: "evt_draft",
      status: "DRAFT",
      discardedAt: null,
    });
    expect(Object.keys(data)).toEqual(["discardedAt"]);
    expect(data.discardedAt).toBeInstanceOf(Date);
    expect(data.discardedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(data.discardedAt.getTime()).toBeLessThanOrEqual(Date.now());

    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        entityType: "Event",
        entityId: "evt_draft",
        action: "DISCARDED",
        actorId: "usr_org",
        fieldName: "discardedAt",
        newValue: data.discardedAt.toISOString(),
        summary: "Draft discarded by its organiser (SCRUM-130)",
      },
    });
    expect(mockRevalidate).toHaveBeenCalledWith("/events");
  });

  it("SCRUM-130 [AC1] TC-130-07: discarding a draft that is already discarded succeeds without writing a second change or history entry", async () => {
    mockAuth.mockResolvedValue(owner());
    tx.event.findUnique.mockResolvedValue(
      draftRow({ discardedAt: new Date("2026-10-01T00:00:00Z") }),
    );

    const result = await discardDraftEvent({ eventId: "evt_draft" });

    expect(result).toEqual({ ok: true, data: { id: "evt_draft" } });
    expectNothingWritten();
  });

  it("SCRUM-130 [AC1] TC-130-08: when the draft changes between reading and writing (e.g. submitted at the same moment), nothing is discarded and the Organiser is told to refresh", async () => {
    mockAuth.mockResolvedValue(owner());
    tx.event.findUnique.mockResolvedValue(draftRow());
    tx.event.updateMany.mockResolvedValue({ count: 0 });

    const result = await discardDraftEvent({ eventId: "evt_draft" });

    expect(result).toEqual({
      ok: false,
      error:
        "This draft changed while you were discarding it. Refresh and try again.",
    });
    expect(tx.auditLog.create).not.toHaveBeenCalled();
    expect(mockRevalidate).not.toHaveBeenCalled();
  });

  it.each([
    "SUBMITTED",
    "UNDER_REVIEW",
    "APPROVED",
    "PLANNING",
    "CONFIRMED",
    "COMPLETED",
    "CANCELLED",
    "REJECTED",
  ] as const)(
    "SCRUM-130 [AC3] TC-130-04: the Organiser's own %s request cannot be discarded and is left unchanged",
    async (status) => {
      mockAuth.mockResolvedValue(owner());
      // An assigned coordinator, as a non-draft usually has: the owner is
      // still related, so this reaches the status rule rather than "not found".
      tx.event.findUnique.mockResolvedValue(
        draftRow({ status, coordinatorId: "usr_coord" }),
      );

      const result = await discardDraftEvent({ eventId: "evt_sent" });

      expect(result).toEqual({
        ok: false,
        error:
          "Only a draft can be discarded. A submitted request is cancelled through a change request.",
      });
      expectNothingWritten();
    },
  );

  it("SCRUM-130 [AC4] TC-130-05: another Organiser's draft is refused exactly as a missing id is, so the request can't reveal it exists", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_org2"));

    tx.event.findUnique.mockResolvedValue(draftRow());
    const forOther = await discardDraftEvent({ eventId: "evt_draft" });
    tx.event.findUnique.mockResolvedValue(null);
    const forMissing = await discardDraftEvent({ eventId: "evt_missing" });

    expect(forOther).toEqual({ ok: false, error: "Event not found." });
    expect(forOther).toEqual(forMissing);
    expectNothingWritten();
  });

  it("SCRUM-130 [AC4] TC-130-05: another Organiser's already-discarded draft is also \"not found\", not the owner's repeat-discard success", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_org2"));
    tx.event.findUnique.mockResolvedValue(
      draftRow({ discardedAt: new Date("2026-10-01T00:00:00Z") }),
    );

    expect(await discardDraftEvent({ eventId: "evt_draft" })).toEqual({
      ok: false,
      error: "Event not found.",
    });
    expectNothingWritten();
  });

  it("SCRUM-130 [AC4] TC-130-05: another Organiser's submitted request is \"not found\", not told it isn't a draft", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_org2"));
    tx.event.findUnique.mockResolvedValue(
      draftRow({ status: "SUBMITTED", coordinatorId: null }),
    );

    expect(await discardDraftEvent({ eventId: "evt_sent" })).toEqual({
      ok: false,
      error: "Event not found.",
    });
    expectNothingWritten();
  });

  it.each(["COORDINATOR", "VENUE_STAFF", "TECH_SUPPORT", "ATTENDEE"] as const)(
    "SCRUM-130 [AC4] TC-130-06: a %s's direct request is refused before the event is even read",
    async (role) => {
      mockAuth.mockResolvedValue(sessionFor(role, "usr_other"));
      tx.event.findUnique.mockResolvedValue(draftRow());

      const result = await discardDraftEvent({ eventId: "evt_draft" });

      expect(result).toEqual({
        ok: false,
        error: "You do not have permission to do that.",
      });
      expect(tx.event.findUnique).not.toHaveBeenCalled();
      expectNothingWritten();
    },
  );

  it("SCRUM-130 [AC4] TC-130-06: a request with no session is refused before the event is read", async () => {
    mockAuth.mockResolvedValue(null);

    expect(await discardDraftEvent({ eventId: "evt_draft" })).toEqual({
      ok: false,
      error: "You do not have permission to do that.",
    });
    expect(tx.event.findUnique).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it.each([
    ["no event id", {}],
    ["an empty event id", { eventId: "" }],
    ["a non-string event id", { eventId: 42 }],
    ["no input at all", undefined],
  ])(
    "SCRUM-130 [Validation]: %s is refused before anything is read",
    async (_label, input) => {
      mockAuth.mockResolvedValue(owner());

      expect(await discardDraftEvent(input)).toEqual({
        ok: false,
        error: "Please choose a draft to discard.",
      });
      expect(tx.event.findUnique).not.toHaveBeenCalled();
      expectNothingWritten();
    },
  );

  it("SCRUM-130 [Exit path]: an unexpected failure reading the event propagates instead of being reported as a refusal", async () => {
    mockAuth.mockResolvedValue(owner());
    tx.event.findUnique.mockRejectedValue(new Error("connection lost"));

    await expect(discardDraftEvent({ eventId: "evt_draft" })).rejects.toThrow(
      "connection lost",
    );
  });

  it("SCRUM-130 [Exit path]: a failure writing the history entry propagates, so the transaction rolls the discard back", async () => {
    mockAuth.mockResolvedValue(owner());
    tx.event.findUnique.mockResolvedValue(draftRow());
    tx.auditLog.create.mockRejectedValue(new Error("audit write failed"));

    await expect(discardDraftEvent({ eventId: "evt_draft" })).rejects.toThrow(
      "audit write failed",
    );
    // Both writes were inside the one transaction callback.
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockRevalidate).not.toHaveBeenCalled();
  });
});

describe('can("event:discard") — SCRUM-130 AC4', () => {
  const draftOf = (organiserId: string) => ({
    kind: "event" as const,
    organiserId,
    coordinatorId: null,
    status: "DRAFT" as const,
  });

  it("SCRUM-130 [AC4]: lets an Organiser discard their own draft", () => {
    expect(
      can(
        { id: "usr_org", role: "ORGANISER" },
        "event:discard",
        draftOf("usr_org"),
      ),
    ).toBe(true);
  });

  it("SCRUM-130 [AC4]: refuses another Organiser", () => {
    expect(
      can(
        { id: "usr_org2", role: "ORGANISER" },
        "event:discard",
        draftOf("usr_org"),
      ),
    ).toBe(false);
  });

  it.each(["COORDINATOR", "VENUE_STAFF", "TECH_SUPPORT", "ATTENDEE"] as const)(
    "SCRUM-130 [AC4]: refuses a %s, even one assigned to the event",
    (role) => {
      expect(
        can({ id: "usr_x", role }, "event:discard", {
          ...draftOf("usr_org"),
          coordinatorId: "usr_x",
        }),
      ).toBe(false);
    },
  );
});

describe("A discarded draft cannot be reopened — SCRUM-130 AC1", () => {
  it("SCRUM-130 [AC1, AC5] TC-130-01: My Event Requests leaves out discarded drafts and filters nothing else — no age or date limit, because drafts never expire", async () => {
    tx.event.findMany.mockResolvedValue([]);

    await getOrganiserEvents("usr_org");

    expect(tx.event.findMany).toHaveBeenCalledWith({
      where: { organiserId: "usr_org", discardedAt: null },
      orderBy: { updatedAt: "desc" },
    });
  });

  it("SCRUM-130 [AC1] TC-130-02: saving a discarded draft is refused — the write only matches an undiscarded Draft, so nothing is changed", async () => {
    mockAuth.mockResolvedValue(owner());
    tx.event.updateMany.mockResolvedValue({ count: 0 });

    const result = await createDraftEvent({ id: "evt_draft", name: "Edited" });

    expect(result).toEqual({
      ok: false,
      error: "Draft event not found or cannot be modified.",
    });
    expect(tx.event.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.event.updateMany.mock.calls[0][0].where).toEqual({
      id: "evt_draft",
      organiserId: "usr_org",
      status: "DRAFT",
      discardedAt: null,
    });
    expect(tx.event.update).not.toHaveBeenCalled();
    expect(mockRevalidate).not.toHaveBeenCalled();
  });

  it("SCRUM-130 [AC1] TC-130-02: submitting a discarded draft is refused — the lookup only matches an undiscarded Draft", async () => {
    mockAuth.mockResolvedValue(owner());
    tx.event.findFirst.mockResolvedValue(null);
    const start = new Date(Date.now() + 86_400_000);

    const result = await submitEventRequest({
      id: "evt_draft",
      name: "Discarded draft",
      purpose: "Purpose",
      description: "Description",
      startAt: start.toISOString(),
      endAt: new Date(start.getTime() + 3_600_000).toISOString(),
      expectedAttendance: 20,
      venueRequirements: "Any room",
      preferredLayout: "Theatre",
      accessibilityNeeds: "None",
      equipmentRequirements: "None",
      registrationRequired: "yes",
      registrationNotes: "None",
    });

    expect(result).toEqual({
      ok: false,
      error: "Draft or rejected event not found or cannot be submitted.",
    });
    expect(tx.event.findFirst).toHaveBeenCalledWith({
      where: {
        id: "evt_draft",
        organiserId: "usr_org",
        discardedAt: null,
      },
    });
    expect(tx.event.update).not.toHaveBeenCalled();
  });

  it("SCRUM-130 [AC1] TC-130-02: the shared single-event read returns nothing for a discarded draft, even to its owner", async () => {
    mockAuth.mockResolvedValue(owner());
    tx.event.findUnique.mockResolvedValue({
      id: "evt_draft",
      ...draftRow({ discardedAt: new Date("2026-10-01T00:00:00Z") }),
    });

    expect(await getEventForUser("evt_draft")).toBeNull();
  });

  it("SCRUM-130 [AC1]: the shared single-event read still returns the owner's undiscarded draft", async () => {
    mockAuth.mockResolvedValue(owner());
    const row = { id: "evt_draft", ...draftRow() };
    tx.event.findUnique.mockResolvedValue(row);

    expect(await getEventForUser("evt_draft")).toBe(row);
  });
});

describe("startRequestFromRejected after a discard — SCRUM-130 with SCRUM-126 AC4", () => {
  const rejected = {
    name: "Overcapacity Concert",
    purpose: "Fundraising",
    description: null,
    startAt: null,
    endAt: null,
    expectedAttendance: 2000,
    venueRequirements: null,
    requiredFacilities: [],
    accessibilityNeeds: null,
    preferredLayout: null,
    equipmentRequirements: null,
    registrationNotes: null,
    programme: null,
    specialRequests: null,
    equipmentTypes: [],
    registrationRequired: null,
  };

  it("SCRUM-130 [AC1] TC-130-09: when the Draft started from a rejection was discarded, starting again makes a fresh Draft instead of pointing at the discarded one", async () => {
    mockAuth.mockResolvedValue(owner());
    tx.event.findFirst
      .mockResolvedValueOnce(rejected) // the rejected event itself
      .mockResolvedValueOnce(null); // its earlier Draft, now discarded
    tx.auditLog.findFirst.mockResolvedValue({ newValue: "evt_discarded" });
    tx.event.create.mockResolvedValue({ id: "evt_fresh" });

    const result = await startRequestFromRejected({ eventId: "evt_rejected" });

    expect(result).toEqual({
      ok: true,
      data: { id: "evt_fresh", created: true },
    });
    expect(tx.event.findFirst).toHaveBeenLastCalledWith({
      where: { id: "evt_discarded", discardedAt: null },
      select: { id: true },
    });
    expect(tx.event.create).toHaveBeenCalledWith({
      data: {
        ...rejected,
        status: "DRAFT",
        timezone: "Asia/Singapore",
        organiserId: "usr_org",
      },
      select: { id: true },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityId: "evt_rejected",
        action: "NEW_REQUEST_STARTED",
        newValue: "evt_fresh",
      }),
    });
  });

  it("SCRUM-130 [AC1]: with no Draft started yet, the started-draft lookup is skipped", async () => {
    mockAuth.mockResolvedValue(owner());
    tx.event.findFirst.mockResolvedValueOnce(rejected);
    tx.event.create.mockResolvedValue({ id: "evt_first" });

    const result = await startRequestFromRejected({ eventId: "evt_rejected" });

    expect(result).toEqual({
      ok: true,
      data: { id: "evt_first", created: true },
    });
    expect(tx.event.findFirst).toHaveBeenCalledTimes(1);
  });
});

describe("draftStartIsInPast — SCRUM-130 AC6", () => {
  const now = new Date("2026-10-05T04:00:00.000Z");

  it("SCRUM-130 [AC6] TC-130-10: shows the exact wording the story asks for", () => {
    expect(PAST_DRAFT_DATES_MESSAGE).toBe(
      "Dates are in the past – update them before submitting",
    );
  });

  it("SCRUM-130 [AC6] TC-130-10: a start one millisecond before now is in the past", () => {
    expect(draftStartIsInPast(new Date(now.getTime() - 1), now)).toBe(true);
  });

  it("SCRUM-130 [AC6] TC-130-10: a start given as an ISO string (as the draft editor passes it) is read the same way", () => {
    expect(draftStartIsInPast("2026-10-04T04:00:00.000Z", now)).toBe(true);
    expect(draftStartIsInPast("2026-10-06T04:00:00.000Z", now)).toBe(false);
  });

  it("SCRUM-130 [AC6] TC-130-11: a start exactly now is not in the past, matching the submit rule (start < now)", () => {
    expect(draftStartIsInPast(new Date(now.getTime()), now)).toBe(false);
  });

  it("SCRUM-130 [AC6] TC-130-11: a future start is not in the past", () => {
    expect(draftStartIsInPast(new Date(now.getTime() + 1), now)).toBe(false);
  });

  it.each([
    ["no start yet", null],
    ["an undefined start", undefined],
    ["an empty field", ""],
    ["an unreadable value", "not a date"],
  ])("SCRUM-130 [AC6] TC-130-11: %s shows no warning", (_label, value) => {
    expect(draftStartIsInPast(value, now)).toBe(false);
  });

  it("SCRUM-130 [AC6]: compares against the current time when no time is given", () => {
    expect(draftStartIsInPast(new Date(Date.now() - 60_000))).toBe(true);
    expect(draftStartIsInPast(new Date(Date.now() + 60_000))).toBe(false);
  });
});

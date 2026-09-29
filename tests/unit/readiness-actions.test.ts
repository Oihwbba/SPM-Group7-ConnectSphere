import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { EventStatus, Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  getReadinessChecklist,
  type ReadinessChecklist,
} from "@/lib/event-readiness";
import { getEventReadiness } from "@/app/(app)/events/readiness-actions";

// SCRUM-110 AC 6 — who may read an event's readiness checklist, and how much of
// it. Session and database are mocked; the checklist itself is covered by
// event-readiness.test.ts, so here it is a fixed answer with a reason in it.

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { event: { findUnique: vi.fn() } } }));
vi.mock("@/lib/event-readiness", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/event-readiness")>()),
  getReadinessChecklist: vi.fn(),
}));

const mockAuth = auth as unknown as Mock;
const mockEventFindUnique = prisma.event.findUnique as unknown as Mock;
const mockChecklist = getReadinessChecklist as unknown as Mock;

const REASON = "Boardroom seats 14; the event expects 55 attendees.";
const checklist: ReadinessChecklist = {
  ready: false,
  items: [
    {
      name: "Venue booking",
      complete: false,
      state: "Rejected",
      reason: REASON,
      lines: [],
    },
    {
      name: "Equipment",
      complete: false,
      state: "Not fully reserved",
      reason: null,
      lines: ["Projector 3/5 reserved"],
    },
  ],
};

function sessionFor(role: Role, id: string): Session {
  return {
    user: { id, role, name: "Test User", email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  };
}

function eventRow(status: EventStatus = "PLANNING") {
  return {
    organiserId: "usr_organiser",
    coordinatorId: "usr_coordinator",
    status,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockEventFindUnique.mockResolvedValue(eventRow());
  mockChecklist.mockResolvedValue(checklist);
});

describe("getEventReadiness — SCRUM-110", () => {
  it("SCRUM-110 [AC6] TC-110-11: the assigned Coordinator gets the full checklist, internal reasons included", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_coordinator"));

    const result = await getEventReadiness("evt_test");

    expect(result).toEqual({ ok: true, data: checklist });
    expect(mockChecklist).toHaveBeenCalledWith(prisma, "evt_test");
  });

  it("SCRUM-110 [AC6] TC-110-12: the Organiser gets the same items and states, without internal reasons", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));

    const result = await getEventReadiness("evt_test");

    expect(result).toEqual({
      ok: true,
      data: {
        ready: false,
        items: [{ ...checklist.items[0], reason: null }, checklist.items[1]],
      },
    });
  });

  it.each([
    {
      who: "another Organiser",
      session: sessionFor("ORGANISER", "usr_organiser2"),
    },
    {
      who: "another Coordinator",
      session: sessionFor("COORDINATOR", "usr_coordinator2"),
    },
    {
      who: "Venue Staff",
      session: sessionFor("VENUE_STAFF", "usr_venuestaff"),
    },
    {
      who: "Technical Support",
      session: sessionFor("TECH_SUPPORT", "usr_techsupport"),
    },
    { who: "an Attendee", session: sessionFor("ATTENDEE", "usr_attendee") },
    { who: "a signed-out visitor", session: null },
  ])(
    "SCRUM-110 [AC6] TC-110-13: $who is told the event was not found, and nothing is read",
    async ({ session }) => {
      mockAuth.mockResolvedValue(session);

      const result = await getEventReadiness("evt_test");

      expect(result).toEqual({ ok: false, error: "Event not found." });
      expect(mockChecklist).not.toHaveBeenCalled();
    },
  );

  it("SCRUM-110 [AC6] TC-110-13: a missing event gives the same answer as one the viewer may not see", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_coordinator"));
    mockEventFindUnique.mockResolvedValue(null);

    const result = await getEventReadiness("evt_missing");

    expect(result).toEqual({ ok: false, error: "Event not found." });
    expect(mockChecklist).not.toHaveBeenCalled();
  });

  it("SCRUM-110 [AC6] TC-110-13: the event vanishing between the two reads is also not found", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_coordinator"));
    mockChecklist.mockResolvedValue(null);

    expect(await getEventReadiness("evt_test")).toEqual({
      ok: false,
      error: "Event not found.",
    });
  });
});

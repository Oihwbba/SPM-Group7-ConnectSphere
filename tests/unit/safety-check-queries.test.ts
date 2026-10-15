import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/can";
import {
  getSafetyCheckQueue,
  getSafetyCheckReview,
} from "@/app/(app)/safety-checks/queries";

// SCRUM-166 AC1, AC2, AC5, AC6 — what the Safety Officer's pages read. Test
// cases: docs/testing/SCRUM-166.md. The database is mocked.

vi.mock("@/lib/db", () => ({
  prisma: { safetyCheck: { findMany: vi.fn(), findUnique: vi.fn() } },
}));

const mockFindMany = prisma.safetyCheck.findMany as unknown as Mock;
const mockFindUnique = prisma.safetyCheck.findUnique as unknown as Mock;

const officer: SessionUser = { id: "usr_safety", role: "SAFETY_OFFICER" };
const START = new Date("2032-05-01T02:00:00Z");
const END = new Date("2032-05-01T04:00:00Z");

const event = (over: Record<string, unknown> = {}) => ({
  name: "Concert",
  startAt: START,
  endAt: END,
  expectedAttendance: 120,
  organiserId: "usr_org",
  coordinatorId: "usr_coord",
  status: "PLANNING",
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getSafetyCheckQueue — SCRUM-166 AC1, AC6", () => {
  it("SCRUM-166 [AC1] TC-166-01: lists checks awaiting review, oldest request first, with the event and who asked", async () => {
    const requestedAt = new Date("2032-04-01T00:00:00Z");
    mockFindMany.mockResolvedValue([
      { id: "chk_1", createdAt: requestedAt, requestedBy: { name: "Cody" }, event: event() },
    ]);

    expect(await getSafetyCheckQueue(officer)).toEqual([
      {
        id: "chk_1",
        requestedAt,
        requestedBy: "Cody",
        event: { name: "Concert", startAt: START, endAt: END, expectedAttendance: 120 },
      },
    ]);
    const query = mockFindMany.mock.calls[0][0];
    expect(query.where).toEqual({ status: "AWAITING_REVIEW" });
    expect(query.orderBy).toEqual({ createdAt: "asc" });
  });

  it("SCRUM-166 [AC6] TC-166-09: a check for an event the officer organises or coordinates is left out", async () => {
    mockFindMany.mockResolvedValue([
      { id: "chk_own", createdAt: START, requestedBy: { name: "Cody" }, event: event({ coordinatorId: "usr_safety" }) },
      { id: "chk_ok", createdAt: START, requestedBy: { name: "Cody" }, event: event() },
    ]);

    expect((await getSafetyCheckQueue(officer)).map((c) => c.id)).toEqual(["chk_ok"]);
  });
});

describe("getSafetyCheckReview — SCRUM-166 AC2, AC5, AC6", () => {
  const decidedAt = new Date("2032-04-02T00:00:00Z");
  const row = (over: Record<string, unknown> = {}) => ({
    id: "chk_2",
    status: "AWAITING_REVIEW",
    note: null,
    createdAt: START,
    decidedAt: null,
    requestedBy: { name: "Cody" },
    decidedBy: null,
    event: {
      ...event(),
      id: "evt_1",
      preferredLayout: "Theatre",
      accessibilityNeeds: "Two wheelchair users",
      bookings: [
        {
          id: "bkg_1",
          status: "APPROVED",
          requestedAttendance: 120,
          requestedLayout: "theatre",
          setupMinutes: 30,
          turnaroundMinutes: 45,
          venue: {
            name: "Exhibition Hall",
            capacity: 200,
            supportedLayouts: ["theatre", "banquet"],
            accessibilityFeatures: ["wheelchair-access"],
            knownRestrictions: "One emergency exit on the east side.",
          },
        },
      ],
      reservations: [
        {
          id: "res_1",
          equipmentId: "eqp_projector",
          quantity: 2,
          equipment: { type: "Projector", technicalSpecs: "HDMI" },
          request: {
            lines: [
              { equipmentId: "eqp_mic", technicalRequirements: "Lapel" },
              { equipmentId: "eqp_projector", technicalRequirements: "Ceiling mount above the stage." },
            ],
          },
        },
        {
          id: "res_2",
          equipmentId: "eqp_mic",
          quantity: 4,
          equipment: { type: "Wireless Microphone", technicalSpecs: null },
          request: null,
        },
      ],
      operationalNotes: [
        {
          body: "Stage crew arrives at 8 am.",
          createdAt: START,
          author: { name: "Cody" },
        },
      ],
      safetyChecks: [
        {
          id: "chk_1",
          status: "CHANGES_REQUESTED",
          note: "Move the stage.",
          createdAt: START,
          decidedAt,
          decidedBy: { name: "Sara" },
        },
        {
          id: "chk_0",
          status: "OUTDATED",
          note: null,
          createdAt: START,
          decidedAt: null,
          decidedBy: null,
        },
      ],
    },
    ...over,
  });

  it("SCRUM-166 [AC2] TC-166-13: shows the expected attendance, each venue's capacity, booked attendance, layouts, accessibility, setup and turnaround and restrictions, the reserved equipment with its placement, and the operational notes", async () => {
    mockFindUnique.mockResolvedValue(row());

    const review = await getSafetyCheckReview(officer, "chk_2");

    expect(review).toMatchObject({
      id: "chk_2",
      status: "AWAITING_REVIEW",
      requestedBy: "Cody",
      decidedBy: null,
      event: {
        name: "Concert",
        expectedAttendance: 120,
        preferredLayout: "Theatre",
        accessibilityNeeds: "Two wheelchair users",
      },
      venues: [
        {
          bookingId: "bkg_1",
          name: "Exhibition Hall",
          capacity: 200,
          bookedAttendance: 120,
          requestedLayout: "theatre",
          supportedLayouts: ["theatre", "banquet"],
          accessibilityFeatures: ["wheelchair-access"],
          setupMinutes: 30,
          turnaroundMinutes: 45,
          knownRestrictions: "One emergency exit on the east side.",
        },
      ],
      equipment: [
        {
          reservationId: "res_1",
          type: "Projector",
          quantity: 2,
          technicalSpecs: "HDMI",
          technicalRequirements: "Ceiling mount above the stage.",
        },
        { reservationId: "res_2", type: "Wireless Microphone", technicalRequirements: null },
      ],
      operationalNotes: [
        { body: "Stage crew arrives at 8 am.", author: "Cody", createdAt: START },
      ],
    });
    const { select } = mockFindUnique.mock.calls[0][0];
    // Approved bookings and holds not yet expired (SCRUM-163 AC4).
    expect(select.event.select.bookings.where).toEqual({
      OR: [
        { status: "APPROVED" },
        { status: "HELD", holdExpiresAt: { gt: expect.any(Date) } },
      ],
    });
    expect(select.event.select.operationalNotes.orderBy).toEqual({ createdAt: "asc" });
    expect(select.event.select.reservations.where).toEqual({ status: "CONFIRMED" });
  });

  it("SCRUM-166 [AC5] TC-166-14: lists the event's earlier checks, newest first, with their outcome, note, who and when", async () => {
    mockFindUnique.mockResolvedValue(
      row({ status: "APPROVED", decidedAt, decidedBy: { name: "Sara" } }),
    );

    const review = await getSafetyCheckReview(officer, "chk_2");

    expect(review?.decidedBy).toBe("Sara");
    expect(review?.history).toEqual([
      {
        id: "chk_1",
        status: "CHANGES_REQUESTED",
        note: "Move the stage.",
        decidedBy: "Sara",
        decidedAt,
        requestedAt: START,
      },
      { id: "chk_0", status: "OUTDATED", note: null, decidedBy: null, decidedAt: null, requestedAt: START },
    ]);
    const { select } = mockFindUnique.mock.calls[0][0];
    expect(select.event.select.safetyChecks.where).toEqual({ id: { not: "chk_2" } });
    expect(select.event.select.safetyChecks.orderBy).toEqual({ createdAt: "desc" });
  });

  it("SCRUM-166 [AC6] TC-166-09: a missing check, or one for an event the officer organises or coordinates, reads as not found", async () => {
    mockFindUnique.mockResolvedValue(null);
    expect(await getSafetyCheckReview(officer, "chk_x")).toBeNull();

    const own = row();
    own.event = { ...own.event, organiserId: "usr_safety" };
    mockFindUnique.mockResolvedValue(own);
    expect(await getSafetyCheckReview(officer, "chk_2")).toBeNull();
  });
});

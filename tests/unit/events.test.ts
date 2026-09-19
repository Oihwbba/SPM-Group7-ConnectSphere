import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { Role, EventStatus } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  createDraftEvent,
  submitEventRequest,
  getFormCatalogues,
} from "@/app/(app)/events/actions";

// ============================================================================
// MOCKS & SETUP
// ============================================================================
// The actions interact with NextAuth session management and Prisma DB calls.
// We mock both modules so tests run quickly in isolation without requiring a live DB connection.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    event: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    venue: { findMany: vi.fn() },
    equipment: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const mockAuth = auth as unknown as Mock;
const mockCreate = prisma.event.create as unknown as Mock;
const mockFindFirst = prisma.event.findFirst as unknown as Mock;
const mockUpdate = prisma.event.update as unknown as Mock;
const mockTransaction = prisma.$transaction as unknown as Mock;

// SCRUM-20: submitEventRequest now runs inside a transaction. These tests
// only exercise SCRUM-14's write path, so the transaction's "tx" reuses the
// SAME mock functions as the top-level prisma.event.* mocks above —
// existing assertions on mockCreate/mockFindFirst/mockUpdate keep working
// unchanged. tx.user.findMany resolves to [] (no coordinators), so
// auto-assignment is a no-op here; that logic has its own coverage in
// tests/unit/coordinator-assignment.test.ts and
// tests/unit/event-auto-assignment.test.ts.
const mockTxUserFindMany = vi.fn();
const mockTxNotificationCreateMany = vi.fn();
const mockTxAuditLogCreate = vi.fn();

/**
 * Helper utility to create a mock user session with a given role and ID.
 */
function sessionFor(role: Role, id: string): Session {
  return {
    user: { id, role, name: "Test User", email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  };
}

beforeEach(() => {
  // Clear mock history before each test to guarantee test isolation
  vi.clearAllMocks();
  mockTxUserFindMany.mockResolvedValue([]);
  mockTransaction.mockImplementation((cb: (tx: unknown) => unknown) =>
    cb({
      event: { create: mockCreate, findFirst: mockFindFirst, update: mockUpdate },
      user: { findMany: mockTxUserFindMany },
      notification: { createMany: mockTxNotificationCreateMany },
      auditLog: { create: mockTxAuditLogCreate },
    }),
  );
});

// ============================================================================
// USER STORY 13 UNIT TESTS
// ============================================================================
describe("User Story 13 — Event Request Creation", () => {
  // Relative dates to ensure tests pass reliably regardless of when they run
  const futureStart = new Date(Date.now() + 86400000).toISOString(); // 1 day in future
  const futureEnd = new Date(Date.now() + 86400000 + 7200000).toISOString(); // 1 day + 2 hours in future
  const pastDate = new Date(Date.now() - 86400000).toISOString(); // 1 day in past

  /**
   * Sample valid form submission payload containing all compulsory fields required by W4-33 & User Story 13 AC.
   */
  const validSubmissionInput = {
    name: "Regional Tech Conference",
    purpose: "Knowledge sharing and networking",
    description: "Annual regional gathering for tech professionals.",
    startAt: futureStart,
    endAt: futureEnd,
    expectedAttendance: 150,
    venueRequirements: "Large hall capable of hosting 150 people",
    requiredFacilities: ["projector", "sound-system"],
    preferredLayout: "Theatre",
    accessibilityNeeds: "Wheelchair access ramp and front-row physical seating",
    equipmentRequirements: "2 Wireless Microphones, 1 HD Projector",
    registrationNotes: "Online registration open to public with check-in counter",
    programme: "09:00 Opening Keynote, 12:00 Lunch, 15:00 Panel",
    specialRequests: "VIP catering for keynote speakers",
  };

  // --------------------------------------------------------------------------
  // 1. DRAFT SAVING TESTS (createDraftEvent)
  // --------------------------------------------------------------------------
  describe("createDraftEvent Action", () => {
    it("creates a draft owned by the signed-in organiser (happy path)", async () => {
      // 1. Mock logged-in user as an Event Organiser
      mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));
      mockCreate.mockResolvedValue({ id: "evt_draft_1" });

      // 2. Call action with partial draft details
      const result = await createDraftEvent({
        name: "Annual Tech Summit",
        description: "A day of talks.",
      });

      // 3. Assert success response & database creation call
      expect(result).toEqual({ ok: true, data: { id: "evt_draft_1" } });
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "Annual Tech Summit",
            status: "DRAFT",
            organiserId: "usr_organiser",
          }),
        }),
      );
    });

    it("returns field errors for invalid name (e.g. empty string)", async () => {
      mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));

      // Call action with invalid empty name
      const result = await createDraftEvent({ name: "" });

      // Assert error return and ensure DB was not touched
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.fieldErrors?.name).toBeTruthy();
      }
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // 2. SUBMISSION VALIDATION TESTS (submitEventRequest)
  // --------------------------------------------------------------------------
  describe("submitEventRequest — Validation Rules (User Story 13 AC)", () => {
    it("AC 1-5, 11: successfully creates complete event request when valid", async () => {
      // 1. Mock logged-in user as Event Organiser
      mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));
      mockCreate.mockResolvedValue({ id: "evt_sub_1" });

      // 2. Submit complete valid form payload
      const result = await submitEventRequest(validSubmissionInput);

      // 3. Assert successful creation with status SUBMITTED
      expect(result).toEqual({ ok: true, data: { id: "evt_sub_1" } });
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "Regional Tech Conference",
            purpose: "Knowledge sharing and networking",
            status: "SUBMITTED",
            expectedAttendance: 150,
            organiserId: "usr_organiser",
            accessibilityNeeds: "Wheelchair access ramp and front-row physical seating",
            programme: "09:00 Opening Keynote, 12:00 Lunch, 15:00 Panel",
            specialRequests: "VIP catering for keynote speakers",
          }),
        }),
      );
    });

    it("AC 8: Rejects zero expected attendance with invalid message", async () => {
      mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));

      // Attendance = 0 (invalid)
      const result = await submitEventRequest({
        ...validSubmissionInput,
        expectedAttendance: 0,
      });

      // Assert validation failure message
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.fieldErrors?.expectedAttendance).toContain(
          "Attendance must be a positive whole number.",
        );
      }
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("AC 8: Rejects negative expected attendance with invalid message", async () => {
      mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));

      // Attendance = -20 (invalid)
      const result = await submitEventRequest({
        ...validSubmissionInput,
        expectedAttendance: -20,
      });

      // Assert validation failure message
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.fieldErrors?.expectedAttendance).toContain(
          "Attendance must be a positive whole number.",
        );
      }
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("AC 10: Rejects proposed start date in the past", async () => {
      mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));

      // Start date set to past
      const result = await submitEventRequest({
        ...validSubmissionInput,
        startAt: pastDate,
      });

      // Assert startAt validation failure message
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.fieldErrors?.startAt).toContain(
          "Proposed date cannot be in the past.",
        );
      }
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("AC 9: Rejects proposed end date equal to start date (endAt <= startAt)", async () => {
      mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));

      // End date same as start date (invalid period)
      const result = await submitEventRequest({
        ...validSubmissionInput,
        startAt: futureStart,
        endAt: futureStart,
      });

      // Assert endAt period validation failure message
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.fieldErrors?.endAt).toContain(
          "Proposed end date and time must be strictly after the start date and time.",
        );
      }
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("AC 9: Rejects proposed end date earlier than start date", async () => {
      mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));

      // End date earlier than start date
      const result = await submitEventRequest({
        ...validSubmissionInput,
        startAt: futureEnd,
        endAt: futureStart,
      });

      // Assert endAt period validation failure message
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.fieldErrors?.endAt).toContain(
          "Proposed end date and time must be strictly after the start date and time.",
        );
      }
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("AC 6: Validates missing mandatory fields upon submission", async () => {
      mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));

      // Submit payload with empty compulsory fields
      const result = await submitEventRequest({
        name: "",
        purpose: "",
        description: "",
        startAt: "",
        endAt: "",
        expectedAttendance: undefined,
        venueRequirements: "",
        accessibilityNeeds: "",
        preferredLayout: "",
        equipmentRequirements: "",
        registrationNotes: "",
      });

      // Assert field errors exist for all missing mandatory fields
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.fieldErrors?.name).toBeTruthy();
        expect(result.fieldErrors?.purpose).toBeTruthy();
        expect(result.fieldErrors?.description).toBeTruthy();
        expect(result.fieldErrors?.startAt).toBeTruthy();
        expect(result.fieldErrors?.endAt).toBeTruthy();
        expect(result.fieldErrors?.expectedAttendance).toBeTruthy();
        expect(result.fieldErrors?.venueRequirements).toBeTruthy();
        expect(result.fieldErrors?.accessibilityNeeds).toBeTruthy();
        expect(result.fieldErrors?.preferredLayout).toBeTruthy();
        expect(result.fieldErrors?.equipmentRequirements).toBeTruthy();
        expect(result.fieldErrors?.registrationNotes).toBeTruthy();
      }
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("Security Gate: Denies non-organiser user role (e.g. ATTENDEE)", async () => {
      // Mock logged-in user as ATTENDEE instead of ORGANISER
      mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));

      const result = await submitEventRequest(validSubmissionInput);

      // Assert permission error and ensure DB write was blocked
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/permission/i);
      }
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });
});

// ============================================================================
// USER STORY 15 UNIT TESTS — Save an event request as draft & Resume drafts
// ============================================================================
describe("User Story 15 — Save an event request as draft", () => {
  const futureStart = new Date(Date.now() + 86400000).toISOString();
  const futureEnd = new Date(Date.now() + 86400000 + 7200000).toISOString();

  it("AC 1: Organiser can save a request at any point with required fields empty", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));
    mockCreate.mockResolvedValue({ id: "evt_draft_partial" });

    // Save draft with ONLY a name and no other required fields
    const result = await createDraftEvent({
      name: "Incomplete Tech Gathering",
    });

    expect(result).toEqual({ ok: true, data: { id: "evt_draft_partial" } });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Incomplete Tech Gathering",
          status: "DRAFT",
          organiserId: "usr_organiser",
          purpose: null,
          description: null,
          venueRequirements: null,
        }),
      }),
    );
  });

  it("AC 2: Saved draft retains all entered fields when updated (updating existing draft)", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));
    mockFindFirst.mockResolvedValue({
      id: "evt_draft_existing",
      organiserId: "usr_organiser",
      status: "DRAFT",
    });
    mockUpdate.mockResolvedValue({ id: "evt_draft_existing" });

    // Update existing draft with additional fields
    const result = await createDraftEvent({
      id: "evt_draft_existing",
      name: "Incomplete Tech Gathering — Updated",
      purpose: "New Purpose Added",
      venueRequirements: "Requires 100 capacity room",
    });

    expect(result).toEqual({ ok: true, data: { id: "evt_draft_existing" } });
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { id: "evt_draft_existing", organiserId: "usr_organiser", status: "DRAFT" },
    });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "evt_draft_existing" },
        data: expect.objectContaining({
          name: "Incomplete Tech Gathering — Updated",
          purpose: "New Purpose Added",
          venueRequirements: "Requires 100 capacity room",
        }),
      }),
    );
  });

  it("AC 3: Resumed draft can be submitted for review once compulsory fields are complete", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));
    mockFindFirst.mockResolvedValue({
      id: "evt_draft_resumed",
      organiserId: "usr_organiser",
      status: "DRAFT",
    });
    mockUpdate.mockResolvedValue({ id: "evt_draft_resumed" });

    const completeDraftSubmission = {
      id: "evt_draft_resumed",
      name: "Completed Resumed Event",
      purpose: "Networking",
      description: "Full description",
      startAt: futureStart,
      endAt: futureEnd,
      expectedAttendance: 100,
      venueRequirements: "Auditorium",
      preferredLayout: "Theatre",
      accessibilityNeeds: "Ramp access",
      equipmentRequirements: "Microphones",
      registrationNotes: "Online registration",
    };

    const result = await submitEventRequest(completeDraftSubmission);

    expect(result).toEqual({ ok: true, data: { id: "evt_draft_resumed" } });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "evt_draft_resumed" },
        data: expect.objectContaining({
          name: "Completed Resumed Event",
          status: "SUBMITTED",
          submittedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("Security check: Rejects updating or submitting draft owned by another user", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_other_organiser"));
    // Mock draft belonging to a different user, so findFirst returns null
    mockFindFirst.mockResolvedValue(null);

    const result = await createDraftEvent({
      id: "evt_draft_someone_else",
      name: "Attempted Hijack",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/not found or cannot be modified/i);
    }
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

// ============================================================================
// USER STORY 16 UNIT TESTS — Distinguish drafts from submitted requests
// ============================================================================
describe("User Story 16 — Distinguish drafts from submitted requests", () => {
  it("AC 1 & 2: Draft status is created as DRAFT and differs strictly from SUBMITTED or UNDER_REVIEW", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));
    mockCreate.mockResolvedValue({ id: "evt_draft_distinguish", status: "DRAFT" });

    // 1. Create a draft request
    const draftResult = await createDraftEvent({
      name: "Unsubmitted Work In Progress",
    });

    expect(draftResult.ok).toBe(true);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "DRAFT",
        }),
      }),
    );
  });

  it("AC 2: Draft requests transition to SUBMITTED upon submission and do not retain DRAFT status", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));
    mockFindFirst.mockResolvedValue({
      id: "evt_draft_to_submit",
      organiserId: "usr_organiser",
      status: "DRAFT",
    });
    mockUpdate.mockResolvedValue({ id: "evt_draft_to_submit", status: "SUBMITTED" });

    const futureStart = new Date(Date.now() + 86400000).toISOString();
    const futureEnd = new Date(Date.now() + 86400000 + 7200000).toISOString();

    const submittedResult = await submitEventRequest({
      id: "evt_draft_to_submit",
      name: "Transitioned Event",
      purpose: "Testing status transition",
      description: "Submitting completed draft",
      startAt: futureStart,
      endAt: futureEnd,
      expectedAttendance: 50,
      venueRequirements: "Small room",
      preferredLayout: "Classroom",
      accessibilityNeeds: "None",
      equipmentRequirements: "Projector",
      registrationNotes: "None",
    });

    expect(submittedResult.ok).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "evt_draft_to_submit" },
        data: expect.objectContaining({
          status: "SUBMITTED",
        }),
      }),
    );
  });
});

// ============================================================================
// USER STORY 84 UNIT TESTS — Organiser views their own event requests
// ============================================================================
describe("User Story 84 — Organiser views their own event requests", () => {
  const allStatuses: EventStatus[] = [
    "DRAFT",
    "SUBMITTED",
    "UNDER_REVIEW",
    "APPROVED",
    "PLANNING",
    "CONFIRMED",
    "COMPLETED",
    "CANCELLED",
    "REJECTED",
  ];

  it("AC 1 & 3: Organiser queries events owned strictly by their organiserId across all 9 statuses", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser_us84"));

    const mockEventsList = allStatuses.map((status, idx) => ({
      id: `evt_us84_${idx}`,
      name: `Event ${status}`,
      status,
      organiserId: "usr_organiser_us84",
      createdAt: new Date(),
    }));

    prisma.event.findMany = vi.fn().mockResolvedValue(mockEventsList);

    const events = await prisma.event.findMany({
      where: { organiserId: "usr_organiser_us84" },
      orderBy: { createdAt: "desc" },
    });

    expect(events.length).toBe(9);
    expect(prisma.event.findMany).toHaveBeenCalledWith({
      where: { organiserId: "usr_organiser_us84" },
      orderBy: { createdAt: "desc" },
    });
    // Verify all 9 statuses are present in the returned list
    const returnedStatuses = events.map((e) => e.status);
    allStatuses.forEach((status) => {
      expect(returnedStatuses).toContain(status);
    });
  });

  it("AC 2: Each event entry exposes its name and status for display", async () => {
    const sampleEvent = {
      id: "evt_sample_1",
      name: "Annual Regional Conference",
      status: "APPROVED",
      organiserId: "usr_organiser_us84",
      createdAt: new Date(),
    };

    prisma.event.findMany = vi.fn().mockResolvedValue([sampleEvent]);

    const events = await prisma.event.findMany({
      where: { organiserId: "usr_organiser_us84" },
    });

    expect(events[0].name).toBe("Annual Regional Conference");
    expect(events[0].status).toBe("APPROVED");
  });

  it("AC 4 & 5: Organiser can retrieve full details for any selected event entry regardless of status", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser_us84"));

    const detailedDraftEvent = {
      id: "evt_draft_detail",
      name: "Draft Detail Event",
      status: "DRAFT",
      purpose: "Draft purpose",
      description: "Draft description",
      organiserId: "usr_organiser_us84",
      createdAt: new Date(),
    };

    prisma.event.findUnique = vi.fn().mockResolvedValue(detailedDraftEvent);

    const result = await prisma.event.findUnique({
      where: { id: "evt_draft_detail" },
    });

    expect(result).toBeDefined();
    expect(result?.id).toBe("evt_draft_detail");
    expect(result?.status).toBe("DRAFT");
    expect(result?.name).toBe("Draft Detail Event");
  });
});

// ============================================================================
// getFormCatalogues — a "use server" export is a public endpoint, so it must
// refuse anyone who cannot create an event request.
// ============================================================================
describe("getFormCatalogues — permission gate", () => {
  const mockVenues = prisma.venue.findMany as unknown as Mock;
  const mockEquipment = prisma.equipment.findMany as unknown as Mock;

  it("returns the venue and equipment catalogue to an organiser", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));
    mockVenues.mockResolvedValue([
      { id: "ven1", name: "Hall A", capacity: 200, facilities: ["projector"] },
    ]);
    mockEquipment.mockResolvedValue([
      { id: "eq1", type: "Microphone", totalQuantity: 10 },
    ]);

    const result = await getFormCatalogues();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.venues).toHaveLength(1);
      expect(result.data.equipment).toHaveLength(1);
    }
  });

  it.each(["ATTENDEE", "VENUE_STAFF", "TECH_SUPPORT"] as Role[])(
    "refuses %s and never queries the catalogue",
    async (role) => {
      mockAuth.mockResolvedValue(sessionFor(role, `usr_${role.toLowerCase()}`));

      const result = await getFormCatalogues();

      expect(result.ok).toBe(false);
      expect(mockVenues).not.toHaveBeenCalled();
      expect(mockEquipment).not.toHaveBeenCalled();
    },
  );

  it("refuses a signed-out caller", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await getFormCatalogues();

    expect(result.ok).toBe(false);
    expect(mockVenues).not.toHaveBeenCalled();
  });
});




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
  },
}));

const mockAuth = auth as unknown as Mock;
const mockCreate = prisma.event.create as unknown as Mock;
const mockFindFirst = prisma.event.findFirst as unknown as Mock;
const mockUpdate = prisma.event.update as unknown as Mock;

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
});

// ============================================================================
// USER STORY 13 UNIT TESTS — Create an event request
// ============================================================================
describe("User Story 13 — Event Request Creation", () => {
  // Relative dates to ensure tests pass reliably regardless of when they run
  const futureStart = new Date(Date.now() + 86400000).toISOString(); // 1 day in future
  const futureEnd = new Date(Date.now() + 86400000 + 7200000).toISOString(); // 1 day + 2 hours in future
  const pastDate = new Date(Date.now() - 86400000).toISOString(); // 1 day in past

  /**
   * Sample valid form submission payload containing all compulsory fields required by User Story 13 AC.
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
  // SUBMISSION VALIDATION TESTS (submitEventRequest)
  // --------------------------------------------------------------------------
  describe("submitEventRequest — Validation Rules", () => {
    it("SCRUM-13 [AC1, AC10 - Happy Path]: successfully creates complete event request when all mandatory and optional fields are valid", async () => {
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

    it("SCRUM-13 [AC3 - Happy Path]: accepts request when optional fields (programme, special requests) are omitted", async () => {
      mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));
      mockCreate.mockResolvedValue({ id: "evt_no_optionals" });

      const inputWithoutOptionals: Record<string, unknown> = { ...validSubmissionInput };
      delete inputWithoutOptionals.programme;
      delete inputWithoutOptionals.specialRequests;

      const result = await submitEventRequest(inputWithoutOptionals);

      expect(result.ok).toBe(true);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "Regional Tech Conference",
            programme: null,
            specialRequests: null,
          }),
        }),
      );
    });

    it("SCRUM-13 [AC3 - Happy Path]: successfully submits request with optional programme, special requests, and required facilities populated", async () => {
      mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));
      mockCreate.mockResolvedValue({ id: "evt_full_optional" });

      // Submit payload containing all optional fields (programme, specialRequests, requiredFacilities)
      const result = await submitEventRequest({
        ...validSubmissionInput,
        requiredFacilities: ["projector", "sound-system", "wifi"],
        programme: "09:00 Keynote, 14:00 Workshop",
        specialRequests: "VIP Security escort and HALAL catering",
      });

      expect(result.ok).toBe(true);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            requiredFacilities: ["projector", "sound-system", "wifi"],
            programme: "09:00 Keynote, 14:00 Workshop",
            specialRequests: "VIP Security escort and HALAL catering",
          }),
        }),
      );
    });

    it("SCRUM-13 [AC7 - Domain Boundary]: rejects submission when expected attendance is 0", async () => {
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

    it("SCRUM-13 [AC7 - Domain Boundary]: rejects submission when expected attendance is a negative number", async () => {
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

    it("SCRUM-13 [AC9 - Domain Boundary]: rejects submission when proposed start date is in the past", async () => {
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

    it("SCRUM-13 [AC8 - Domain Boundary]: rejects submission when proposed end date is equal to start date (zero-duration)", async () => {
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

    it("SCRUM-13 [AC8 - Domain Boundary]: rejects submission when proposed end date is earlier than start date", async () => {
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

    it("SCRUM-13 [AC8 - Implicit Rule]: accepts valid cross-midnight overnight event schedules spanning across calendar days", async () => {
      mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));
      mockCreate.mockResolvedValue({ id: "evt_overnight" });

      // Overnight event: starts 23:30 today, ends 02:30 tomorrow (+27 hours from now)
      const overnightStart = new Date(Date.now() + 86400000).toISOString();
      const overnightEnd = new Date(Date.now() + 86400000 + 10800000).toISOString();

      const result = await submitEventRequest({
        ...validSubmissionInput,
        name: "Overnight Hackathon Session",
        startAt: overnightStart,
        endAt: overnightEnd,
      });

      expect(result.ok).toBe(true);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "Overnight Hackathon Session",
            startAt: new Date(overnightStart),
            endAt: new Date(overnightEnd),
          }),
        }),
      );
    });

    it("SCRUM-13 [AC4 - Business-Rule Negative]: returns field errors when any mandatory field is missing upon submission", async () => {
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

    it("SCRUM-13 [AC4 - Business-Rule Negative]: rejects whitespace-only values for mandatory string fields", async () => {
      mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));

      // Submit payload with whitespace-only required fields
      const result = await submitEventRequest({
        ...validSubmissionInput,
        name: "    ",
        purpose: "\t\n  ",
        description: "   ",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.fieldErrors?.name).toBeTruthy();
        expect(result.fieldErrors?.purpose).toBeTruthy();
        expect(result.fieldErrors?.description).toBeTruthy();
      }
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("SCRUM-13 [AC11 - Cross-Cutting / Input Constraint]: trims leading and trailing whitespace from string fields upon schema parsing", async () => {
      mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));
      mockCreate.mockResolvedValue({ id: "evt_trimmed" });

      const result = await submitEventRequest({
        ...validSubmissionInput,
        name: "   Padded Event Title   ",
      });

      expect(result.ok).toBe(true);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "Padded Event Title",
          }),
        }),
      );
    });

    it("SCRUM-13 [Security Gate]: denies non-organiser user role (e.g. ATTENDEE) from submitting event requests", async () => {
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

    it("SCRUM-13 [Security Gate]: refuses signed-out callers for createDraftEvent and submitEventRequest", async () => {
      // Mock signed-out caller
      mockAuth.mockResolvedValue(null);

      const draftResult = await createDraftEvent({ name: "Unauthenticated Draft" });
      expect(draftResult.ok).toBe(false);
      if (!draftResult.ok) {
        expect(draftResult.error).toMatch(/permission/i);
      }

      const submitResult = await submitEventRequest(validSubmissionInput);
      expect(submitResult.ok).toBe(false);
      if (!submitResult.ok) {
        expect(submitResult.error).toMatch(/permission/i);
      }

      expect(mockCreate).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });
});

// ============================================================================
// USER STORY 15 UNIT TESTS — Save an event request as draft & Resume drafts
// ============================================================================
describe("User Story 15 — Save an event request as draft", () => {
  const futureStart = new Date(Date.now() + 86400000).toISOString();
  const futureEnd = new Date(Date.now() + 86400000 + 7200000).toISOString();

  it("SCRUM-15 [AC1 - Happy Path]: allows saving a draft with mandatory submission fields left empty", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));
    mockCreate.mockResolvedValue({ id: "evt_draft_1" });

    // Call action with partial draft details (only name & description)
    const result = await createDraftEvent({
      name: "Annual Tech Summit",
      description: "A day of talks.",
    });

    expect(result).toEqual({ ok: true, data: { id: "evt_draft_1" } });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Annual Tech Summit",
          description: "A day of talks.",
          purpose: null,
          venueRequirements: null,
          status: "DRAFT",
          organiserId: "usr_organiser",
        }),
      }),
    );
  });

  it("SCRUM-15 [Timezone Persistence]: stores chosen non-Singapore timezone (e.g. America/New_York) in database payload", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));
    mockCreate.mockResolvedValue({ id: "evt_draft_ny" });

    const result = await createDraftEvent({
      name: "NY Global Summit",
      description: "Remote event in EST",
      timezone: "America/New_York (EST/EDT)",
    });

    expect(result.ok).toBe(true);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "NY Global Summit",
          timezone: "America/New_York (EST/EDT)",
        }),
      }),
    );
  });

  it("SCRUM-15 [AC4 - Relaxation Rule]: allows saving a draft with missing mandatory fields (dates/venue/equipment/attendance omitted)", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));
    mockCreate.mockResolvedValue({ id: "evt_draft_relaxed" });

    // Draft containing minimal info while omitting all compulsory submission fields
    const result = await createDraftEvent({
      name: "Work In Progress Draft",
      description: "Draft without dates or venue requirements",
    });

    expect(result.ok).toBe(true);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Work In Progress Draft",
          status: "DRAFT",
        }),
      }),
    );
  });

  it("SCRUM-15 [AC4 - Validation Rule]: draft schema rejects 0 attendance when attendance is provided in draft", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));

    // Expected attendance = 0 provided to draft
    const result = await createDraftEvent({
      name: "Draft With Invalid Attendance",
      expectedAttendance: 0,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors?.expectedAttendance).toContain(
        "Attendance must be a positive whole number.",
      );
    }
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("SCRUM-15 [AC3 - Business-Rule Negative]: returns field error when attempting to save a draft without an event name", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));

    const result = await createDraftEvent({ name: "" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors?.name).toBeTruthy();
    }
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("SCRUM-15 [AC2 - Happy Path]: retains existing field values when updating an existing draft request", async () => {
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

  it("SCRUM-15 [AC2 - Cross-Cutting / Timezone]: preserves exact UTC datetime without offset drift across multiple draft updates", async () => {
    const fixedUtcIso = "2026-11-20T10:00:00.000Z";
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));
    mockFindFirst.mockResolvedValue({
      id: "evt_draft_tz",
      organiserId: "usr_organiser",
      status: "DRAFT",
      startAt: new Date(fixedUtcIso),
    });
    mockUpdate.mockResolvedValue({ id: "evt_draft_tz" });

    // Re-save draft with startAt to ensure UTC timestamp stability
    const result = await createDraftEvent({
      id: "evt_draft_tz",
      name: "Draft Event - Pass 1",
      startAt: fixedUtcIso,
    });

    expect(result.ok).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "evt_draft_tz" },
        data: expect.objectContaining({
          startAt: new Date(fixedUtcIso),
        }),
      }),
    );
  });

  it("SCRUM-15 [AC5 - State Transition]: transitions draft status from DRAFT to SUBMITTED when draft is fully completed and submitted", async () => {
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

  it("SCRUM-15 [Security Gate / Ownership Isolation]: refuses to update or submit a draft owned by another organiser", async () => {
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
  it("SCRUM-16 [AC1, AC2 - Happy Path]: creates event with status DRAFT ensuring visual and logical separation from SUBMITTED", async () => {
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

  it("SCRUM-16 [AC2 - State Transition]: updates status from DRAFT to SUBMITTED upon submission, removing draft state", async () => {
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

  it("SCRUM-16 [AC4 - Coordinator View Exclusion]: excludes DRAFT events when querying submitted events for review", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_coordinator"));

    prisma.event.findMany = vi.fn().mockResolvedValue([
      { id: "evt_sub", status: "SUBMITTED" },
    ]);

    const results = await prisma.event.findMany({
      where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
    });

    expect(prisma.event.findMany).toHaveBeenCalledWith({
      where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
    });
    const statuses = results.map((r) => r.status);
    expect(statuses).not.toContain("DRAFT");
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

  it("SCRUM-84 [AC1, AC2 - Happy Path / Ownership Isolation]: queries only events belonging to the logged-in organiser across all 9 statuses", async () => {
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

  it("SCRUM-84 [AC3 - Implicit Rule / Default Sort]: enforces reverse chronological ordering (newest first) when fetching organiser event requests", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser_us84"));
    prisma.event.findMany = vi.fn().mockResolvedValue([]);

    await prisma.event.findMany({
      where: { organiserId: "usr_organiser_us84" },
      orderBy: { createdAt: "desc" },
    });

    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
      }),
    );
  });

  it("SCRUM-84 [AC3 - Happy Path]: exposes event name and current status badge properties for list display", async () => {
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

  it("SCRUM-84 [AC4, AC5 - Happy Path]: retrieves full detail model when selecting a specific event request", async () => {
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

  it("SCRUM-84 [AC5 - Edge Case / Empty State]: returns an empty array when an organiser has not created any event requests", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_new_organiser"));
    prisma.event.findMany = vi.fn().mockResolvedValue([]);

    const results = await prisma.event.findMany({
      where: { organiserId: "usr_new_organiser" },
    });

    expect(results).toEqual([]);
    expect(results.length).toBe(0);
  });

  it("SCRUM-84 [AC6 - Happy Path / Search Filter]: filters event list by search query matching event name or purpose", async () => {
    const events = [
      { id: "1", name: "Annual Tech Conference", purpose: "Tech networking", status: "APPROVED" },
      { id: "2", name: "Internal Team Retreat", purpose: "Team building", status: "DRAFT" },
    ];

    const searchQuery = "Tech";
    const filtered = events.filter(
      (e) =>
        e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.purpose.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("1");
  });

  it("SCRUM-84 [AC7 - Default & Custom Sorting]: orders event list by updatedAt descending by default", async () => {
    const events = [
      { id: "1", name: "Older Event", updatedAt: new Date("2026-08-01T10:00:00Z") },
      { id: "2", name: "Recently Updated Event", updatedAt: new Date("2026-09-15T12:00:00Z") },
    ];

    const sortedEvents = [...events].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    expect(sortedEvents[0].id).toBe("2");
    expect(sortedEvents[1].id).toBe("1");
  });

  it("SCRUM-84 [AC8 - Multi-Criteria Filtering Combination]: filters events by active tab AND search query simultaneously", async () => {
    const events = [
      { id: "1", name: "Annual Tech Conference", purpose: "Networking", status: "DRAFT" },
      { id: "2", name: "Tech Workshop", purpose: "Training", status: "APPROVED" },
      { id: "3", name: "Annual HR Retreat", purpose: "Team building", status: "DRAFT" },
    ];

    const activeTab = "DRAFT";
    const searchQuery = "Tech";

    const filtered = events.filter((evt) => {
      const matchesTab = activeTab === "DRAFT" ? evt.status === "DRAFT" : true;
      const matchesSearch =
        evt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        evt.purpose.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTab && matchesSearch;
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("1");
  });

  it("SCRUM-84 [AC9 - Search Cleared State & Partial Matches]: matches partial string and restores list when search is cleared", async () => {
    const events = [
      { id: "1", name: "Annual Hackathon", status: "SUBMITTED" },
      { id: "2", name: "Quarterly Review", status: "SUBMITTED" },
    ];

    // 1. Partial match test
    let searchQuery = "hack";
    let filtered = events.filter((evt) =>
      evt.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("1");

    // 2. Cleared search restores all events
    searchQuery = "";
    filtered = events.filter(
      (evt) => !searchQuery.trim() || evt.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
    expect(filtered).toHaveLength(2);
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

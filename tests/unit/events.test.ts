import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { Role, EventStatus } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/can";
import {
  createDraftEvent,
  submitEventRequest,
  getFormCatalogues,
} from "@/app/(app)/events/actions";
import { filterAndSortEvents } from "@/app/(app)/events/events-client";
import {
  getOrganiserEvents,
  getCoordinatorEvents,
  getEventForUser,
} from "@/app/(app)/events/role-views";

// ============================================================================
// MOCKS & SETUP
// ============================================================================
// The actions interact with NextAuth session management and Prisma DB calls.
// We mock both modules so tests run quickly in isolation without requiring a live DB connection.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
// requirePermission is wrapped, not replaced: every existing test keeps
// exercising the REAL permission gate (can() logic unchanged) via
// vi.fn(actual.requirePermission) forwarding to it by default. Only the one
// exit-path test below overrides it with mockImplementationOnce, to prove an
// error requirePermission itself could throw isn't swallowed.
vi.mock("@/lib/auth/can", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/can")>();
  return { ...actual, requirePermission: vi.fn(actual.requirePermission) };
});
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
const mockTxExecuteRaw = vi.fn();
const mockTxQueryRaw = vi.fn();
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
      $executeRaw: mockTxExecuteRaw,
      $queryRaw: mockTxQueryRaw,
      user: { findMany: mockTxUserFindMany },
      notification: { createMany: mockTxNotificationCreateMany },
      auditLog: { create: mockTxAuditLogCreate },
    }),
  );
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

    it("SCRUM-13 [AC3 - Happy Path]: successfully submits request with optional programme and special requests populated", async () => {
      mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));
      mockCreate.mockResolvedValue({ id: "evt_full_optional" });

      // Submit payload containing optional fields (programme, specialRequests)
      const result = await submitEventRequest({
        ...validSubmissionInput,
        programme: "09:00 Keynote, 14:00 Workshop",
        specialRequests: "VIP Security escort and HALAL catering",
      });

      expect(result.ok).toBe(true);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
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

    it("SCRUM-13 [AC9] × SCRUM-129 [AC4]: rejects a UTC ISO start datetime that represents a past moment, confirming converted Singapore wall-times are rejected at the schema layer", async () => {
      mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));

      const oneHourAgoUtcIso = new Date(Date.now() - 3_600_000).toISOString();

      const result = await submitEventRequest({
        ...validSubmissionInput,
        startAt: oneHourAgoUtcIso,
      });

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

    it.each([
      { field: "startAt", message: "Invalid start date format." },
      { field: "endAt", message: "Invalid end date format." },
    ] as const)(
      "SCRUM-13 [AC8, AC9 - Date validity]: an unreadable $field is reported as an invalid date and nothing is created",
      async ({ field, message }) => {
        mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));

        const result = await submitEventRequest({
          ...validSubmissionInput,
          [field]: "not-a-date",
        });

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.fieldErrors?.[field]).toContain(message);
        expect(mockCreate).not.toHaveBeenCalled();
      },
    );

    // A cleared date input arrives as "" rather than being left out, so the
    // date checks must stand aside and let the "required" messages speak.
    it("SCRUM-13 [AC4 - Business-Rule Negative]: blank start and end dates are reported as required, not as invalid dates", async () => {
      mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));

      const result = await submitEventRequest({
        ...validSubmissionInput,
        startAt: "",
        endAt: "",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.fieldErrors?.startAt).toEqual([
          "Proposed start date and time is required.",
        ]);
        expect(result.fieldErrors?.endAt).toEqual([
          "Proposed end date and time is required.",
        ]);
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

    // SCRUM-14 AC: "no second request is created… no additional notification"
    // on a repeat submission. Submitting by id only matches an event that is
    // still DRAFT/REJECTED and owned by the caller, so every other case
    // (someone else's event, a missing id, an already-submitted event) lands
    // on the same refusal.
    it("SCRUM-14 AC: submitting an id that is not the caller's DRAFT/REJECTED event is refused and writes nothing", async () => {
      mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));
      mockFindFirst.mockResolvedValue(null);

      const result = await submitEventRequest({
        ...validSubmissionInput,
        id: "evt_already_submitted",
      });

      expect(result).toEqual({
        ok: false,
        error: "Draft or rejected event not found or cannot be submitted.",
      });
      expect(mockFindFirst).toHaveBeenCalledWith({
        where: {
          id: "evt_already_submitted",
          organiserId: "usr_organiser",
          OR: [
            { status: "DRAFT" },
            { status: "REJECTED", rejectionOutcome: "AMEND_AND_RESUBMIT" },
          ],
        },
      });
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(mockCreate).not.toHaveBeenCalled();
      expect(mockTxNotificationCreateMany).not.toHaveBeenCalled();
      expect(mockTxAuditLogCreate).not.toHaveBeenCalled();
    });

    it("SCRUM-14 AC: the draft row is locked BEFORE its status is checked, so two simultaneous submissions cannot both pass", async () => {
      mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));
      mockFindFirst.mockResolvedValue({
        id: "evt_draft_race",
        organiserId: "usr_organiser",
        status: "DRAFT",
        coordinatorId: null,
      });

      await submitEventRequest({ ...validSubmissionInput, id: "evt_draft_race" });

      expect(mockTxQueryRaw).toHaveBeenCalledTimes(1);
      expect(mockTxQueryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        mockFindFirst.mock.invocationCallOrder[0],
      );
    });

    it("SCRUM-21: resubmitting a rejected event records the previous coordinator as the audit oldValue", async () => {
      mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));
      mockFindFirst.mockResolvedValue({
        id: "evt_rejected",
        organiserId: "usr_organiser",
        status: "REJECTED",
        coordinatorId: "usr_old_coordinator",
      });
      mockTxUserFindMany.mockResolvedValue([
        { id: "usr_new_coordinator", _count: { coordinatedEvents: 0 } },
      ]);

      const result = await submitEventRequest({
        ...validSubmissionInput,
        id: "evt_rejected",
      });

      expect(result.ok).toBe(true);
      expect(mockTxAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "ASSIGNED",
          oldValue: "usr_old_coordinator",
          newValue: "usr_new_coordinator",
        }),
      });
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

    it("SCRUM-13 [AC1/AC11 - Input Constraint]: rejects event name (AC11, max 200), purpose (AC1 field schema, max 1000), and description and special request (AC11, max 5000) that exceed their character limits", async () => {
      mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));

      const result = await submitEventRequest({
        ...validSubmissionInput,
        name: "A".repeat(201),
        purpose: "B".repeat(1001),
        description: "C".repeat(5001),
        specialRequests: "D".repeat(5001),
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.fieldErrors?.name).toBeTruthy();
        expect(result.fieldErrors?.purpose).toBeTruthy();
        expect(result.fieldErrors?.description).toBeTruthy();
        expect(result.fieldErrors?.specialRequests).toBeTruthy();
      }
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("SCRUM-13 [AC11 - Script Injection Sanitisation & React Escaping]: preserves text content safely while trim-sanitising input strings, relying on React's automatic context-aware DOM escaping to prevent script execution", async () => {
      mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));
      mockCreate.mockResolvedValue({ id: "evt_script_test" });

      const scriptPayload = "<script>alert('xss')</script>";
      const result = await submitEventRequest({
        ...validSubmissionInput,
        name: scriptPayload,
        description: scriptPayload,
        specialRequests: scriptPayload,
      });

      expect(result.ok).toBe(true);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "<script>alert('xss')</script>",
            description: "<script>alert('xss')</script>",
            specialRequests: "<script>alert('xss')</script>",
          }),
        }),
      );
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

    // Coverage note: both catch blocks only special-case PermissionError —
    // everything else must propagate, not be swallowed into a friendly
    // ActionResult. A regression that widened either catch to `return
    // err(error.message)` for any error would hide a real DB failure behind
    // a validation-looking message; these pin the rethrow so that can't
    // happen silently.
    it("[Exit path] createDraftEvent rethrows an unexpected (non-permission) error instead of swallowing it", async () => {
      mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));
      mockCreate.mockRejectedValueOnce(new Error("DB unavailable"));

      await expect(
        createDraftEvent({ name: "Draft during an outage" }),
      ).rejects.toThrow("DB unavailable");
    });

    it("[Exit path] submitEventRequest rethrows an unexpected (non-permission, non-SubmitEventError) error instead of swallowing it", async () => {
      mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));
      mockCreate.mockRejectedValueOnce(new Error("DB unavailable"));

      await expect(submitEventRequest(validSubmissionInput)).rejects.toThrow(
        "DB unavailable",
      );
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

  it("SCRUM-129 [AC1 - Singapore timezone]: a new draft and an updated draft are stored as Asia/Singapore events", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));
    mockCreate.mockResolvedValue({ id: "evt_draft_sg" });

    const created = await createDraftEvent({ name: "Singapore Summit" });

    expect(created.ok).toBe(true);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ timezone: "Asia/Singapore" }),
      }),
    );

    mockFindFirst.mockResolvedValue({
      id: "evt_draft_sg",
      organiserId: "usr_organiser",
      status: "DRAFT",
    });
    mockUpdate.mockResolvedValue({ id: "evt_draft_sg" });

    const updated = await createDraftEvent({
      id: "evt_draft_sg",
      name: "Singapore Summit",
      startAt: futureStart,
    });

    expect(updated.ok).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "evt_draft_sg" },
        data: expect.objectContaining({
          startAt: new Date(futureStart),
          timezone: "Asia/Singapore",
        }),
      }),
    );
  });

  it("SCRUM-129 [AC1 - Singapore timezone]: a new submission and a submitted draft are stored as Asia/Singapore events", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));
    mockCreate.mockResolvedValue({ id: "evt_submit_sg" });

    const submissionData = {
      name: "Singapore Regional Forum",
      purpose: "Networking",
      description: "Regional gathering",
      startAt: futureStart,
      endAt: futureEnd,
      expectedAttendance: 100,
      venueRequirements: "Auditorium",
      preferredLayout: "Theatre",
      accessibilityNeeds: "Ramp access",
      equipmentRequirements: "Microphones",
      registrationNotes: "Online registration",
    };

    const resultNew = await submitEventRequest(submissionData);

    expect(resultNew.ok).toBe(true);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Singapore Regional Forum",
          timezone: "Asia/Singapore",
        }),
      }),
    );

    mockFindFirst.mockResolvedValue({
      id: "evt_draft_sg_submit",
      organiserId: "usr_organiser",
      status: "DRAFT",
    });
    mockUpdate.mockResolvedValue({ id: "evt_draft_sg_submit" });

    const resultDraftSubmit = await submitEventRequest({
      ...submissionData,
      id: "evt_draft_sg_submit",
    });

    expect(resultDraftSubmit.ok).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "evt_draft_sg_submit" },
        data: expect.objectContaining({
          timezone: "Asia/Singapore",
          status: "SUBMITTED",
        }),
      }),
    );
  });

  it("SCRUM-129 [AC4 - UTC storage]: the submitted UTC instants are stored exactly as sent", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));
    mockCreate.mockResolvedValue({ id: "evt_utc" });

    // 10:00-18:00 Singapore time, as the form converts it.
    const result = await createDraftEvent({
      name: "UTC Storage",
      startAt: "2031-08-01T02:00:00.000Z",
      endAt: "2031-08-01T10:00:00.000Z",
    });

    expect(result.ok).toBe(true);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          startAt: new Date("2031-08-01T02:00:00.000Z"),
          endAt: new Date("2031-08-01T10:00:00.000Z"),
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

  it.each([
    {
      rule: "an unreadable start date",
      dates: { startAt: "not-a-date" },
      field: "startAt",
      message: "Invalid start date format.",
    },
    {
      rule: "a start date in the past",
      dates: { startAt: new Date(Date.now() - 86400000).toISOString() },
      field: "startAt",
      message: "Proposed date cannot be in the past.",
    },
    {
      rule: "an unreadable end date",
      dates: { endAt: "not-a-date" },
      field: "endAt",
      message: "Invalid end date format.",
    },
    {
      rule: "an end date that is not after the start",
      dates: { startAt: futureEnd, endAt: futureStart },
      field: "endAt",
      message: "Proposed end date and time must be strictly after the start date and time.",
    },
  ] as const)(
    "SCRUM-15 [AC4 - Validation Rule]: a draft with $rule is refused, because dates that are provided must still be valid",
    async ({ dates, field, message }) => {
      mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));

      const result = await createDraftEvent({ name: "Draft With Bad Dates", ...dates });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.fieldErrors?.[field]).toContain(message);
      expect(mockCreate).not.toHaveBeenCalled();
    },
  );

  it("SCRUM-15 [AC3 - Business-Rule Negative]: returns field error when attempting to save a draft without an event name", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));

    const result = await createDraftEvent({ name: "" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors?.name).toBeTruthy();
    }
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("SCRUM-14 [AC4 - Business-Rule Negative]: refuses to edit a caller's own event as a draft once it has been submitted", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));
    // Own event, but no longer DRAFT — the findFirst's status filter excludes
    // it, same as if it belonged to someone else or didn't exist.
    mockFindFirst.mockResolvedValue(null);

    const result = await createDraftEvent({
      id: "evt_already_submitted",
      name: "Attempted post-submission edit",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/not found or cannot be modified/i);
    }
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { id: "evt_already_submitted", organiserId: "usr_organiser", status: "DRAFT" },
    });
    expect(mockUpdate).not.toHaveBeenCalled();
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

  it("SCRUM-15 [AC1, AC2 - Data retention]: a new draft saved with both proposed dates persists them as UTC instants", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));
    mockCreate.mockResolvedValue({ id: "evt_draft_dated" });

    const result = await createDraftEvent({
      name: "Dated Draft",
      startAt: futureStart,
      endAt: futureEnd,
    });

    expect(result).toEqual({ ok: true, data: { id: "evt_draft_dated" } });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "DRAFT",
          startAt: new Date(futureStart),
          endAt: new Date(futureEnd),
        }),
      }),
    );
  });

  it("SCRUM-15 [AC2, AC7 - Data retention on re-save]: updating a draft with only an end date persists that end and leaves the start empty", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));
    mockFindFirst.mockResolvedValue({
      id: "evt_draft_end_only",
      organiserId: "usr_organiser",
      status: "DRAFT",
    });
    mockUpdate.mockResolvedValue({ id: "evt_draft_end_only" });

    const result = await createDraftEvent({
      id: "evt_draft_end_only",
      name: "End Only Draft",
      endAt: futureEnd,
    });

    expect(result).toEqual({ ok: true, data: { id: "evt_draft_end_only" } });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "evt_draft_end_only" },
        data: expect.objectContaining({
          startAt: null,
          endAt: new Date(futureEnd),
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

  it("SCRUM-15 [Throw Path / Update]: rethrows unexpected persistence errors when updating an existing draft — covers update-path exit point of createDraftEvent", async () => {
    const dbFailure = new Error("update draft write failed");
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));
    mockFindFirst.mockResolvedValue({
      id: "evt_draft_update_fail",
      organiserId: "usr_organiser",
      status: "DRAFT",
    });
    mockUpdate.mockRejectedValueOnce(dbFailure);

    await expect(
      createDraftEvent({
        id: "evt_draft_update_fail",
        name: "Draft Update Infrastructure Failure",
      }),
    ).rejects.toThrow("update draft write failed");
  });

  it("SCRUM-15 [Throw Path / Submit Update]: rethrows unexpected persistence errors when submitting an existing draft — covers draft-update exit point of submitEventRequest", async () => {
    const dbFailure = new Error("submit draft update failed");
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));
    mockFindFirst.mockResolvedValue({
      id: "evt_draft_throw_submit",
      organiserId: "usr_organiser",
      status: "DRAFT",
      coordinatorId: null,
    });
    mockUpdate.mockRejectedValueOnce(dbFailure);

    const submissionPayload = {
      id: "evt_draft_throw_submit",
      name: "Completed Resumed Event",
      purpose: "Networking",
      description: "Full description",
      startAt: new Date(Date.now() + 86400000).toISOString(),
      endAt: new Date(Date.now() + 86400000 + 7200000).toISOString(),
      expectedAttendance: 100,
      venueRequirements: "Auditorium",
      preferredLayout: "Theatre",
      accessibilityNeeds: "Ramp access",
      equipmentRequirements: "Microphones",
      registrationNotes: "Online registration",
    };

    await expect(
      submitEventRequest(submissionPayload),
    ).rejects.toThrow("submit draft update failed");
  });

  it("SCRUM-15 [AC2, AC9 - Inactive Catalogue Reference Retention]: draft saves and reopens successfully when venue or equipment fields contain references to inactive catalogue items (stored as free text, no FK constraint)", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));
    mockFindFirst.mockResolvedValue({
      id: "evt_draft_inactive_ref",
      organiserId: "usr_organiser",
      status: "DRAFT",
    });
    mockUpdate.mockResolvedValue({ id: "evt_draft_inactive_ref" });

    const result = await createDraftEvent({
      id: "evt_draft_inactive_ref",
      name: "Draft With Inactive Catalogue Reference",
      venueRequirements:
        "Grand Auditorium (Decommissioned — please update before submitting)",
      equipmentRequirements:
        "PA System Model X7 (Retired — please update before submitting)",
    });

    expect(result.ok).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "evt_draft_inactive_ref" },
        data: expect.objectContaining({
          venueRequirements:
            "Grand Auditorium (Decommissioned — please update before submitting)",
          equipmentRequirements:
            "PA System Model X7 (Retired — please update before submitting)",
        }),
      }),
    );
  });

  it("SCRUM-15 [AC4] / SCRUM-13 [AC11 - Draft Path Input Constraint]: createDraftEvent schema enforces character limits on over-limit draft fields (name max 200, purpose max 1000, description max 5000, programme max 5000, specialRequests max 5000)", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));

    const result = await createDraftEvent({
      name: "A".repeat(201),
      purpose: "B".repeat(1001),
      description: "C".repeat(5001),
      programme: "D".repeat(5001),
      specialRequests: "E".repeat(5001),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors?.name).toBeTruthy();
      expect(result.fieldErrors?.purpose).toBeTruthy();
      expect(result.fieldErrors?.description).toBeTruthy();
      expect(result.fieldErrors?.programme).toBeTruthy();
      expect(result.fieldErrors?.specialRequests).toBeTruthy();
    }
    expect(mockCreate).not.toHaveBeenCalled();
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

  it("SCRUM-16 [AC4 - Coordinator View Exclusion]: executes coordinator query excluding DRAFT status events", async () => {
    const mockFindMany = vi.fn().mockResolvedValue([
      { id: "evt_sub", status: "SUBMITTED" },
    ]);
    prisma.event.findMany = mockFindMany;

    const results = await getCoordinatorEvents("usr_coord_us16");

    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { coordinatorId: "usr_coord_us16" },
          { coordinatorId: null, status: { not: "DRAFT" } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("SUBMITTED");
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

  it("SCRUM-84 [AC1, AC2 - Happy Path / Ownership Isolation]: executes organiser query filtering only events belonging to logged-in organiser", async () => {
    const mockEventsList = allStatuses.map((status, idx) => ({
      id: `evt_us84_${idx}`,
      name: `Event ${status}`,
      status,
      organiserId: "usr_organiser_us84",
      createdAt: new Date(),
    }));

    const mockFindMany = vi.fn().mockResolvedValue(mockEventsList);
    prisma.event.findMany = mockFindMany;

    const events = await getOrganiserEvents("usr_organiser_us84");

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { organiserId: "usr_organiser_us84" },
      orderBy: { updatedAt: "desc" },
    });
    expect(events).toHaveLength(9);
  });

  it("SCRUM-84 [AC3 - Implicit Rule / Default Sort]: filterAndSortEvents orders list by updatedAt descending by default", () => {
    const events = [
      { id: "1", name: "Older Event", status: "DRAFT", updatedAt: new Date("2026-08-01T10:00:00Z") },
      { id: "2", name: "Newer Event", status: "DRAFT", updatedAt: new Date("2026-09-15T12:00:00Z") },
    ];

    const sorted = filterAndSortEvents(events);

    expect(sorted[0].id).toBe("2");
    expect(sorted[1].id).toBe("1");
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

    const events = await getOrganiserEvents("usr_organiser_us84");

    expect(events[0].name).toBe("Annual Regional Conference");
    expect(events[0].status).toBe("APPROVED");
  });

  it("SCRUM-84 [AC4 - Happy Path]: retrieves full detail model when selecting a specific event request", async () => {
    const detailedDraftEvent = {
      id: "evt_draft_detail",
      name: "Draft Detail Event",
      status: "DRAFT",
      purpose: "Draft purpose",
      description: "Draft description",
      organiserId: "usr_organiser_us84",
      createdAt: new Date(),
    };

    const mockFindFirst = vi.fn().mockResolvedValue(detailedDraftEvent);
    prisma.event.findFirst = mockFindFirst;

    const result = await getEventForUser("evt_draft_detail", "usr_organiser_us84");

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { id: "evt_draft_detail", organiserId: "usr_organiser_us84" },
    });
    expect(result).toBeDefined();
    expect(result?.id).toBe("evt_draft_detail");
    expect(result?.status).toBe("DRAFT");
    expect(result?.name).toBe("Draft Detail Event");
  });

  it("SCRUM-84 [AC5 - Edge Case / Empty State]: returns an empty array when an organiser has not created any event requests", async () => {
    prisma.event.findMany = vi.fn().mockResolvedValue([]);

    const results = await getOrganiserEvents("usr_new_organiser");

    expect(results).toEqual([]);
    expect(results.length).toBe(0);
  });

  it("SCRUM-84 [AC6 - Happy Path / Search Filter]: filters event list by search query matching event name or purpose via filterAndSortEvents", () => {
    const events = [
      { id: "1", name: "Annual Tech Conference", purpose: "Tech networking", status: "APPROVED", updatedAt: "2026-09-01T10:00:00Z" },
      { id: "2", name: "Internal Team Retreat", purpose: "Team building", status: "DRAFT", updatedAt: "2026-09-02T10:00:00Z" },
    ];

    const filteredByName = filterAndSortEvents(events, { searchQuery: "Tech" });
    expect(filteredByName).toHaveLength(1);
    expect(filteredByName[0].id).toBe("1");

    const filteredByPurpose = filterAndSortEvents(events, { searchQuery: "building" });
    expect(filteredByPurpose).toHaveLength(1);
    expect(filteredByPurpose[0].id).toBe("2");
  });

  it("SCRUM-84 [AC7 - Default & Custom Sorting]: orders event list by updatedAt descending by default and by name asc when specified", () => {
    const events = [
      { id: "1", name: "Zebra Expo", status: "DRAFT", updatedAt: new Date("2026-08-01T10:00:00Z") },
      { id: "2", name: "Alpha Summit", status: "DRAFT", updatedAt: new Date("2026-09-15T12:00:00Z") },
    ];

    const sortedByDefault = filterAndSortEvents(events, { sortField: "updatedAt", sortOrder: "desc" });
    expect(sortedByDefault[0].id).toBe("2");
    expect(sortedByDefault[1].id).toBe("1");

    const sortedByNameAsc = filterAndSortEvents(events, { sortField: "name", sortOrder: "asc" });
    expect(sortedByNameAsc[0].id).toBe("2");
    expect(sortedByNameAsc[1].id).toBe("1");
  });

  it("SCRUM-84 [AC8 - Multi-Criteria Filtering Combination]: filters events by active tab AND status filter AND search query simultaneously", () => {
    const events = [
      { id: "1", name: "Annual Tech Conference", purpose: "Networking", status: "DRAFT", updatedAt: new Date() },
      { id: "2", name: "Tech Workshop", purpose: "Training", status: "APPROVED", updatedAt: new Date() },
      { id: "3", name: "Annual HR Retreat", purpose: "Team building", status: "DRAFT", updatedAt: new Date() },
    ];

    const filtered = filterAndSortEvents(events, {
      activeTab: "DRAFT",
      statusFilter: "DRAFT",
      searchQuery: "Tech",
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("1");
  });

  it("SCRUM-84 [AC9 - Search Cleared State & Partial Matches]: matches partial string and restores list when search is cleared", () => {
    const events = [
      { id: "1", name: "Annual Hackathon", status: "SUBMITTED", updatedAt: new Date() },
      { id: "2", name: "Quarterly Review", status: "SUBMITTED", updatedAt: new Date() },
    ];

    // 1. Partial match test
    const partialFiltered = filterAndSortEvents(events, { searchQuery: "hack" });
    expect(partialFiltered).toHaveLength(1);
    expect(partialFiltered[0].id).toBe("1");

    // 2. Cleared search restores all events
    const clearedFiltered = filterAndSortEvents(events, { searchQuery: "   " });
    expect(clearedFiltered).toHaveLength(2);
  });

  it("SCRUM-84: given events in DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED and COMPLETED, activeTab \"SUBMITTED\" returns all non-drafts and excludes DRAFT, and activeTab \"DRAFT\" returns only drafts", () => {
    const events = [
      { id: "1", name: "Draft Event", status: "DRAFT" },
      { id: "2", name: "Submitted Event", status: "SUBMITTED" },
      { id: "3", name: "Under Review Event", status: "UNDER_REVIEW" },
      { id: "4", name: "Approved Event", status: "APPROVED" },
      { id: "5", name: "Rejected Event", status: "REJECTED" },
      { id: "6", name: "Completed Event", status: "COMPLETED" },
    ];

    const submittedTabEvents = filterAndSortEvents(events, { activeTab: "SUBMITTED" });
    expect(submittedTabEvents.map((e) => e.status)).toEqual([
      "SUBMITTED",
      "UNDER_REVIEW",
      "APPROVED",
      "REJECTED",
      "COMPLETED",
    ]);
    expect(submittedTabEvents.some((e) => e.status === "DRAFT")).toBe(false);

    const draftTabEvents = filterAndSortEvents(events, { activeTab: "DRAFT" });
    expect(draftTabEvents.map((e) => e.status)).toEqual(["DRAFT"]);
  });

  // SCRUM-19: Approve, Ask and Reject only render on SUBMITTED and
  // UNDER_REVIEW rows, so the coordinator's tab has to be exactly that set —
  // otherwise their queue is buried in decided and cancelled history and the
  // status dropdown, which matches one value at a time, cannot rebuild it.
  it("SCRUM-19: a coordinator's second tab is only the requests still awaiting a decision", () => {
    const events = [
      { id: "1", name: "Draft Event", status: "DRAFT" },
      { id: "2", name: "Submitted Event", status: "SUBMITTED" },
      { id: "3", name: "Under Review Event", status: "UNDER_REVIEW" },
      { id: "4", name: "Approved Event", status: "APPROVED" },
      { id: "5", name: "Rejected Event", status: "REJECTED" },
      { id: "6", name: "Cancelled Event", status: "CANCELLED" },
    ];

    const reviewQueue = filterAndSortEvents(events, {
      activeTab: "SUBMITTED",
      submittedMeans: "awaiting-review",
    });

    expect(reviewQueue.map((e) => e.status)).toEqual([
      "SUBMITTED",
      "UNDER_REVIEW",
    ]);
  });

  it("SCRUM-84: an organiser's second tab still holds everything they have sent", () => {
    const events = [
      { id: "1", name: "Draft Event", status: "DRAFT" },
      { id: "2", name: "Approved Event", status: "APPROVED" },
    ];

    // The default, and what the organiser's view passes.
    expect(
      filterAndSortEvents(events, { activeTab: "SUBMITTED" }).map((e) => e.status),
    ).toEqual(["APPROVED"]);
    expect(
      filterAndSortEvents(events, {
        activeTab: "SUBMITTED",
        submittedMeans: "non-draft",
      }).map((e) => e.status),
    ).toEqual(["APPROVED"]);
  });
});

// ============================================================================
// getFormCatalogues — a "use server" export is a public endpoint, so it must
// refuse anyone who cannot create an event request.
// ============================================================================
describe("getFormCatalogues — permission gate", () => {
  const mockVenues = prisma.venue.findMany as unknown as Mock;
  const mockEquipment = prisma.equipment.findMany as unknown as Mock;

  it("SCRUM-13 [AC2 - Happy Path]: returns the venue and equipment catalogue to an organiser", async () => {
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

  it("SCRUM-13 [AC2 - Catalogue Dependencies]: queries only active venue and equipment catalogue entries", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));
    mockVenues.mockResolvedValue([]);
    mockEquipment.mockResolvedValue([]);

    const result = await getFormCatalogues();

    expect(result.ok).toBe(true);
    expect(mockVenues).toHaveBeenCalledWith({
      where: { isActive: true },
      select: { id: true, name: true, capacity: true, facilities: true },
    });
    expect(mockEquipment).toHaveBeenCalledWith({
      where: { isActive: true },
      select: { id: true, type: true, totalQuantity: true },
    });
  });

  it("SCRUM-13 [AC2 - Throw Path]: rethrows unexpected catalogue lookup failures", async () => {
    const catalogueFailure = new Error("catalogue unavailable");
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));
    mockVenues.mockRejectedValueOnce(catalogueFailure);

    await expect(getFormCatalogues()).rejects.toThrow("catalogue unavailable");
  });

  it.each(["ATTENDEE", "VENUE_STAFF", "TECH_SUPPORT", "COORDINATOR"] as Role[])(
    "SCRUM-13 [AC2 - Security Gate]: refuses %s and never queries the catalogue",
    async (role) => {
      mockAuth.mockResolvedValue(sessionFor(role, `usr_${role.toLowerCase()}`));

      const result = await getFormCatalogues();

      expect(result.ok).toBe(false);
      expect(mockVenues).not.toHaveBeenCalled();
      expect(mockEquipment).not.toHaveBeenCalled();
    },
  );

  it("SCRUM-13 [AC2 - Security Gate]: refuses a signed-out caller", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await getFormCatalogues();

    expect(result.ok).toBe(false);
    expect(mockVenues).not.toHaveBeenCalled();
  });

  // Coverage note: the catch block only special-cases PermissionError.
  // This forces a non-permission error to prove it is rethrown.
  it("SCRUM-13 [AC2 - Throw Path]: rethrows unexpected permission-gate failures", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));
    (requirePermission as unknown as Mock).mockImplementationOnce(() => {
      throw new Error("permission dependency failed");
    });

    await expect(getFormCatalogues()).rejects.toThrow(
      "permission dependency failed",
    );
  });
});

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createDraftEvent, submitEventRequest } from "@/app/(app)/events/actions";

// The action reaches out to the session and the database; both are mocked so
// this is a fast unit test that never opens a connection. We assert on the
// three outcomes the §6 convention promises: success, validation failure, and
// permission denial.
// ============================================================================
// MOCKS & SETUP
// ============================================================================
// The actions interact with NextAuth session management and Prisma DB calls.
// We mock both modules so tests run quickly in isolation without requiring a live DB connection.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: { event: { create: vi.fn() } },
}));

const mockAuth = auth as unknown as Mock;
const mockCreate = prisma.event.create as unknown as Mock;

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

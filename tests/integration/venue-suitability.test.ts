import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  type Mock,
} from "vitest";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { parseSingaporeDateTime } from "@/lib/datetime";
import { recordSuitabilityJudgement } from "@/app/(app)/venues/suitability-actions";
import { submitBookingRequest } from "@/app/(app)/bookings/actions";
import {
  getPendingBookingQueue,
  getSuitabilityJudgements,
} from "@/app/(app)/bookings/queries";
import { createPlanningEvents, removeEvents } from "./test-events";

// SCRUM-40 against a real, seeded Postgres: one judgement per event and
// venue, the database's own note check, the judgement never blocking a
// request (AC9), and Venue Staff seeing it on the request (AC10). Only the
// session is mocked. These WRITE, so they only run against a localhost
// database.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
const mockAuth = auth as unknown as Mock;

const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

const COORDINATOR: Session = {
  user: {
    id: "usr_coordinator",
    role: "COORDINATOR",
    name: "Cody",
    email: "coordinator@test.local",
  },
  expires: "2999-01-01T00:00:00.000Z",
};

const sg = (wall: string) => parseSingaporeDateTime(wall)!;
// A Tuesday, inside the Exhibition Hall's daily 06:00–22:00 hours.
const START = sg("2036-05-06T10:00");
const END = sg("2036-05-06T12:00");
const HALL = "ven_hall";

describe.skipIf(!usesLocalDatabase)(
  "venue suitability — real database (SCRUM-40)",
  () => {
    let eventId: string;

    beforeAll(async () => {
      [eventId] = await createPlanningEvents("SCRUM-40", [
        { startAt: START, endAt: END, expectedAttendance: 150 },
      ]);
      mockAuth.mockResolvedValue(COORDINATOR);
    });

    afterAll(async () => {
      await prisma.auditLog.deleteMany({
        where: { entityType: "VenueSuitabilityJudgement", actorId: "usr_coordinator", summary: { startsWith: "SCRUM-40" } },
      });
      await prisma.venueSuitabilityJudgement.deleteMany({ where: { eventId } });
      await removeEvents([eventId]);
    });

    it("SCRUM-40 [AC8] TC-40-08: recording again replaces the judgement: one per event and venue", async () => {
      await recordSuitabilityJudgement({
        eventId,
        venueId: HALL,
        suitable: false,
        note: "SCRUM-40 first look: loading bay noise.",
      });
      await recordSuitabilityJudgement({
        eventId,
        venueId: HALL,
        suitable: true,
        note: "SCRUM-40 checked: the bay is closed that day.",
      });

      const rows = await getSuitabilityJudgements([eventId]);
      expect(rows).toEqual([
        {
          eventId,
          venueId: HALL,
          suitable: true,
          note: "SCRUM-40 checked: the bay is closed that day.",
          recordedAt: expect.any(Date),
          recordedByName: expect.any(String),
        },
      ]);
    });

    it("SCRUM-40 [AC8] TC-40-09: the database refuses a judgement with a blank note", async () => {
      await expect(
        prisma.venueSuitabilityJudgement.upsert({
          where: { eventId_venueId: { eventId, venueId: HALL } },
          update: { note: "   " },
          create: {
            eventId,
            venueId: HALL,
            suitable: true,
            note: "   ",
            recordedById: "usr_coordinator",
          },
        }),
      ).rejects.toThrow(/venue_suitability_note_required/);
    });

    it("SCRUM-40 [AC9, AC10] TC-40-10, TC-40-11: a Not suitable judgement doesn't stop the request, which keeps its accessibility needs, and Venue Staff see the judgement on it", async () => {
      await recordSuitabilityJudgement({
        eventId,
        venueId: HALL,
        suitable: false,
        note: "SCRUM-40 not ideal, but the only free room.",
      });

      const result = await submitBookingRequest({
        eventId,
        venueId: HALL,
        startAt: START.toISOString(),
        endAt: END.toISOString(),
        requestedAttendance: 150,
        requiredFacilities: ["projector"],
        requiredAccessibilityFeatures: ["hearing-loop"],
      });

      expect(result.ok).toBe(true);
      const booking = await prisma.booking.findFirstOrThrow({
        where: { eventId, venueId: HALL },
        select: { id: true, requiredAccessibilityFeatures: true },
      });
      expect(booking.requiredAccessibilityFeatures).toEqual(["hearing-loop"]);

      const queued = (await getPendingBookingQueue()).find(
        (row) => row.id === booking.id,
      );
      expect(queued?.judgement).toMatchObject({
        suitable: false,
        note: "SCRUM-40 not ideal, but the only free room.",
      });
    });

    it("SCRUM-40 [AC9] TC-40-10: whatever the judgement says, attendance over the venue's capacity is still refused", async () => {
      const [bigEvent] = await createPlanningEvents("SCRUM-40 big", [
        { startAt: START, endAt: END, expectedAttendance: 300 },
      ]);
      try {
        await recordSuitabilityJudgement({
          eventId: bigEvent,
          venueId: HALL,
          suitable: true,
          note: "SCRUM-40 we will run two sessions.",
        });

        const result = await submitBookingRequest({
          eventId: bigEvent,
          venueId: HALL,
          startAt: START.toISOString(),
          endAt: END.toISOString(),
          requestedAttendance: 300,
        });

        expect(result).toMatchObject({
          ok: false,
          error: "Exhibition Hall holds up to 200 people; 300 expected is over its capacity.",
        });
        expect(await prisma.booking.count({ where: { eventId: bigEvent } })).toBe(0);
      } finally {
        await prisma.venueSuitabilityJudgement.deleteMany({
          where: { eventId: bigEvent },
        });
        await removeEvents([bigEvent]);
      }
    });
  },
);

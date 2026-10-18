import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterEach,
  afterAll,
  type Mock,
} from "vitest";
import type { Session } from "next-auth";
import type { EventStatus, Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  confirmEvent,
  rejectPlanningEvent,
  transitionEventStatus,
} from "@/app/(app)/events/actions";
import { requestClarification } from "@/app/(app)/events/clarification-actions";
import {
  registerForEvent,
  withdrawRegistration,
} from "@/app/(app)/events/registration-actions";

// SCRUM-45 against a real, seeded Postgres: which notices each workflow step
// writes, to whom, and that repeating a step writes none. Only the session is
// mocked. Each test makes its own event, assigned to the second seeded
// Coordinator, and the suite removes them, so it only runs on a localhost
// database. The submission notice (AC1) is in
// tests/unit/submission-queue.test.ts, and its count against a real
// database in tests/integration/concurrency.test.ts.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
const mockAuth = auth as unknown as Mock;

const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

const signIn = (id: string, role: Role) =>
  mockAuth.mockResolvedValue({
    user: { id, role, name: id, email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  } satisfies Session);
const ORGANISER = "usr_organiser";
const COORDINATOR = "usr_coordinator_2";
const STAMP = Date.now();
const DAY = 24 * 60 * 60 * 1000;

describe.skipIf(!usesLocalDatabase)(
  "workflow notifications — real database (SCRUM-45)",
  () => {
    const eventIds: string[] = [];
    let venueId: string;

    async function event(
      label: string,
      status: EventStatus,
      extra: Record<string, unknown> = {},
    ) {
      const startAt = new Date(Date.now() + 30 * DAY);
      const row = await prisma.event.create({
        data: {
          name: `SCRUM-45 ${label} ${STAMP}`,
          status,
          organiserId: ORGANISER,
          coordinatorId: COORDINATOR,
          startAt,
          endAt: new Date(startAt.getTime() + 4 * 60 * 60 * 1000),
          expectedAttendance: 40,
          submittedAt: new Date(),
          ...extra,
        },
        select: { id: true, name: true, startAt: true, endAt: true },
      });
      eventIds.push(row.id);
      return row;
    }
    const notices = (eventId: string) =>
      prisma.notification.findMany({
        where: { eventId },
        select: {
          userId: true,
          type: true,
          title: true,
          message: true,
          showFromAt: true,
        },
        orderBy: [{ showFromAt: "asc" }, { userId: "asc" }],
      });

    beforeAll(async () => {
      venueId = (
        await prisma.venue.create({
          data: {
            name: `SCRUM-45 venue ${STAMP}`,
            location: "Test block",
            capacity: 500,
          },
        })
      ).id;
    });

    afterEach(() => mockAuth.mockReset());

    afterAll(async () => {
      await prisma.notification.deleteMany({
        where: { eventId: { in: eventIds } },
      });
      await prisma.registration.deleteMany({
        where: { eventId: { in: eventIds } },
      });
      await prisma.clarificationRequest.deleteMany({
        where: { eventId: { in: eventIds } },
      });
      const bookings = await prisma.booking.findMany({
        where: { eventId: { in: eventIds } },
        select: { id: true },
      });
      await prisma.auditLog.deleteMany({
        where: {
          entityId: { in: [...eventIds, ...bookings.map((b) => b.id)] },
        },
      });
      await prisma.booking.deleteMany({ where: { eventId: { in: eventIds } } });
      await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
      await prisma.venue.delete({ where: { id: venueId } });
    });

    it("SCRUM-45 [AC2, AC12, AC13] TC-45-02: approving a request tells its Organiser once, naming the event", async () => {
      const request = await event("Approve", "UNDER_REVIEW");
      signIn(COORDINATOR, "COORDINATOR");
      const approve = () =>
        transitionEventStatus({ eventId: request.id, nextStatus: "APPROVED" });

      expect((await approve()).ok).toBe(true);
      expect((await approve()).ok).toBe(false);

      expect(await notices(request.id)).toEqual([
        expect.objectContaining({
          userId: ORGANISER,
          type: "EVENT_STATUS_CHANGED",
          title: "Your request was approved",
          message: `"${request.name}" was approved and is now being planned.`,
        }),
      ]);
    });

    it("SCRUM-45 [AC3] TC-45-03: rejecting a request tells its Organiser the reason and what they can do next", async () => {
      const request = await event("Reject request", "UNDER_REVIEW");
      signIn(COORDINATOR, "COORDINATOR");

      await transitionEventStatus({
        eventId: request.id,
        nextStatus: "REJECTED",
        decisionReason: "The date clashes with exams.",
        rejectionOutcome: "AMEND_AND_RESUBMIT",
      });

      expect(await notices(request.id)).toEqual([
        expect.objectContaining({
          userId: ORGANISER,
          title: "Your request was rejected",
          message: `"${request.name}" was rejected: The date clashes with exams. What you can do next: Amend and resubmit.`,
        }),
      ]);
    });

    it("SCRUM-45 [AC3] TC-45-03: rejecting a Planning event tells its Organiser the reason and what they can do next", async () => {
      const planning = await event("Reject planning", "PLANNING");
      signIn(COORDINATOR, "COORDINATOR");

      await rejectPlanningEvent({
        eventId: planning.id,
        decisionReason: "No venue can take it.",
        rejectionOutcome: "NEW_REQUEST",
      });

      expect(await notices(planning.id)).toEqual([
        expect.objectContaining({
          userId: ORGANISER,
          title: "Your event was rejected",
          message: `"${planning.name}" couldn't be arranged and was rejected: No venue can take it. What you can do next: Submit as a new request.`,
        }),
      ]);
    });

    it("SCRUM-45 [AC4, AC11, AC13] TC-45-04, TC-45-07: confirming tells the Organiser once, and writes the registration-closed notice to show at the event's start", async () => {
      // SCRUM-170 AC4: no equipment, decided, so the venue makes it ready.
      const ready = await event("Confirm", "PLANNING", {
        noEquipmentNeededAt: new Date(),
        noEquipmentNeededById: COORDINATOR,
      });
      await prisma.booking.create({
        data: {
          eventId: ready.id,
          venueId,
          startAt: ready.startAt!,
          endAt: ready.endAt!,
          status: "APPROVED",
          requestedById: COORDINATOR,
        },
      });
      // SCRUM-166 AC9: confirming needs an approved safety check.
      await prisma.safetyCheck.create({
        data: {
          eventId: ready.id,
          status: "APPROVED",
          requestedById: COORDINATOR,
          decidedById: "usr_safetyofficer",
          decidedAt: new Date(),
        },
      });
      signIn(COORDINATOR, "COORDINATOR");

      expect((await confirmEvent({ eventId: ready.id })).ok).toBe(true);
      expect((await confirmEvent({ eventId: ready.id })).ok).toBe(true);

      const written = await notices(ready.id);
      expect(written.map((n) => [n.userId, n.title])).toEqual([
        [ORGANISER, "Your event is confirmed"],
        [COORDINATOR, "Registration closed"],
        [ORGANISER, "Registration closed"],
      ]);
      expect(written[0].message).toBe(
        `"${ready.name}" is confirmed, and registration is open.`,
      );
      expect(written[1].showFromAt).toEqual(ready.startAt);
      expect(written[2].showFromAt).toEqual(ready.startAt);
    });

    it("SCRUM-45 [AC8, AC14] TC-45-05: a clarification question tells the Organiser what is needed, and writes no status notice", async () => {
      const request = await event("Clarify", "UNDER_REVIEW");
      signIn(COORDINATOR, "COORDINATOR");

      expect(
        (
          await requestClarification({
            eventId: request.id,
            message: "Which room layout do you need?",
          })
        ).ok,
      ).toBe(true);

      expect(await notices(request.id)).toEqual([
        expect.objectContaining({
          userId: ORGANISER,
          type: "CLARIFICATION_REQUESTED",
          message: `Your coordinator has asked a question about "${request.name}": Which room layout do you need?`,
        }),
      ]);
    });

    it("SCRUM-45 [AC11, AC13] TC-45-06: the registration that fills the last place, and a withdrawal from the full event, each tell the Organiser and Coordinator once", async () => {
      const open = await event("Registration", "CONFIRMED", {
        expectedAttendance: 2,
        registrationEnabled: true,
      });
      const register = async (attendee: string) => {
        signIn(attendee, "ATTENDEE");
        const result = await registerForEvent({ eventId: open.id });
        return result.ok ? result.data.id : null;
      };
      const withdraw = (attendee: string, registrationId: string) => {
        signIn(attendee, "ATTENDEE");
        return withdrawRegistration({ registrationId });
      };
      const titles = async () =>
        (await notices(open.id)).map((n) => [n.userId, n.title]);

      const first = await register("usr_attendee");
      expect(await titles()).toEqual([]);

      const second = await register("usr_attendee_2");
      expect(await titles()).toEqual([
        [COORDINATOR, "Registration is full"],
        [ORGANISER, "Registration is full"],
      ]);

      await withdraw("usr_attendee", first!);
      await withdraw("usr_attendee", first!);
      // Now one place is taken of two, so this withdrawal isn't from a full event.
      await withdraw("usr_attendee_2", second!);

      const written = await notices(open.id);
      expect(written.map((n) => [n.userId, n.title])).toEqual([
        [COORDINATOR, "Registration is full"],
        [ORGANISER, "Registration is full"],
        [COORDINATOR, "A place opened at a full event"],
        [ORGANISER, "A place opened at a full event"],
      ]);
      expect(written[0].message).toBe(
        `"${open.name}" has reached its capacity of 2.`,
      );
    });
  },
);

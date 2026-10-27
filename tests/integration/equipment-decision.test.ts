import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterAll,
  type Mock,
} from "vitest";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getReadinessChecklist } from "@/lib/event-readiness";
import { recordNoEquipmentNeeded } from "@/app/(app)/events/equipment-decision-actions";
import { createEquipmentRequest } from "@/app/(app)/equipment-requests/actions";
import { createPlanningEvents, removeEvents } from "./test-events";

// SCRUM-170 AC4 against a real, seeded Postgres: the decision and its audit,
// the checklist that reads it, and the event lock that keeps a decision and an
// equipment request made at the same moment from standing side by side. Only
// the session is mocked. These WRITE (throwaway events, removed afterwards),
// so they only run against a localhost database.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const mockAuth = auth as unknown as Mock;

const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

const COORDINATOR: Session = {
  user: {
    id: "usr_coordinator",
    role: "COORDINATOR",
    name: "Cody Coordinator",
    email: "coordinator@test.local",
  },
  expires: "2999-01-01T00:00:00.000Z",
};

const START = new Date("2036-07-07T02:00:00.000Z");
const END = new Date("2036-07-07T06:00:00.000Z");

const projectors = (eventId: string) => ({
  eventId,
  notes: "",
  lines: [{ equipmentId: "eqp_projector", quantity: 2 }],
});

describe.skipIf(!usesLocalDatabase)(
  "No equipment needed — real database (SCRUM-170 AC4)",
  () => {
    const eventIds: string[] = [];

    async function planningEvent(): Promise<string> {
      const [id] = await createPlanningEvents("SCRUM-170", [
        { startAt: START, endAt: END },
      ]);
      eventIds.push(id);
      return id;
    }

    const decision = (eventId: string) =>
      prisma.event.findUniqueOrThrow({
        where: { id: eventId },
        select: { noEquipmentNeededAt: true, noEquipmentNeededById: true },
      });
    const equipmentItem = async (eventId: string) =>
      (await getReadinessChecklist(prisma, eventId))?.items.find(
        (item) => item.name === "Equipment",
      );

    /**
     * Waits until another session is queued behind the `holder` session's
     * lock. One that never queues, because it no longer takes the event's
     * lock, fails the test rather than slipping past it.
     */
    async function queuedBehind(holder: number) {
      for (let tries = 0; tries < 200; tries++) {
        const [{ queued }] = await prisma.$queryRaw<{ queued: number }[]>`
          SELECT count(*)::int AS queued FROM pg_stat_activity
           WHERE ${holder}::int = ANY(pg_blocking_pids(pid))
        `;
        if (queued > 0) return;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      throw new Error("The request never queued behind the held event row.");
    }

    beforeEach(() => mockAuth.mockResolvedValue(COORDINATOR));

    afterAll(async () => {
      // Equipment requests, with their lines and history, cascade with the event.
      await removeEvents(eventIds);
    });

    it("SCRUM-170 [AC4] TC-170-06, TC-170-07, TC-170-08: Equipment is Not decided until the Coordinator records No equipment needed, which keeps who and when and completes it", async () => {
      const eventId = await planningEvent();
      expect(await equipmentItem(eventId)).toMatchObject({
        complete: false,
        state: "Not decided",
      });

      const result = await recordNoEquipmentNeeded({ eventId });

      expect(result.ok).toBe(true);
      expect(await decision(eventId)).toEqual({
        noEquipmentNeededAt: expect.any(Date),
        noEquipmentNeededById: "usr_coordinator",
      });
      expect(await equipmentItem(eventId)).toMatchObject({
        complete: true,
        state: "No equipment needed",
      });
      expect(
        await prisma.auditLog.findMany({
          where: { entityType: "Event", entityId: eventId },
          select: { fieldName: true, actorId: true },
        }),
      ).toEqual([
        { fieldName: "noEquipmentNeededAt", actorId: "usr_coordinator" },
      ]);
    });

    it("SCRUM-170 [AC4] TC-170-11: creating an equipment request clears the decision, and the request then decides the item", async () => {
      const eventId = await planningEvent();
      await recordNoEquipmentNeeded({ eventId });

      expect((await createEquipmentRequest(projectors(eventId))).ok).toBe(true);

      expect(await decision(eventId)).toEqual({
        noEquipmentNeededAt: null,
        noEquipmentNeededById: null,
      });
      expect(await equipmentItem(eventId)).toMatchObject({
        complete: false,
        state: "Not fully reserved: Projector",
      });
    });

    it("SCRUM-170 [AC4] TC-170-10: with a live request, No equipment needed is refused and nothing is written", async () => {
      const eventId = await planningEvent();
      await createEquipmentRequest(projectors(eventId));

      expect(await recordNoEquipmentNeeded({ eventId })).toMatchObject({
        ok: false,
      });
      expect(await decision(eventId)).toEqual({
        noEquipmentNeededAt: null,
        noEquipmentNeededById: null,
      });
    });

    it("SCRUM-170 [AC4] TC-170-11: a request made while the decision is being recorded waits for it, then clears it: the two never stand together", async () => {
      const eventId = await planningEvent();

      // Record the decision by hand inside a transaction that holds the event
      // row, as recordNoEquipmentNeeded does. The request starts only once the
      // row is held, and the decision commits only once the request is queued
      // behind it, so the two interleave the same way on every run (SCRUM-228).
      let request!: ReturnType<typeof createEquipmentRequest>;
      await prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`;
          await tx.event.update({
            where: { id: eventId },
            data: {
              noEquipmentNeededAt: new Date(),
              noEquipmentNeededById: "usr_coordinator",
            },
          });
          const [{ holder }] = await tx.$queryRaw<{ holder: number }[]>`
            SELECT pg_backend_pid() AS holder
          `;
          request = createEquipmentRequest(projectors(eventId));
          await queuedBehind(holder);
        },
        { timeout: 10_000 },
      );

      expect((await request).ok).toBe(true);
      expect(await decision(eventId)).toEqual({
        noEquipmentNeededAt: null,
        noEquipmentNeededById: null,
      });
      expect(
        await prisma.equipmentRequest.count({
          where: { eventId, status: "PENDING_REVIEW" },
        }),
      ).toBe(1);
    });
  },
);

import {
  describe,
  it,
  expect,
  vi,
  afterEach,
  afterAll,
  type Mock,
} from "vitest";
import type { Session } from "next-auth";
import type { Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  createDraftEvent,
  discardDraftEvent,
  startRequestFromRejected,
  submitEventRequest,
} from "@/app/(app)/events/actions";
import { getOrganiserEvents } from "@/app/(app)/events/role-views";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// SCRUM-130 — what the unit tests can only assume, proven against a real
// database: a discarded draft really leaves the list and stays out of every
// write path, the database itself keeps it a Draft, and a discard racing a
// submit of the same draft lets exactly one of them win.
// Test cases: docs/testing/SCRUM-130.md.
const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

const mockAuth = auth as unknown as Mock;

function signIn(role: Role, id: string) {
  const session: Session = {
    user: { id, role, name: role, email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  };
  mockAuth.mockResolvedValue(session);
}

const PREFIX = `SCRUM-130 ${Date.now()}`;
let counter = 0;

/** A Draft owned by usr_organiser, complete enough to be submitted. */
async function makeDraft(over: { startAt?: Date; endAt?: Date } = {}) {
  const start = new Date(Date.now() + 30 * 86_400_000);
  const draft = await prisma.event.create({
    data: {
      name: `${PREFIX} draft ${++counter}`,
      status: "DRAFT",
      organiserId: "usr_organiser",
      purpose: "Discard journey",
      description: "Owned by the SCRUM-130 integration suite.",
      startAt: start,
      endAt: new Date(start.getTime() + 2 * 3_600_000),
      expectedAttendance: 20,
      venueRequirements: "Any room",
      accessibilityNeeds: "None",
      preferredLayout: "Theatre",
      equipmentRequirements: "None",
      registrationRequired: true,
      registrationNotes: "None",
      ...over,
    },
  });
  return draft;
}

/** The fields submitEventRequest requires, taken from the draft itself. */
function submission(draft: Awaited<ReturnType<typeof makeDraft>>) {
  return {
    id: draft.id,
    name: draft.name,
    purpose: draft.purpose,
    description: draft.description,
    startAt: draft.startAt!.toISOString(),
    endAt: draft.endAt!.toISOString(),
    expectedAttendance: draft.expectedAttendance,
    venueRequirements: draft.venueRequirements,
    accessibilityNeeds: draft.accessibilityNeeds,
    preferredLayout: draft.preferredLayout,
    equipmentRequirements: draft.equipmentRequirements,
    registrationRequired: "yes",
    registrationNotes: draft.registrationNotes,
  };
}

describe.skipIf(!usesLocalDatabase)(
  "SCRUM-130 — discard a draft request",
  () => {
    afterEach(async () => {
      const ids = (
        await prisma.event.findMany({
          where: { name: { startsWith: PREFIX } },
          select: { id: true },
        })
      ).map((e) => e.id);
      await prisma.notification.deleteMany({ where: { eventId: { in: ids } } });
      await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
      await prisma.event.deleteMany({ where: { id: { in: ids } } });
    });

    afterAll(async () => {
      await prisma.$disconnect();
    });

    it("SCRUM-130 [AC1] TC-130-01: a discarded draft leaves My Event Requests but its row and history are kept", async () => {
      const draft = await makeDraft();
      expect(
        (await getOrganiserEvents("usr_organiser")).map((e) => e.id),
      ).toContain(draft.id);

      signIn("ORGANISER", "usr_organiser");
      expect(await discardDraftEvent({ eventId: draft.id })).toEqual({
        ok: true,
        data: { id: draft.id },
      });

      expect(
        (await getOrganiserEvents("usr_organiser")).map((e) => e.id),
      ).not.toContain(draft.id);
      // Not a hard delete: still a Draft, now marked discarded.
      const row = await prisma.event.findUniqueOrThrow({
        where: { id: draft.id },
        select: { status: true, discardedAt: true },
      });
      expect(row.status).toBe("DRAFT");
      expect(row.discardedAt).toBeInstanceOf(Date);
      const history = await prisma.auditLog.findMany({
        where: { entityId: draft.id, action: "DISCARDED" },
      });
      expect(history).toHaveLength(1);
      expect(history[0].actorId).toBe("usr_organiser");
    });

    it("SCRUM-130 [AC1] TC-130-02: a discarded draft cannot be saved or submitted again, and is left exactly as it was", async () => {
      const draft = await makeDraft();
      signIn("ORGANISER", "usr_organiser");
      await discardDraftEvent({ eventId: draft.id });
      const discarded = await prisma.event.findUniqueOrThrow({
        where: { id: draft.id },
      });

      expect(
        await createDraftEvent({ id: draft.id, name: `${PREFIX} renamed` }),
      ).toEqual({
        ok: false,
        error: "Draft event not found or cannot be modified.",
      });
      expect(await submitEventRequest(submission(draft))).toEqual({
        ok: false,
        error: "Draft or rejected event not found or cannot be submitted.",
      });

      expect(
        await prisma.event.findUniqueOrThrow({ where: { id: draft.id } }),
      ).toEqual(discarded);
    });

    it("SCRUM-130 [AC1] TC-130-07: discarding twice records one discard", async () => {
      const draft = await makeDraft();
      signIn("ORGANISER", "usr_organiser");

      await discardDraftEvent({ eventId: draft.id });
      const first = await prisma.event.findUniqueOrThrow({
        where: { id: draft.id },
        select: { discardedAt: true },
      });
      expect(await discardDraftEvent({ eventId: draft.id })).toEqual({
        ok: true,
        data: { id: draft.id },
      });

      expect(
        await prisma.event.findUniqueOrThrow({
          where: { id: draft.id },
          select: { discardedAt: true },
        }),
      ).toEqual(first);
      expect(
        await prisma.auditLog.count({
          where: { entityId: draft.id, action: "DISCARDED" },
        }),
      ).toBe(1);
    });

    it("SCRUM-130 [AC3] TC-130-04: the database refuses to mark a non-draft discarded, or to move a discarded draft out of Draft", async () => {
      const submitted = await makeDraft();
      await prisma.event.update({
        where: { id: submitted.id },
        data: { status: "SUBMITTED", submittedAt: new Date() },
      });
      await expect(
        prisma.event.update({
          where: { id: submitted.id },
          data: { discardedAt: new Date() },
        }),
      ).rejects.toThrow(/event_discarded_only_draft/);

      const discarded = await makeDraft();
      await prisma.event.update({
        where: { id: discarded.id },
        data: { discardedAt: new Date() },
      });
      await expect(
        prisma.event.update({
          where: { id: discarded.id },
          data: { status: "SUBMITTED" },
        }),
      ).rejects.toThrow(/event_discarded_only_draft/);
    });

    it("SCRUM-130 [AC4] TC-130-05: another Organiser's direct request is refused and the draft is untouched", async () => {
      const draft = await makeDraft();
      signIn("ORGANISER", "usr_organiser_2");

      expect(await discardDraftEvent({ eventId: draft.id })).toEqual({
        ok: false,
        error: "Event not found.",
      });
      expect(
        (
          await prisma.event.findUniqueOrThrow({
            where: { id: draft.id },
            select: { discardedAt: true },
          })
        ).discardedAt,
      ).toBeNull();
      expect(
        await prisma.auditLog.count({ where: { entityId: draft.id } }),
      ).toBe(0);
    });

    it.each([
      "COORDINATOR",
      "VENUE_STAFF",
      "TECH_SUPPORT",
      "ATTENDEE",
    ] as const)(
      "SCRUM-130 [AC4] TC-130-06: a %s's direct request is refused and the draft is untouched",
      async (role) => {
        const draft = await makeDraft();
        signIn(role, "usr_coordinator");

        expect(await discardDraftEvent({ eventId: draft.id })).toEqual({
          ok: false,
          error: "You do not have permission to do that.",
        });
        expect(
          (
            await prisma.event.findUniqueOrThrow({
              where: { id: draft.id },
              select: { discardedAt: true },
            })
          ).discardedAt,
        ).toBeNull();
      },
    );

    it("SCRUM-130 [AC5] TC-130-12: a draft untouched for a year, whose dates have passed, is still listed and can still be resumed", async () => {
      const yearAgo = new Date(Date.now() - 365 * 86_400_000);
      const draft = await makeDraft({
        startAt: yearAgo,
        endAt: new Date(yearAgo.getTime() + 3_600_000),
      });
      // @updatedAt is set by Prisma on every write, so age it directly.
      await prisma.$executeRaw`UPDATE "Event" SET "updatedAt" = ${yearAgo}, "createdAt" = ${yearAgo} WHERE "id" = ${draft.id}`;

      expect(
        (await getOrganiserEvents("usr_organiser")).map((e) => e.id),
      ).toContain(draft.id);
      signIn("ORGANISER", "usr_organiser");
      const future = new Date(Date.now() + 10 * 86_400_000);
      expect(
        await createDraftEvent({
          id: draft.id,
          name: draft.name,
          startAt: future.toISOString(),
          endAt: new Date(future.getTime() + 3_600_000).toISOString(),
        }),
      ).toEqual({ ok: true, data: { id: draft.id } });
    });

    // Left to chance, a discard racing a submit is won by the submit almost
    // every time, so each order is forced instead: another transaction holds
    // the draft's row lock, the action under test runs until it is blocked
    // behind it, and only then does the other change commit.
    async function whileRowLocked(
      eventId: string,
      action: () => Promise<unknown>,
      competingChange: Parameters<typeof prisma.event.update>[0]["data"],
    ) {
      let pending!: Promise<unknown>;
      await prisma.$transaction(
        async (blocker) => {
          const [{ pid }] = await blocker.$queryRaw<{ pid: number }[]>`
          SELECT pg_backend_pid() AS pid`;
          await blocker.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`;
          pending = action();
          for (let waited = 0; ; waited += 25) {
            const [{ blocked }] = await prisma.$queryRaw<{ blocked: bigint }[]>`
            SELECT count(*) AS blocked FROM pg_stat_activity
            WHERE ${pid}::int = ANY(pg_blocking_pids(pid))`;
            if (blocked > BigInt(0)) break;
            if (waited > 4_000) throw new Error("the action never blocked");
            await new Promise((resolve) => setTimeout(resolve, 25));
          }
          await blocker.event.update({
            where: { id: eventId },
            data: competingChange,
          });
        },
        { timeout: 10_000 },
      );
      return pending;
    }

    it("SCRUM-130 [AC1, AC3] TC-130-08: a submit that commits while a discard is waiting wins, and the discard changes nothing", async () => {
      const draft = await makeDraft();
      signIn("ORGANISER", "usr_organiser");

      // The discard reads the event as an undiscarded Draft, then waits on the
      // lock to write; meanwhile the draft is submitted.
      const discard = await whileRowLocked(
        draft.id,
        () => discardDraftEvent({ eventId: draft.id }),
        { status: "SUBMITTED", submittedAt: new Date() },
      );

      expect(discard).toEqual({
        ok: false,
        error:
          "This draft changed while you were discarding it. Refresh and try again.",
      });
      expect(
        await prisma.event.findUniqueOrThrow({
          where: { id: draft.id },
          select: { status: true, discardedAt: true },
        }),
      ).toEqual({ status: "SUBMITTED", discardedAt: null });
      expect(
        await prisma.auditLog.count({
          where: { entityId: draft.id, action: "DISCARDED" },
        }),
      ).toBe(0);
    });

    it("SCRUM-130 [AC1] TC-130-08: a discard that commits while a submit is waiting wins, and the submit is refused", async () => {
      const draft = await makeDraft();
      signIn("ORGANISER", "usr_organiser");

      const submit = await whileRowLocked(
        draft.id,
        () => submitEventRequest(submission(draft)),
        { discardedAt: new Date() },
      );

      expect(submit).toEqual({
        ok: false,
        error: "Draft or rejected event not found or cannot be submitted.",
      });
      expect(
        await prisma.event.findUniqueOrThrow({
          where: { id: draft.id },
          select: { status: true, submittedAt: true, coordinatorId: true },
        }),
      ).toEqual({ status: "DRAFT", submittedAt: null, coordinatorId: null });
      expect(
        await prisma.notification.count({ where: { eventId: draft.id } }),
      ).toBe(0);
    });

    it("SCRUM-130 [AC1] TC-130-08: a discard that commits while a Save as Draft is waiting wins, and the save changes nothing", async () => {
      const draft = await makeDraft();
      signIn("ORGANISER", "usr_organiser");

      const save = await whileRowLocked(
        draft.id,
        () => createDraftEvent({ id: draft.id, name: `${PREFIX} late edit` }),
        { discardedAt: new Date() },
      );

      expect(save).toEqual({
        ok: false,
        error: "Draft event not found or cannot be modified.",
      });
      // The discarded draft keeps the name it was discarded with.
      expect(
        await prisma.event.findUniqueOrThrow({
          where: { id: draft.id },
          select: { name: true, discardedAt: true },
        }),
      ).toEqual({ name: draft.name, discardedAt: expect.any(Date) });
    });

    it("SCRUM-130 [AC1] TC-130-08: a submit that commits while a Save as Draft is waiting wins, and the save doesn't overwrite the submitted request", async () => {
      const draft = await makeDraft();
      signIn("ORGANISER", "usr_organiser");

      const save = await whileRowLocked(
        draft.id,
        () => createDraftEvent({ id: draft.id, name: `${PREFIX} late edit` }),
        { status: "SUBMITTED", submittedAt: new Date() },
      );

      expect(save).toEqual({
        ok: false,
        error: "Draft event not found or cannot be modified.",
      });
      expect(
        await prisma.event.findUniqueOrThrow({
          where: { id: draft.id },
          select: { name: true, status: true },
        }),
      ).toEqual({ name: draft.name, status: "SUBMITTED" });
    });

    it("SCRUM-130 [AC1] TC-130-09: after the Draft started from a rejection is discarded, Start New Request makes a fresh Draft", async () => {
      signIn("ORGANISER", "usr_organiser");
      const rejected = await prisma.event.create({
        data: {
          name: `${PREFIX} rejected`,
          status: "REJECTED",
          organiserId: "usr_organiser",
          decisionReason: "Different event now.",
          rejectionOutcome: "NEW_REQUEST",
        },
      });

      const first = await startRequestFromRejected({ eventId: rejected.id });
      expect(first.ok && first.data.created).toBe(true);
      const firstId = first.ok ? first.data.id : "";
      await discardDraftEvent({ eventId: firstId });

      const second = await startRequestFromRejected({ eventId: rejected.id });
      expect(second.ok && second.data.created).toBe(true);
      const secondId = second.ok ? second.data.id : "";
      expect(secondId).not.toBe(firstId);

      // Asking again now returns the fresh Draft, not a third one.
      expect(await startRequestFromRejected({ eventId: rejected.id })).toEqual({
        ok: true,
        data: { id: secondId, created: false },
      });
      const listed = (await getOrganiserEvents("usr_organiser")).map(
        (e) => e.id,
      );
      expect(listed).toContain(secondId);
      expect(listed).not.toContain(firstId);
    });
  },
);

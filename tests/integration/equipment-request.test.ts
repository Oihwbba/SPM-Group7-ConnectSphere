import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";
import type { Session } from "next-auth";
import { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createEquipmentRequest } from "@/app/(app)/equipment-requests/actions";
import {
  getCoordinatorEquipmentRequests,
  getRequestableEvents,
} from "@/lib/equipment/request-queries";

// SCRUM-27 — Create Equipment Request, against a real Postgres. The unit tests
// mock Prisma; these prove what only the database can: the partial unique
// index that keeps one open request per event (AC 7) — including two
// submissions racing — the unique line per type (AC 4), and that the
// coordinator's reads return exactly the rows can() allows.
//
// They use the seeded "Approved — Research Symposium" rather than creating
// events: other suites count Event rows while this one runs in parallel
// (permission-guard.test.ts), so it must never add or remove one. The seed
// gives that event no request; each test removes the ones it created.
//
// They WRITE requests, so they only run against a localhost database (CI's
// service container or the Docker DB) — never the shared Supabase database
// `.env` points at.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

// Seeded accounts, events and equipment (prisma/seed.ts).
const COORDINATOR = "usr_coordinator";
const OTHER_COORDINATOR = "usr_coordinator_2";
const eventId = "evt_approved"; // APPROVED, coordinated by COORDINATOR
const UNDER_REVIEW_EVENT = "evt_under_review"; // also COORDINATOR's

const coordinatorSession = (id: string): Session => ({
  user: { id, role: "COORDINATOR", name: "Casey", email: `${id}@test.local` },
  expires: "2999-01-01T00:00:00.000Z",
});

const request = (eventId: string) => ({
  eventId,
  notes: "Integration test request",
  lines: [
    {
      equipmentId: "eqp_projector",
      quantity: 2,
      technicalRequirements: "HDMI",
    },
    { equipmentId: "eqp_mic", quantity: 3 },
  ],
});

describe.skipIf(!usesLocalDatabase)(
  "SCRUM-27 — equipment requests against Postgres",
  () => {
    // Lines and history cascade with their request.
    const removeRequests = () =>
      prisma.equipmentRequest.deleteMany({ where: { eventId } });

    beforeAll(() => {
      (auth as unknown as Mock).mockResolvedValue(
        coordinatorSession(COORDINATOR),
      );
    });

    beforeEach(async () => {
      await removeRequests();
    });

    afterEach(async () => {
      (auth as unknown as Mock).mockResolvedValue(
        coordinatorSession(COORDINATOR),
      );
      await removeRequests();
    });

    afterAll(async () => {
      await prisma.$disconnect();
    });

    it("AC 1, 2, 5 & 6: saves the request, its lines and its first history entry as Pending Review", async () => {
      const result = await createEquipmentRequest(request(eventId));

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.existing).toBe(false);

      const saved = await prisma.equipmentRequest.findUniqueOrThrow({
        where: { id: result.data.id },
        include: { lines: { orderBy: { quantity: "asc" } }, updates: true },
      });
      expect(saved).toMatchObject({
        eventId,
        requestedById: COORDINATOR,
        status: "PENDING_REVIEW",
        notes: "Integration test request",
      });
      expect(saved.lines).toMatchObject([
        {
          equipmentId: "eqp_projector",
          quantity: 2,
          technicalRequirements: "HDMI",
        },
        { equipmentId: "eqp_mic", quantity: 3, technicalRequirements: null },
      ]);
      expect(saved.updates).toMatchObject([
        {
          actorId: COORDINATOR,
          fromStatus: null,
          toStatus: "PENDING_REVIEW",
          note: "Request submitted.",
        },
      ]);
    });

    it("AC 4: the database itself refuses a second line of the same type on one request", async () => {
      const result = await createEquipmentRequest(request(eventId));
      if (!result.ok) throw new Error(result.error);

      await expect(
        prisma.equipmentRequestLine.create({
          data: {
            requestId: result.data.id,
            equipmentId: "eqp_projector",
            quantity: 1,
          },
        }),
      ).rejects.toMatchObject({ code: "P2002" });
    });

    it("AC 7: a second submission for the same event returns the request pending review", async () => {
      const first = await createEquipmentRequest(request(eventId));
      const second = await createEquipmentRequest(request(eventId));

      expect(first.ok && second.ok).toBe(true);
      if (!first.ok || !second.ok) return;
      expect(second.data).toEqual({ id: first.data.id, existing: true });
      expect(await prisma.equipmentRequest.count({ where: { eventId } })).toBe(
        1,
      );
    });

    it("AC 7: two submissions at the same moment leave one request, and both are shown it", async () => {
      const results = await Promise.all([
        createEquipmentRequest(request(eventId)),
        createEquipmentRequest(request(eventId)),
      ]);

      const ids = results.map((result) =>
        result.ok ? result.data.id : result.error,
      );
      expect(ids[0]).toBe(ids[1]);
      expect(
        results.filter((result) => result.ok && result.data.existing),
      ).toHaveLength(1);
      expect(await prisma.equipmentRequest.count({ where: { eventId } })).toBe(
        1,
      );
    });

    it("AC 7: the index is what enforces one open request, not just the action", async () => {
      const first = await createEquipmentRequest(request(eventId));
      if (!first.ok) throw new Error(first.error);

      await expect(
        prisma.equipmentRequest.create({
          data: { eventId, requestedById: COORDINATOR, status: "IN_REVIEW" },
        }),
      ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    });

    it("AC 7 boundary: once the open request is decided, a new one can be raised", async () => {
      const first = await createEquipmentRequest(request(eventId));
      if (!first.ok) throw new Error(first.error);
      await prisma.equipmentRequest.update({
        where: { id: first.data.id },
        data: { status: "APPROVED" },
      });

      const second = await createEquipmentRequest(request(eventId));

      expect(second.ok && second.data.existing).toBe(false);
      expect(await prisma.equipmentRequest.count({ where: { eventId } })).toBe(
        2,
      );
    });

    it("AC 1: another coordinator cannot raise a request for this event, and nothing is written", async () => {
      (auth as unknown as Mock).mockResolvedValue(
        coordinatorSession(OTHER_COORDINATOR),
      );

      const result = await createEquipmentRequest(request(eventId));

      expect(result).toMatchObject({
        ok: false,
        error: "Choose one of your approved events.",
      });
      expect(await prisma.equipmentRequest.count({ where: { eventId } })).toBe(
        0,
      );
    });

    it("AC 1: offers the coordinator their going-ahead events, and not one still under review or someone else's", async () => {
      const offered = (await getRequestableEvents(COORDINATOR)).map(
        (event) => event.id,
      );
      const offeredToOther = (
        await getRequestableEvents(OTHER_COORDINATOR)
      ).map((event) => event.id);

      expect(offered).toContain(eventId);
      expect(offered).toContain("evt_planning");
      // AC 1: a Confirmed event's details are fixed, so equipment has to be
      // arranged before then.
      expect(offered).not.toContain("evt_confirmed");
      expect(offered).not.toContain(UNDER_REVIEW_EVENT);
      expect(offeredToOther).not.toContain(eventId);
    });

    it("lists a request for its coordinator only", async () => {
      const created = await createEquipmentRequest(request(eventId));
      if (!created.ok) throw new Error(created.error);

      const mine = await getCoordinatorEquipmentRequests(COORDINATOR);
      const theirs = await getCoordinatorEquipmentRequests(OTHER_COORDINATOR);

      const listed = mine.find((row) => row.id === created.data.id);
      expect(listed).toMatchObject({
        status: "PENDING_REVIEW",
        event: { id: eventId },
        lines: [
          {
            quantity: 2,
            equipment: { id: "eqp_projector", type: "Projector" },
          },
          {
            quantity: 3,
            equipment: { id: "eqp_mic", type: "Wireless Microphone" },
          },
        ],
      });
      expect(theirs.map((row) => row.id)).not.toContain(created.data.id);
    });
  },
);

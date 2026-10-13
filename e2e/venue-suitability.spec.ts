import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/db";

import { choose, signedIn, usesLocalDatabase } from "./helpers";

/**
 * SCRUM-40 — venue suitability in a real browser: the Coordinator sees why a
 * venue appears Not suitable for what the request asks, records their own
 * judgement (refused without a note), still requests the venue because the
 * judgement is advisory, and Venue Staff see the judgement on the request.
 *
 * The event is this spec's own, on a 2036 Tuesday clear of anything seeded,
 * and is removed afterwards with its booking and judgement.
 */
const NAME = "E2E Suitability — Workshop";

async function removeTestEvent() {
  const events = await prisma.event.findMany({
    where: { name: { startsWith: NAME } },
    select: { id: true },
  });
  const ids = events.map((e) => e.id);
  const bookings = await prisma.booking.findMany({
    where: { eventId: { in: ids } },
    select: { id: true },
  });
  const judgements = await prisma.venueSuitabilityJudgement.findMany({
    where: { eventId: { in: ids } },
    select: { id: true },
  });
  await prisma.auditLog.deleteMany({
    where: {
      entityId: {
        in: [...bookings.map((b) => b.id), ...judgements.map((j) => j.id)],
      },
    },
  });
  await prisma.booking.deleteMany({ where: { eventId: { in: ids } } });
  await prisma.event.deleteMany({ where: { id: { in: ids } } });
}

test.describe("SCRUM-40 — flag venue suitability, with the reason", () => {
  // Serial: both tests would otherwise run beforeAll, creating the event twice.
  test.describe.configure({ mode: "serial", timeout: 90_000 });

  test.beforeAll(async () => {
    if (!usesLocalDatabase) return;
    await removeTestEvent();
    await prisma.event.create({
      data: {
        name: NAME,
        status: "PLANNING",
        organiserId: "usr_organiser",
        coordinatorId: "usr_coordinator",
        startAt: new Date("2036-05-06T10:00:00+08:00"),
        endAt: new Date("2036-05-06T12:00:00+08:00"),
        expectedAttendance: 40,
      },
    });
  });
  test.afterAll(async () => {
    if (usesLocalDatabase) await removeTestEvent();
  });

  test("SCRUM-40 [AC2, AC3, AC6, AC8, AC9, AC10] TC-40-02, TC-40-03, TC-40-06, TC-40-08, TC-40-09, TC-40-10, TC-40-11: a Not suitable venue shows why, a judgement needs a note, the request still goes through, and Venue Staff see the judgement", async ({
    browser,
  }) => {
    test.skip(!usesLocalDatabase, "creates its own event");
    const coordinator = await signedIn(browser, "coordinator@test.local");
    await coordinator.goto("/bookings/new");
    await coordinator.locator('[data-hydrated="true"]').waitFor();

    await choose(coordinator, "Event", NAME);
    await choose(coordinator, "Venue", /Seminar Room 2\.1/);
    await coordinator.getByRole("button", { name: "stage", exact: true }).click();

    const panel = coordinator.getByTestId("suitability");
    await expect(panel.getByTestId("suitability-result")).toHaveText("Not suitable");
    await expect(panel.getByTestId("suitability-reason")).toHaveText([
      "Missing facility: stage",
    ]);

    // AC5: with the facility it has instead, it is Suitable.
    await coordinator.getByRole("button", { name: "stage", exact: true }).click();
    await coordinator.getByRole("button", { name: "projector", exact: true }).click();
    await expect(panel.getByTestId("suitability-result")).toHaveText("Suitable");
    await coordinator.getByRole("button", { name: "stage", exact: true }).click();

    // AC8: a judgement needs a note.
    await panel.getByRole("button", { name: "Record your judgement" }).click();
    await panel.getByRole("radio", { name: "Suitable", exact: true }).click();
    await panel.getByRole("button", { name: "Save judgement" }).click();
    await expect(panel.getByRole("alert")).toHaveText(
      "Add a note explaining your judgement.",
    );
    expect(
      await prisma.venueSuitabilityJudgement.count({
        where: { event: { name: NAME } },
      }),
    ).toBe(0);

    await panel.getByLabel("Note").fill("We bring our own portable stage.");
    await panel.getByRole("button", { name: "Save judgement" }).click();
    const judgement = panel.getByTestId("suitability-judgement");
    await expect(judgement).toContainText("Coordinator's judgement: Suitable");
    await expect(judgement).toContainText("We bring our own portable stage.");
    await expect(judgement).toContainText("This is the result that counts for this event.");
    // The automatic result still shows beside it.
    await expect(panel.getByTestId("suitability-result")).toHaveText("Not suitable");

    // AC9: advisory — the request is submitted.
    await coordinator.getByRole("button", { name: "Submit request" }).click();
    await expect(coordinator.getByTestId("booking-success")).toBeVisible();

    // AC10: Venue Staff see the judgement and note on the request.
    const staff = await signedIn(browser, "venuestaff@test.local");
    await staff.goto("/bookings");
    const booking = await prisma.booking.findFirstOrThrow({
      where: { event: { name: NAME } },
      select: { id: true },
    });
    const card = staff.getByTestId(`booking-${booking.id}`);
    await expect(card.getByTestId("queue-judgement")).toContainText("Suitable");
    await expect(card.getByTestId("queue-judgement")).toContainText(
      "We bring our own portable stage.",
    );
  });
});

import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/db";

import { signedIn, usesLocalDatabase, selectFrom, optionsOf, openEvent } from "./helpers";

/**
 * SCRUM-21 — the Lead reassigns an event from Cody to Cara. The spec writes
 * its own Planning event and removes it afterwards.
 */
const PREFIX = "E2E Reassign —";

async function removeTestEvents() {
  const ids = (
    await prisma.event.findMany({
      where: { name: { startsWith: PREFIX } },
      select: { id: true },
    })
  ).map((e) => e.id);
  await prisma.notification.deleteMany({ where: { eventId: { in: ids } } });
  await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
  await prisma.event.deleteMany({ where: { id: { in: ids } } });
}

test.describe("SCRUM-21 — Reassign an event to another Coordinator", () => {
  test.describe.configure({ timeout: 90_000 });
  test.skip(!usesLocalDatabase, "writes its own event; local database only");

  test.beforeAll(async () => {
    if (usesLocalDatabase) await removeTestEvents();
  });

  test.afterAll(async () => {
    if (usesLocalDatabase) await removeTestEvents();
  });

  test("SCRUM-21 [AC1, AC5, AC6, AC8] TC-21-01, TC-21-06, TC-21-07, TC-21-08: the Lead reassigns an event at once; the previous Coordinator can only view it, and the Organiser sees the new Coordinator", async ({
    browser,
  }) => {
    const event = await prisma.event.create({
      data: {
        name: `${PREFIX} Alumni Dinner ${Date.now()}`,
        purpose: "Reassignment journey",
        description: "Owned by the SCRUM-21 e2e spec.",
        status: "PLANNING",
        organiserId: "usr_organiser",
        coordinatorId: "usr_coordinator",
        startAt: new Date("2038-09-01T10:00:00+08:00"),
        endAt: new Date("2038-09-01T14:00:00+08:00"),
        expectedAttendance: 80,
      },
      select: { id: true, name: true },
    });

    // AC1: the Lead reassigns it from its read-only page; no acceptance step.
    const lead = await signedIn(browser, "lead@test.local");
    await lead.goto(`/all-events/${event.id}`);
    const form = lead.getByTestId("reassign-form");
    const choice = form.getByLabel("Reassign to");
    const offered = await optionsOf(choice);
    expect(offered.find((o) => o.label.includes("(current)"))?.label).toContain(
      "Cody Coordinator",
    );
    // AC3: the event's own Organiser isn't offered.
    expect(offered.some((o) => o.label.includes("Olivia Organiser"))).toBe(
      false,
    );
    await selectFrom(choice, "usr_coordinator_2");
    await form.getByRole("button", { name: "Reassign" }).click();
    await expect(lead.getByTestId("event-details")).toContainText(
      "Cara Coordinator",
    );
    expect(
      (await prisma.event.findUniqueOrThrow({ where: { id: event.id } }))
        .coordinatorId,
    ).toBe("usr_coordinator_2");

    // AC5: Cody no longer has it in his Events, but can open it read-only.
    const cody = await signedIn(browser, "coordinator@test.local");
    await cody.goto("/events");
    await expect(cody.getByRole("cell", { name: event.name })).toHaveCount(0);
    await cody.goto(`/all-events/${event.id}`);
    await expect(cody.getByTestId("read-only")).toContainText(
      "Read-only: only the event's assigned Coordinator can change it.",
    );
    await expect(cody.getByTestId("reassign-form")).toHaveCount(0);

    // AC8: the Organiser sees the current Coordinator's name.
    const organiser = await signedIn(browser, "organiser@test.local");
    await organiser.goto("/events");
    // SCRUM-208 AC2: the Coordinator is named at the top of the event page.
    await expect(
      (await openEvent(organiser, event.name)).getByTestId("current-coordinator"),
    ).toContainText("Cara Coordinator");

    // AC6: the Organiser and both Coordinators are told.
    for (const [page, title] of [
      [organiser, "Your event has a new coordinator"],
      [cody, "An event was reassigned"],
      [await signedIn(browser, "coordinator2@test.local"), "An event was reassigned to you"],
    ] as const) {
      await page.goto("/notifications");
      await expect(
        page.getByTestId("notification").filter({ hasText: event.name }),
      ).toContainText(title);
    }
  });

  test("SCRUM-21 [AC4] TC-21-05: Reassign isn't offered for a Submitted request", async ({
    browser,
  }) => {
    const lead = await signedIn(browser, "lead@test.local");
    await lead.goto("/all-events/evt_submitted");

    await expect(lead.getByTestId("event-details")).toBeVisible();
    await expect(lead.getByTestId("reassign-form")).toHaveCount(0);
  });
});

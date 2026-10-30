import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/db";

import { signedIn, usesLocalDatabase } from "./helpers";

/**
 * SCRUM-247 — a Coordinator editing a re-planned event can't lower its
 * expected attendance below the people already registered. The event is this
 * spec's own: in Planning for 10, as a Confirmed event goes back to Planning
 * after an approved change with its registrations kept (SCRUM-128 AC5), with
 * three Attendees registered. Removed afterwards with its registrations.
 */
const NAME = "E2E SCRUM-247 — Re-planned Workshop";

async function removeTestEvent() {
  const ids = (
    await prisma.event.findMany({ where: { name: NAME }, select: { id: true } })
  ).map((e) => e.id);
  await prisma.registration.deleteMany({ where: { eventId: { in: ids } } });
  await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
  await prisma.event.deleteMany({ where: { id: { in: ids } } });
}

test.describe("SCRUM-247 — expected attendance can't fall below the active registrations", () => {
  test.afterAll(async () => {
    if (usesLocalDatabase) await removeTestEvent();
  });

  test("SCRUM-247 [AC1] TC-247-01, TC-247-02: below the 3 registered is refused beside the field with nothing saved; exactly 3 saves", async ({
    browser,
  }) => {
    test.skip(!usesLocalDatabase, "creates its own event and registrations");
    await removeTestEvent();
    const { id: eventId } = await prisma.event.create({
      data: {
        name: NAME,
        purpose: "Training",
        status: "PLANNING",
        organiserId: "usr_organiser",
        coordinatorId: "usr_coordinator",
        startAt: new Date("2036-08-04T10:00:00+08:00"),
        endAt: new Date("2036-08-04T12:00:00+08:00"),
        expectedAttendance: 10,
        registrationRequired: true,
        submittedAt: new Date(),
      },
      select: { id: true },
    });
    await prisma.registration.createMany({
      data: ["usr_attendee", "usr_attendee_2", "usr_attendee_3"].map(
        (userId) => ({ eventId, userId, status: "REGISTERED" as const }),
      ),
    });

    const coordinator = await signedIn(browser, "coordinator@test.local");
    await coordinator.goto(`/events/${eventId}`);
    await coordinator.getByRole("button", { name: "Edit details" }).click();
    const edit = coordinator.getByRole("dialog", { name: `Edit ${NAME}` });
    const attendance = edit.getByLabel("Expected attendance");

    await attendance.fill("2");
    await edit.getByRole("button", { name: "Save details" }).click();
    const message =
      "This event has 3 active registrations, so the expected attendance can't be lower than 3.";
    await expect(attendance).toHaveAttribute("aria-invalid", "true");
    await expect(
      attendance.locator("xpath=following-sibling::p"),
    ).toHaveText(message);
    expect(
      (await prisma.event.findUniqueOrThrow({ where: { id: eventId } }))
        .expectedAttendance,
    ).toBe(10);

    await attendance.fill("3");
    await edit.getByRole("button", { name: "Save details" }).click();
    await expect(coordinator.getByText("Details saved.")).toBeVisible();
    expect(
      (await prisma.event.findUniqueOrThrow({ where: { id: eventId } }))
        .expectedAttendance,
    ).toBe(3);
  });
});

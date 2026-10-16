import { test, expect } from "@playwright/test";

import { prisma } from "@/lib/db";
import { signedIn, usesLocalDatabase } from "./helpers";

/**
 * SCRUM-134 — Venue Staff see which pending requests compete for the same
 * venue, and the later can't be approved until the earlier is decided. The
 * equipment side and every rule are in tests/unit/first-come.test.ts and
 * tests/integration/first-come.test.ts. Test cases: docs/testing/SCRUM-134.md.
 *
 * Its events and their two requests are its own, on the Exhibition Hall in
 * December 2036, clear of anything seeded or booked by other specs.
 */
const STAMP = Date.now();
const START = new Date("2036-12-07T01:00:00.000Z");
const END = new Date("2036-12-07T05:00:00.000Z");

test.describe("SCRUM-134 — competing venue requests, first come, first served", () => {
  test.describe.configure({ timeout: 90_000 });
  test.skip(!usesLocalDatabase, "writes its own events; local database only");

  const eventIds: string[] = [];

  test.afterAll(async () => {
    const bookings = await prisma.booking.findMany({
      where: { eventId: { in: eventIds } },
      select: { id: true },
    });
    await prisma.notification.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: bookings.map((b) => b.id) } } });
    await prisma.booking.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
  });

  test("SCRUM-134 [AC1, AC2, AC6] TC-134-01, TC-134-02, TC-134-06: the later request shows the earlier one, can't be approved before it, and the earlier is approved first", async ({
    browser,
  }, testInfo) => {
    const names = ["Earlier", "Later"].map((label) => `SCRUM-134 ${label} ${testInfo.retry} ${STAMP}`);
    const submitted = [new Date("2036-01-01T01:00:00.000Z"), new Date("2036-01-02T01:00:00.000Z")];
    for (const [i, name] of names.entries()) {
      const { id } = await prisma.event.create({
        data: {
          name,
          status: "PLANNING",
          organiserId: "usr_organiser",
          coordinatorId: "usr_coordinator",
          startAt: START,
          endAt: END,
          expectedAttendance: 50,
        },
        select: { id: true },
      });
      eventIds.push(id);
      await prisma.booking.create({
        data: {
          eventId: id,
          venueId: "ven_hall",
          startAt: START,
          endAt: END,
          status: "PENDING",
          requestedAttendance: 50,
          requestedById: "usr_coordinator",
          createdAt: submitted[i],
        },
      });
    }

    const staff = await signedIn(browser, "venuestaff@test.local");
    await staff.goto("/bookings");
    // By its own event name: a card also names its competitors.
    const card = (name: string) =>
      staff.getByTestId(/^booking-/).filter({ has: staff.getByText(name, { exact: true }) });

    // AC1: the later request names the earlier one, and when it was submitted.
    const competing = card(names[1]).getByTestId("competing-requests");
    await expect(competing).toContainText(`“${names[0]}”, submitted 1 Jan 2036, 9:00 am`);
    await expect(competing).toContainText("earlier, so decide it first");

    // AC2: approving the later one is refused, and it stays in the queue.
    await card(names[1]).getByRole("button", { name: "Approve" }).click();
    await expect(staff.getByText(/^An earlier request for Exhibition Hall/)).toBeVisible();
    await expect(card(names[1])).toHaveCount(1);

    // The earlier one is approved; the later then conflicts, and can be rejected (AC6).
    await card(names[0]).getByRole("button", { name: "Approve" }).click();
    await expect(staff.getByText(/^Approved: Exhibition Hall is now booked/)).toBeVisible();
    await card(names[1]).getByRole("button", { name: "Reject" }).click();
    await staff.getByLabel("Rejection reason").fill("The hall went to an earlier request.");
    await staff.getByRole("button", { name: "Reject request" }).click();
    await expect(card(names[1])).toHaveCount(0);
  });
});

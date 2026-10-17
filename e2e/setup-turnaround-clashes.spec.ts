import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";
import { TIMES_CHANGED_REASON } from "@/lib/venue-time-clashes";

// Writes its own venue, events and bookings, so it runs only against a local
// database (CI's).
const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

async function signInAs(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  await page.goto("/bookings");
}

/**
 * SCRUM-160 AC5 — Venue Staff see the bookings flagged because a venue's
 * setup or turnaround time changed. The flag is written directly, as
 * changing the times would write it, since the venue edit form is SCRUM-34's.
 */
test.describe("SCRUM-160 — Bookings that clash after a setup or turnaround change", () => {
  test.skip(!usesLocalDatabase, "writes its own rows; local database only");

  const stamp = Date.now();
  const venueName = `SCRUM-160 Hall ${stamp}`;
  const flaggedEvent = `SCRUM-160 Flagged Expo ${stamp}`;
  const otherEvent = `SCRUM-160 Earlier Fair ${stamp}`;
  let venueId = "";
  const eventIds: string[] = [];
  const bookingIds: string[] = [];

  test.beforeAll(async () => {
    venueId = (
      await prisma.venue.create({
        data: { name: venueName, location: "Test block", capacity: 100, setupMinutes: 30, turnaroundMinutes: 45 },
        select: { id: true },
      })
    ).id;
    for (const [name, start, end] of [
      [otherEvent, "2032-04-01T02:00:00Z", "2032-04-01T04:00:00Z"],
      [flaggedEvent, "2032-04-01T05:00:00Z", "2032-04-01T07:00:00Z"],
    ] as const) {
      const event = await prisma.event.create({
        data: {
          name,
          status: "PLANNING",
          organiserId: "usr_organiser",
          coordinatorId: "usr_coordinator",
          startAt: new Date(start),
          endAt: new Date(end),
        },
        select: { id: true },
      });
      eventIds.push(event.id);
      const booking = await prisma.booking.create({
        data: {
          eventId: event.id,
          venueId,
          startAt: new Date(start),
          endAt: new Date(end),
          status: "APPROVED",
          requestedById: "usr_coordinator",
          decidedById: "usr_venuestaff",
          decidedAt: new Date(),
        },
        select: { id: true },
      });
      bookingIds.push(booking.id);
    }
    const flaggedAt = new Date();
    await prisma.booking.update({
      where: { id: bookingIds[1] },
      data: {
        needsReconsideration: true,
        reconsiderationReason: TIMES_CHANGED_REASON,
        reconsiderationFlaggedAt: flaggedAt,
      },
    });
    await prisma.auditLog.create({
      data: {
        entityType: "Booking",
        entityId: bookingIds[1],
        action: "RECONSIDERATION_FLAGGED",
        fieldName: "clashesWith",
        newValue: `booking:${bookingIds[0]}`,
        createdAt: flaggedAt,
      },
    });
  });

  test.afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { entityId: { in: bookingIds } } });
    await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
    await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
    await prisma.venue.delete({ where: { id: venueId } });
  });

  test("SCRUM-160 [AC5] TC-160-11: Venue Staff see the flagged booking's venue, event, Coordinator and what it clashes with", async ({
    page,
  }) => {
    await signInAs(page, "venuestaff@test.local");

    const section = page.getByRole("region", {
      name: "Clashes after a setup or turnaround change",
    });
    const row = section.getByRole("row", { name: new RegExp(flaggedEvent) });
    await expect(row).toContainText(venueName);
    await expect(row).toContainText("Cody Coordinator");
    await expect(row).toContainText(`"${otherEvent}"'s booking from 1 Apr 2032, 10:00 am SGT`);
    // The booking it clashes with isn't flagged, so it has no row of its own.
    await expect(
      section.getByRole("row", { name: new RegExp(`^${venueName} ${otherEvent}`) }),
    ).toHaveCount(0);
  });
});

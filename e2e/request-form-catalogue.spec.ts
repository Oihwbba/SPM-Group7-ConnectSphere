import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";

import { signedIn, usesLocalDatabase } from "./helpers";

/**
 * SCRUM-246 — what the event request form tells the Organiser about the
 * catalogue: equipment as the stock held, and each venue's opening hours
 * beside its capacity. Expected values are the seed's (prisma/seed.ts):
 * 10 projectors; Seminar Room 2.1 open 08:00–20:00 on weekdays and closed
 * at weekends; the Grand Auditorium open 07:00–23:00 every day.
 */
async function openStep(page: Page, step: string) {
  await page
    .getByRole("button", { name: /Create Event Request/i })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("navigation", { name: "Progress" })
    .getByRole("button", { name: step })
    .click();
}

const option = (page: Page, value: string) =>
  page.getByRole("menu").locator(`[data-option="${value}"]`);

test.describe("SCRUM-246 — the request form's equipment stock and venue hours", () => {
  test("SCRUM-246 [AC1] TC-246-01: equipment shows its total as in stock, never as available", async ({
    browser,
  }) => {
    const page = await signedIn(browser, "organiser@test.local");
    await openStep(page, "4 - Equipment");
    await page.getByLabel("Equipment & Technical Support Requirements *").click();

    await expect(option(page, "Projector")).toHaveText(/^Projector\s*10 in stock$/);
    await expect(page.getByRole("menu")).not.toContainText("available");
  });

  test("SCRUM-246 [AC2] TC-246-02: each venue shows its capacity and every day's hours, Closed days as Closed", async ({
    browser,
  }) => {
    const page = await signedIn(browser, "organiser@test.local");
    await openStep(page, "3 - Venue");
    await page.getByLabel("Venue Requirements *").click();

    const seminar = option(page, "Seminar Room 2.1");
    await expect(seminar).toContainText("max capacity60");
    await expect(seminar.getByTestId("venue-hours").locator("span")).toHaveText([
      "Monday 08:00–20:00",
      "Tuesday 08:00–20:00",
      "Wednesday 08:00–20:00",
      "Thursday 08:00–20:00",
      "Friday 08:00–20:00",
      "Saturday Closed",
      "Sunday Closed",
    ]);
    // The same words as the venue catalogue (SCRUM-34 AC1): every day open.
    await expect(
      option(page, "Grand Auditorium").getByTestId("venue-hours").locator("span"),
    ).toHaveText(Array(7).fill(/^\w+day 07:00–23:00$/));
  });

  test("SCRUM-246 [AC2] TC-246-03: a venue with no opening hours recorded shows its capacity only", async ({
    browser,
  }) => {
    test.skip(!usesLocalDatabase, "adds a venue with no hours");
    const name = `SCRUM-246 no hours ${Date.now()}`;
    const venue = await prisma.venue.create({
      data: { name, location: "Test block", capacity: 12 },
      select: { id: true },
    });
    try {
      const page = await signedIn(browser, "organiser@test.local");
      await openStep(page, "3 - Venue");
      await page.getByLabel("Venue Requirements *").click();

      await expect(option(page, name)).toContainText("max capacity12");
      await expect(option(page, name).getByTestId("venue-hours")).toHaveCount(0);
    } finally {
      await prisma.venue.delete({ where: { id: venue.id } });
    }
  });
});

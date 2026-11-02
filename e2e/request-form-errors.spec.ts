import { test, expect, type Page } from "@playwright/test";

import { prisma } from "@/lib/db";
import {
  fillEventSchedule,
  fillOther,
  openEvent,
  signedIn,
  submitRequest,
  usesLocalDatabase,
} from "./helpers";

/**
 * SCRUM-263 — a refused event request shows what to fix. Programme and Special
 * Requests hold 5,000 characters (SCRUM-13 AC11), and Venue Requirements,
 * Accessibility Needs, Equipment Requirements and Room Layout their own limits
 * (AC3).
 */
const AT_LIMIT = "A".repeat(5000);
const OVER_LIMIT = "A".repeat(5001);
const LAYOUT_AT_LIMIT = "A".repeat(200);
const LAYOUT_OVER_LIMIT = "A".repeat(201);

async function openForm(page: Page) {
  await page
    .getByRole("button", { name: /Create Event Request/i })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

async function goToStep(page: Page, step: string) {
  await page
    .getByRole("navigation", { name: "Progress" })
    .getByRole("button", { name: step })
    .click();
}

/** Every step but Details filled in with valid answers. */
async function fillRequiredFields(page: Page, name: string) {
  await page.getByLabel("Event Name *").fill(name);
  await page.getByLabel("Event Purpose *").fill("Regional knowledge sharing.");
  await page.getByLabel("Event Description *").fill("A day of talks.");
  await goToStep(page, "2 - Schedule");
  await fillEventSchedule(page, "2027-10-15", "09:00", "18:00");
  await page.getByLabel("Expected Attendance *").fill("150");
  await goToStep(page, "3 - Venue");
  await fillOther(page.getByLabel("Venue Requirements *"), "A large hall.");
  await fillOther(page.getByLabel("Preferred Room Layout *"), "Theatre");
  await fillOther(page.getByLabel("Accessibility Needs *"), "Wheelchair access.");
  await goToStep(page, "4 - Equipment");
  await fillOther(
    page.getByLabel("Equipment & Technical Support Requirements *"),
    "One projector.",
  );
  await goToStep(page, "5 - Details");
  await page
    .getByRole("group", { name: "Registration Needed *" })
    .getByLabel("No")
    .check();
}

test.describe("SCRUM-263 — a refused event request shows what to fix", () => {
  test.describe.configure({ timeout: 90_000 });
  test.skip(!usesLocalDatabase, "writes its own events; local database only");

  test("SCRUM-263 [AC3] TC-263-10: open-text fields over their limits are highlighted step by step, and the request goes through once they fit", async ({
    browser,
  }) => {
    const page = await signedIn(browser, "organiser@test.local");
    const name = `Over the new limits ${Date.now()}`;
    const submit = () =>
      page.getByRole("button", { name: /Submit Request for Review/i }).click();
    await openForm(page);
    await fillRequiredFields(page, name);
    await goToStep(page, "3 - Venue");
    await fillOther(page.getByLabel("Venue Requirements *"), OVER_LIMIT);
    await fillOther(page.getByLabel("Preferred Room Layout *"), LAYOUT_OVER_LIMIT);
    await fillOther(page.getByLabel("Accessibility Needs *"), OVER_LIMIT);
    await goToStep(page, "4 - Equipment");
    await fillOther(
      page.getByLabel("Equipment & Technical Support Requirements *"),
      OVER_LIMIT,
    );
    await goToStep(page, "6 - Review");

    await submit();

    await expect(
      page.getByText("Please fix the highlighted fields before submitting."),
    ).toBeVisible();
    for (const [box, message] of [
      ["venueRequirements-other", "Keep venue requirements under 5000 characters."],
      ["preferredLayout-other", "Keep room layout under 200 characters."],
      ["accessibilityNeeds-other", "Keep accessibility needs under 5000 characters."],
    ]) {
      await expect(page.locator(`[id="${box}"]`)).toHaveAttribute("aria-invalid", "true");
      await expect(page.getByText(message, { exact: true })).toBeVisible();
    }
    expect(await prisma.event.count({ where: { name } })).toBe(0);

    await fillOther(page.getByLabel("Venue Requirements *"), AT_LIMIT);
    await fillOther(page.getByLabel("Preferred Room Layout *"), LAYOUT_AT_LIMIT);
    // The limit counts the whole answer, and this option came from the fixture.
    await page.getByRole("button", { name: "Remove Wheelchair access" }).click();
    await fillOther(page.getByLabel("Accessibility Needs *"), AT_LIMIT);
    await goToStep(page, "6 - Review");
    await submit();

    const equipment = page.locator('[id="equipmentRequirements-other"]');
    await expect(equipment).toHaveAttribute("aria-invalid", "true");
    await expect(
      page.getByText("Keep equipment requirements under 5000 characters.", {
        exact: true,
      }),
    ).toBeVisible();
    expect(await prisma.event.count({ where: { name } })).toBe(0);

    await equipment.fill(AT_LIMIT);
    await goToStep(page, "6 - Review");
    await submitRequest(page);

    await expect(page.getByRole("cell", { name })).toBeVisible();
  });

  test("SCRUM-263 [AC3] TC-263-11: the Coordinator's edit over a limit shows why beside the field and saves nothing", async ({
    browser,
  }) => {
    const name = `E2E Limits — Edit ${Date.now()}`;
    const { id } = await prisma.event.create({
      data: {
        name,
        purpose: "Fundraising",
        status: "PLANNING",
        organiserId: "usr_organiser",
        coordinatorId: "usr_coordinator",
        startAt: new Date("2036-08-01T10:00:00+08:00"),
        endAt: new Date("2036-08-01T14:00:00+08:00"),
        expectedAttendance: 120,
        venueRequirements: "Hall",
        preferredLayout: "Banquet",
        submittedAt: new Date(),
      },
      select: { id: true },
    });
    try {
      const page = await signedIn(browser, "coordinator@test.local");
      const details = await openEvent(page, name, "Request");
      await details.getByRole("button", { name: "Edit details" }).click();
      const edit = page.getByRole("dialog", { name: `Edit ${name}` });
      const field = edit.getByLabel("Venue requirements", { exact: true });
      await field.fill(OVER_LIMIT);

      await edit.getByRole("button", { name: "Save details" }).click();

      await expect(edit.getByTestId("edit-details-error")).toHaveText(
        "Please fix the highlighted fields.",
      );
      await expect(field).toHaveAttribute("aria-invalid", "true");
      await expect(
        edit.getByText("Keep venue requirements under 5000 characters.", {
          exact: true,
        }),
      ).toBeVisible();
      expect(
        await prisma.event.findUniqueOrThrow({
          where: { id },
          select: { venueRequirements: true },
        }),
      ).toEqual({ venueRequirements: "Hall" });
    } finally {
      await prisma.event.delete({ where: { id } });
    }
  });

  for (const [label, message] of [
    ["Registration Notes (Optional)", "Keep registration notes under 5000 characters."],
    ["Event Programme (Optional)", "Keep programme under 5000 characters."],
    [
      "Special Requests / Arrangements (Optional)",
      "Keep special requests under 5000 characters.",
    ],
  ]) {
    test(`SCRUM-263 [AC1] TC-263-01: ${label} over its limit shows why beside the field, and clears once shortened`, async ({
      browser,
    }) => {
      const page = await signedIn(browser, "organiser@test.local");
      const name = `Over the limit ${Date.now()}`;
      await openForm(page);
      await page.getByLabel("Event Name *").fill(name);
      await goToStep(page, "5 - Details");
      const field = page.getByLabel(label);
      await field.fill(OVER_LIMIT);

      await page.getByRole("button", { name: /Save as Draft/i }).click();

      await expect(page.getByText("Please fix the highlighted fields.")).toBeVisible();
      await expect(field).toHaveAttribute("aria-invalid", "true");
      await expect(page.getByText(message, { exact: true })).toBeVisible();
      expect(await prisma.event.count({ where: { name } })).toBe(0);

      await field.fill(AT_LIMIT);

      await expect(field).toHaveAttribute("aria-invalid", "false");
      await expect(page.getByText(message, { exact: true })).toHaveCount(0);
    });
  }

  test("SCRUM-263 [AC2] TC-263-03: a refused submission opens the step with the error, and the request goes through once it is fixed", async ({
    browser,
  }) => {
    const page = await signedIn(browser, "organiser@test.local");
    const name = `Refused at review ${Date.now()}`;
    await openForm(page);
    await fillRequiredFields(page, name);
    const programme = page.getByLabel("Event Programme (Optional)");
    await programme.fill(OVER_LIMIT);
    await goToStep(page, "6 - Review");

    await page.getByRole("button", { name: /Submit Request for Review/i }).click();

    await expect(
      page.getByText("Please fix the highlighted fields before submitting."),
    ).toBeVisible();
    await expect(programme).toHaveAttribute("aria-invalid", "true");
    await expect(
      page.getByText("Keep programme under 5000 characters.", { exact: true }),
    ).toBeVisible();
    expect(await prisma.event.count({ where: { name } })).toBe(0);

    await programme.fill(AT_LIMIT);
    await goToStep(page, "6 - Review");
    await submitRequest(page);

    await expect(page.getByRole("cell", { name })).toBeVisible();
  });

  test("SCRUM-263 [AC2] TC-263-04: a refused draft opens the step with the error, wherever it was saved from", async ({
    browser,
  }) => {
    const page = await signedIn(browser, "organiser@test.local");
    const name = `Refused draft ${Date.now()}`;
    await openForm(page);
    await page.getByLabel("Event Name *").fill(name);
    await goToStep(page, "5 - Details");
    const special = page.getByLabel("Special Requests / Arrangements (Optional)");
    await special.fill(OVER_LIMIT);
    await goToStep(page, "1 - Basics");

    await page.getByRole("button", { name: /Save as Draft/i }).click();

    await expect(special).toHaveAttribute("aria-invalid", "true");
    await expect(
      page.getByText("Keep special requests under 5000 characters.", {
        exact: true,
      }),
    ).toBeVisible();
    expect(await prisma.event.count({ where: { name } })).toBe(0);
  });
});

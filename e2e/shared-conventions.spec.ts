import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";

import {
  fillEventSchedule,
  fillOther,
  pickOptions,
  signedIn,
  usesLocalDatabase,
} from "./helpers";

/**
 * Shared page conventions (UI revamp U1): the changes made to every page that
 * shows the same element, checked where they first appear — the event
 * request form, the My Events list and the header. Each journey's own spec
 * already drives the shared dropdown and date and time picker.
 */
const PREFIX = "UI conventions";

async function openForm(page: Page) {
  await page
    .getByRole("button", { name: /Create Event Request/i })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

/** Every field the form needs to be submitted. */
async function fillRequest(page: Page, name: string) {
  await page.getByLabel("Event Name *").fill(name);
  await page
    .getByLabel("Event Purpose *")
    .fill("Check the shared page conventions.");
  await page
    .getByLabel("Event Description *")
    .fill("Filled by the shared conventions spec.");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await fillEventSchedule(page, "2037-03-02", "09:00", "17:00");
  await page.getByLabel("Expected Attendance *").fill("40");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await pickOptions(page.getByLabel("Venue Requirements *"), [
    "Seminar Room 2.1",
  ]);
  await pickOptions(page.getByLabel("Preferred Room Layout *"), ["Classroom"]);
  await fillOther(page.getByLabel("Accessibility Needs *"), "None needed");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await pickOptions(
    page.getByLabel("Equipment & Technical Support Requirements *"),
    ["Projector"],
  );
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page
    .getByRole("group", { name: "Registration Needed *" })
    .getByLabel("No")
    .check();
  await page.getByRole("button", { name: "Next", exact: true }).click();
}

test.describe("SCRUM-207 — Shared page conventions on every page", () => {
  test.describe.configure({ timeout: 90_000 });

  test.afterAll(async () => {
    if (!usesLocalDatabase) return;
    const events = await prisma.event.findMany({
      where: { name: { startsWith: PREFIX } },
      select: { id: true },
    });
    const ids = events.map((e) => e.id);
    await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
    await prisma.notification.deleteMany({ where: { eventId: { in: ids } } });
    await prisma.event.deleteMany({ where: { id: { in: ids } } });
  });

  test("SCRUM-207 TC-207-11: the form's steps sit on one line, and its fields carry no helper lines", async ({
    browser,
  }) => {
    const page = await signedIn(browser, "organiser@test.local");
    await openForm(page);

    // Change 1: six numbered steps on one line, the current one marked; no
    // "Step 1 of 6".
    const steps = page
      .getByRole("navigation", { name: "Progress" })
      .getByRole("button");
    const names = [
      "1 - Basics",
      "2 - Schedule",
      "3 - Venue",
      "4 - Equipment",
      "5 - Details",
      "6 - Review",
    ];
    await expect(steps).toHaveCount(names.length);
    for (const [i, name] of names.entries()) {
      await expect(steps.nth(i)).toHaveAccessibleName(name);
      await expect(steps.nth(i).getByText(name, { exact: true })).toBeVisible();
    }
    const tops = await steps.evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().top)),
    );
    expect(new Set(tops).size).toBe(1);
    await expect(steps.first()).toHaveAttribute("aria-current", "step");
    await expect(page.getByText(/Step \d of 6/)).toHaveCount(0);

    // Change 4: no hint lines under the schedule fields.
    await steps.nth(1).click();
    await expect(steps.nth(1)).toHaveAttribute("aria-current", "step");
    for (const hint of [
      "Must be a future date & time.",
      "Must be strictly after start date & time.",
      "Must be a positive whole number greater than 0.",
    ]) {
      await expect(page.getByText(hint)).toHaveCount(0);
    }

    // Change 6: a venue's capacity is a person icon and a number.
    await steps.nth(2).click();
    await page.getByLabel("Venue Requirements *").click();
    await expect(
      page.getByRole("menuitemcheckbox", {
        name: /Grand Auditorium.*max capacity 500/,
      }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("SCRUM-207 TC-207-12: Save as Draft keeps the form open, says it saved, and saving again updates the same draft", async ({
    browser,
  }) => {
    test.skip(!usesLocalDatabase, "reads the saved draft back");
    const page = await signedIn(browser, "organiser@test.local");
    const name = `${PREFIX} draft ${Date.now()}`;
    await openForm(page);
    await page.getByLabel("Event Name *").fill(name);

    // Change 2: the button has an icon, and turns into a tick on saving.
    const save = page.getByRole("button", { name: /Save as Draft/i });
    await expect(save.locator("svg")).toHaveCount(1);
    await save.click();
    await expect(
      page.getByRole("button", { name: "Saved as draft" }),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Changing anything offers saving again; the second save updates the
    // first draft rather than creating another.
    await page.getByLabel("Event Purpose *").fill("Saved twice.");
    await expect(
      page.getByRole("button", { name: /Save as Draft/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Save as Draft/i }).click();
    await expect(
      page.getByRole("button", { name: "Saved as draft" }),
    ).toBeVisible();

    const drafts = await prisma.event.findMany({
      where: { name },
      select: { status: true, purpose: true },
    });
    expect(drafts).toEqual([{ status: "DRAFT", purpose: "Saved twice." }]);
  });

  test("SCRUM-207 [AC4] TC-207-07: submitting shows a confirmation pop-up whose View Details opens the request", async ({
    browser,
  }) => {
    test.skip(!usesLocalDatabase, "submits a request");
    const page = await signedIn(browser, "organiser@test.local");
    const name = `${PREFIX} submitted ${Date.now()}`;
    await openForm(page);
    await fillRequest(page, name);

    // Change 8: an animated tick, Close and View Details.
    await page
      .getByRole("button", { name: /Submit Request for Review/i })
      .click();
    const submitted = page.getByTestId("event-request-submitted");
    await expect(submitted).toContainText("Request submitted");
    await expect(
      submitted.getByRole("button", { name: "Close" }),
    ).toBeVisible();
    await submitted.getByRole("button", { name: "View Details" }).click();
    await expect(submitted).toHaveCount(0);
    // SCRUM-208: the request opens on its own page.
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();

    // What was chosen is saved as the same text as before (change 7).
    const saved = await prisma.event.findFirstOrThrow({
      where: { name },
      select: {
        status: true,
        venueRequirements: true,
        preferredLayout: true,
        equipmentRequirements: true,
      },
    });
    expect(saved).toEqual({
      status: "SUBMITTED",
      venueRequirements: "Preferred venue: Seminar Room 2.1",
      preferredLayout: "Classroom",
      equipmentRequirements: "Requested equipment: Projector",
    });
  });

  test("SCRUM-207 TC-207-13: My Events reads Last Updated, and a row's actions sit on one line as icons that say what they do", async ({
    browser,
  }) => {
    const page = await signedIn(browser, "organiser@test.local");

    // Change 3.
    await expect(
      page.getByRole("button", { name: "Sort by Last Updated" }),
    ).toHaveText("Last Updated");
    const draft = page.getByTestId("draft-event-row").first();
    await expect(draft.getByText("Draft — Incomplete")).toHaveCount(0);
    // SCRUM-208: View Details is a link to the event's page.
    const view = draft.getByRole("link", { name: "View Details" });
    const discard = draft.getByRole("button", { name: "Discard" });
    await expect(view).toHaveText("");
    await expect(discard).toHaveText("");
    const resume = draft.getByTestId("resume-draft-button");
    const top = async (button: typeof view) =>
      Math.round((await button.boundingBox())!.y);
    expect(await top(view)).toBe(await top(resume));
    expect(await top(discard)).toBe(await top(resume));

    // Change 10: the status filter is the app's dropdown.
    await page.getByLabel("Filter by status").click();
    await expect(
      page.getByRole("option", { name: "All Statuses" }),
    ).toHaveAttribute("data-state", "checked");
    await page.keyboard.press("Escape");
  });

  test("SCRUM-207 TC-207-14: an event with a clarification offers Clarifications, which opens its thread on a full-width tab", async ({
    browser,
  }) => {
    test.skip(!usesLocalDatabase, "creates its own event");
    const name = `${PREFIX} clarified ${Date.now()}`;
    const event = await prisma.event.create({
      data: {
        name,
        purpose: "Clarifications action",
        description: "Owned by the shared conventions spec.",
        status: "UNDER_REVIEW",
        organiserId: "usr_organiser",
        coordinatorId: "usr_coordinator",
        startAt: new Date("2037-03-03T01:00:00Z"),
        endAt: new Date("2037-03-03T09:00:00Z"),
        expectedAttendance: 40,
        venueRequirements: "Any room",
        requiredFacilities: [],
        accessibilityNeeds: "None",
        preferredLayout: "Classroom",
        equipmentRequirements: "None",
        registrationNotes: "None",
        submittedAt: new Date(),
      },
      select: { id: true },
    });
    await prisma.clarificationRequest.create({
      data: {
        eventId: event.id,
        requestedById: "usr_coordinator",
        message: "How many guests need step-free access?",
      },
    });
    const page = await signedIn(browser, "organiser@test.local");

    const row = page
      .getByTestId("submitted-event-row")
      .filter({ hasText: name });
    await row.getByRole("link", { name: "Clarifications" }).click();

    // SCRUM-208: the event's page, open on its Clarification tab.
    const dialog = page.getByTestId("event-page");
    const tab = dialog.getByRole("tab", { name: /^Clarification/ });
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await expect(dialog.getByTestId("clarification-thread")).toContainText(
      "How many guests need step-free access?",
    );
    // The tabs share the page's full width: the first starts at its left
    // edge and the last ends at its right.
    const list = (await dialog.getByRole("tablist").boundingBox())!;
    const tabs = dialog.getByRole("tab");
    const first = (await tabs.first().boundingBox())!;
    const last = (await tabs.last().boundingBox())!;
    expect(first.x).toBeLessThanOrEqual(list.x + 2);
    expect(last.x + last.width).toBeGreaterThanOrEqual(list.x + list.width - 2);
  });

  test("SCRUM-207 TC-207-15: notifications are reached from one bell, beside the user's name", async ({
    browser,
  }) => {
    const page = await signedIn(browser, "organiser@test.local");

    // Change 9: no Notifications link in the side menu; the bell remains.
    const nav = page.getByRole("complementary", { name: "Primary" });
    await expect(nav.getByRole("link", { name: /Notifications/ })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("link", { name: /^Notifications, / }),
    ).toHaveCount(1);
  });
});

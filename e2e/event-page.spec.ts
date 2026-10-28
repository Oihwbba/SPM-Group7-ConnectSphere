import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";

import { openEvent, signedIn, usesLocalDatabase } from "./helpers";

/**
 * SCRUM-208 — one page per event, not a pop-up. Each test writes its own
 * event: Under Review with an open question from the Coordinator, so the
 * Organiser's next step is to answer it.
 */
const PREFIX = "SCRUM-208 Event page";

async function underReviewWithQuestion(name: string, over: object = {}, question = true) {
  const event = await prisma.event.create({
    data: {
      name,
      purpose: "Event page journey",
      description: "Owned by the SCRUM-208 e2e spec.",
      status: "UNDER_REVIEW",
      organiserId: "usr_organiser",
      coordinatorId: "usr_coordinator",
      startAt: new Date("2037-04-06T01:00:00Z"),
      endAt: new Date("2037-04-06T09:00:00Z"),
      expectedAttendance: 80,
      venueRequirements: "Any hall",
      requiredFacilities: [],
      accessibilityNeeds: "None",
      preferredLayout: "Theatre",
      equipmentRequirements: "None",
      registrationNotes: "None",
      registrationRequired: true,
      submittedAt: new Date(),
      ...over,
    },
    select: { id: true },
  });
  if (!question) return event.id;
  await prisma.clarificationRequest.create({
    data: {
      eventId: event.id,
      requestedById: "usr_coordinator",
      message: "Which hall did you have in mind?",
      editableFields: ["expectedAttendance"],
    },
  });
  return event.id;
}

const tab = (page: Page, name: string) =>
  page.getByTestId("event-page").getByRole("tab", { name: new RegExp(`^${name}`) });

test.describe("SCRUM-208 — One page per event, not a pop-up", () => {
  test.describe.configure({ timeout: 90_000 });
  test.skip(!usesLocalDatabase, "writes its own events; local database only");

  test.afterAll(async () => {
    await prisma.booking.deleteMany({ where: { event: { name: { startsWith: PREFIX } } } });
    await prisma.event.deleteMany({ where: { name: { startsWith: PREFIX } } });
  });

  test("SCRUM-208 [AC1, AC2] TC-208-01, TC-208-02, TC-208-03: the event opens on its own page; the top says its state, who handles it, and that answering is the Organiser's turn", async ({
    browser,
  }) => {
    const name = `${PREFIX} top ${Date.now()}`;
    const id = await underReviewWithQuestion(name);
    const page = await signedIn(browser, "organiser@test.local");

    const event = await openEvent(page, name);
    // AC1: its own link, and no pop-up.
    await expect(page).toHaveURL(new RegExp(`/events/${id}`));
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Back to My Events" })).toBeVisible();

    // AC2: the name as the title, and the status once, as the badge.
    await expect(event.getByRole("heading", { level: 1 })).toHaveText(name);
    await expect(event.getByTestId("status-badge")).toHaveCount(1);
    // AC2: the status as the step it has reached.
    await expect(event.getByTestId("status-badge").locator('[aria-current="step"]')).toContainText(
      "Review",
    );
    // AC2: who is handling it, beside the next step.
    await expect(event.getByTestId("current-coordinator")).toContainText(
      "Handled by Cody Coordinator",
    );

    // AC2: the Organiser's turn, with a way straight there.
    const step = event.getByTestId("next-step");
    await expect(step).toHaveAttribute("data-kind", "yours");
    await expect(step).toContainText("Your turn: answer the Coordinator's question");
    // AC3: the tab holding it opens first, and is marked for attention.
    await expect(tab(page, "Clarification")).toHaveAttribute("aria-selected", "true");
    await expect(tab(page, "Clarification").getByTestId("tab-attention")).toHaveCount(1);
    // The key facts are on the Request tab, as a strip of stats.
    await tab(page, "Request").click();
    await expect(event.getByTestId("request-schedule")).toContainText("80 attendees");
    await step.getByRole("button", { name: "Answer the question" }).click();
    await expect(tab(page, "Clarification")).toHaveAttribute("aria-selected", "true");
  });

  test("SCRUM-208 [AC2, AC3, AC4] TC-208-03, TC-208-11: the Organiser has the answer box under the open question; the Coordinator waits, with no box and no button", async ({
    browser,
  }) => {
    const name = `${PREFIX} answer ${Date.now()}`;
    await underReviewWithQuestion(name);

    const organiser = await signedIn(browser, "organiser@test.local");
    const mine = await openEvent(organiser, name, "Clarification");
    await expect(mine.getByTestId("clarification-thread")).toContainText(
      "Which hall did you have in mind?",
    );
    await expect(mine.getByTestId("clarification-thread")).toContainText("Cody Coordinator");
    await expect(mine.getByTestId("clarification-fields")).toHaveText(
      "You can also update: Expected attendance.",
    );
    await expect(mine.getByLabel("Response to clarification")).toBeVisible();

    const coordinator = await signedIn(browser, "coordinator@test.local");
    const theirs = await openEvent(coordinator, name, "Clarification");
    await expect(theirs.getByTestId("clarification-thread")).toContainText(
      "Which hall did you have in mind?",
    );
    await expect(theirs.getByLabel("Response to clarification")).toHaveCount(0);
    const step = theirs.getByTestId("next-step");
    await expect(step).toHaveAttribute("data-kind", "waiting");
    await expect(step).toContainText("Waiting for Olivia Organiser to answer your question");
    await expect(step.getByRole("button")).toHaveCount(0);
    await expect(coordinator.getByRole("link", { name: "Back to Events" })).toBeVisible();
  });

  test("SCRUM-208 [AC3] TC-208-09, TC-208-10: the open tab is part of the link, so a shared link and a refresh keep it", async ({
    browser,
  }) => {
    const name = `${PREFIX} link ${Date.now()}`;
    const id = await underReviewWithQuestion(name);
    const page = await signedIn(browser, "organiser@test.local");

    // A shared link opens the tab it names.
    await page.goto(`/events/${id}?tab=notes`);
    await expect(tab(page, "Notes")).toHaveAttribute("aria-selected", "true");

    // Choosing a tab writes it into the link; a refresh keeps it.
    await tab(page, "Request").click();
    await expect(page).toHaveURL(new RegExp(`/events/${id}\\?tab=request$`));
    await page.reload();
    await expect(tab(page, "Request")).toHaveAttribute("aria-selected", "true");

    // A link naming no tab of the page falls back to the next step's tab.
    await page.goto(`/events/${id}?tab=nonsense`);
    await expect(tab(page, "Clarification")).toHaveAttribute("aria-selected", "true");
  });

  test("SCRUM-208 [AC3, AC4] TC-208-12: a tab that can't apply is hidden; an empty one says so in one line", async ({
    browser,
  }) => {
    const name = `${PREFIX} tabs ${Date.now()}`;
    await underReviewWithQuestion(name, { registrationRequired: false }, false);
    const page = await signedIn(browser, "organiser@test.local");
    const event = await openEvent(page, name);

    // No registration needed: the Registrations tab can never apply.
    await expect(tab(page, "Registrations")).toHaveCount(0);
    await expect(event.getByRole("tab")).toHaveText([
      "Request",
      /^Clarification/,
      "Arrangements",
      "Changes",
      "Notes",
    ]);
    // Before approval, Arrangements says when they start.
    await tab(page, "Arrangements").click();
    await expect(event.getByRole("tabpanel")).toHaveText(
      "Arrangements start once the request is approved.",
    );
    // No question yet: the thread says so.
    await tab(page, "Clarification").click();
    await expect(event.getByRole("tabpanel")).toHaveText("No questions from the Coordinator.");
  });

  test("SCRUM-208 [AC2] TC-208-04: a request under review is the Coordinator's to decide in the banner; approving keeps the page open", async ({
    browser,
  }) => {
    const name = `${PREFIX} review ${Date.now()}`;
    const id = await underReviewWithQuestion(name, {}, false);

    const organiser = await signedIn(browser, "organiser@test.local");
    const waiting = (await openEvent(organiser, name)).getByTestId("next-step");
    await expect(waiting).toContainText("Waiting for Cody Coordinator to review the request");
    await expect(waiting.getByRole("button")).toHaveCount(0);

    const coordinator = await signedIn(browser, "coordinator@test.local");
    const event = await openEvent(coordinator, name);
    const step = event.getByTestId("next-step");
    await expect(step).toContainText(
      "Your turn: review the request, then approve it, reject it or ask a question",
    );
    await expect(step.getByRole("button", { name: "Ask" })).toBeVisible();
    await expect(step.getByRole("button", { name: "Reject" })).toBeVisible();
    await step.getByRole("button", { name: "Approve" }).click();

    // The decision is made, and the page stays, now in Planning.
    await expect(event.getByTestId("status-badge")).toHaveAttribute("data-status", "PLANNING");
    await expect(coordinator).toHaveURL(new RegExp(`/events/${id}`));
    expect((await prisma.event.findUniqueOrThrow({ where: { id } })).status).toBe("PLANNING");
  });

  test("SCRUM-208 [AC5] TC-208-13: another Coordinator's event is the same 404 as one that doesn't exist", async ({
    browser,
  }) => {
    const name = `${PREFIX} other ${Date.now()}`;
    const id = await underReviewWithQuestion(name);
    const page = await signedIn(browser, "coordinator2@test.local");

    const theirs = await page.goto(`/events/${id}`);
    const madeUp = await page.goto("/events/evt_does_not_exist_at_all");
    expect(theirs?.status()).toBe(404);
    expect(madeUp?.status()).toBe(404);
    await expect(page.getByText(name)).toHaveCount(0);
  });

  test("SCRUM-208 [AC1] TC-208-15: an Attendee's event page is unchanged", async ({
    browser,
  }) => {
    const page = await signedIn(browser, "attendee@test.local");
    await page.goto("/events/evt_confirmed");
    await expect(page.getByTestId("registration-state-badge")).toBeVisible();
    await expect(page.getByTestId("event-page")).toHaveCount(0);
  });

  test("SCRUM-208 TC-208-14: on a phone (SCRUM-132) the tabs scroll sideways, the Next step stays above them, and the page itself never scrolls sideways", async ({
    browser,
  }) => {
    const name = `${PREFIX} phone ${Date.now()}`;
    await underReviewWithQuestion(name);
    const context = await browser.newContext({ viewport: { width: 360, height: 740 } });
    const page = await context.newPage();
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill("organiser@test.local");
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/events");

    const event = await openEvent(page, name);
    const tablist = event.getByRole("tablist");
    expect(
      await tablist.evaluate((list) => list.scrollWidth > list.clientWidth),
    ).toBe(true);
    const banner = (await event.getByTestId("next-step").boundingBox())!;
    const tabs = (await tablist.boundingBox())!;
    expect(banner.y + banner.height).toBeLessThanOrEqual(tabs.y);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
    ).toBe(false);
    await context.close();
  });

  /** A Completed event, its venue flagged and never resolved (or not flagged). */
  async function completedEvent(name: string, flagged: boolean) {
    const id = await underReviewWithQuestion(name, { status: "COMPLETED" }, false);
    if (flagged) {
      await prisma.booking.create({
        data: {
          eventId: id,
          venueId: "ven_seminar",
          startAt: new Date("2036-10-05T01:00:00Z"),
          endAt: new Date("2036-10-05T05:00:00Z"),
          status: "APPROVED",
          requestedAttendance: 40,
          requestedById: "usr_coordinator",
          decidedById: "usr_venuestaff",
          decidedAt: new Date(),
          needsReconsideration: true,
          reconsiderationFlaggedAt: new Date(),
          reconsiderationReason: "The venue's capacity was lowered.",
        },
      });
    }
    return id;
  }

  test("SCRUM-208 [AC3, AC4] TC-208-18: a Completed event's unresolved flag is listed on Changes, read-only and closed; the Organiser sees it without the reason", async ({
    browser,
  }) => {
    const name = `${PREFIX} flagged ${Date.now()}`;
    const id = await completedEvent(name, true);

    const coordinator = await signedIn(browser, "coordinator@test.local");
    await coordinator.goto(`/events/${id}?tab=changes`);
    const flags = coordinator.getByTestId("reconsideration-panel");
    await expect(flags).toHaveAttribute("data-read-only", "true");
    await expect(flags).toContainText("Seminar Room 2.1");
    await expect(flags).toContainText("The venue's capacity was lowered.");
    await expect(flags.getByTestId("flags-note")).toHaveText(
      "This event is closed, so these flags can no longer be resolved.",
    );
    await expect(flags.getByRole("button")).toHaveCount(0);
    await expect(coordinator.getByText(/nothing flagged/)).toHaveCount(0);

    // SCRUM-131 AC3: the Organiser sees the flag, not Venue Staff's reason.
    const organiser = await signedIn(browser, "organiser@test.local");
    await organiser.goto(`/events/${id}?tab=changes`);
    const theirs = organiser.getByTestId("reconsideration-panel");
    await expect(theirs).toContainText("Seminar Room 2.1");
    await expect(theirs).not.toContainText("The venue's capacity was lowered.");
    await expect(theirs.getByRole("button")).toHaveCount(0);
    await expect(organiser.getByText(/nothing flagged/)).toHaveCount(0);
  });

  test("SCRUM-208 [AC4] TC-208-19: with no change requests and nothing flagged, Changes says so in one line", async ({
    browser,
  }) => {
    const name = `${PREFIX} quiet ${Date.now()}`;
    const id = await completedEvent(name, false);

    for (const email of ["coordinator@test.local", "organiser@test.local"]) {
      const page = await signedIn(browser, email);
      await page.goto(`/events/${id}?tab=changes`);
      await expect(page.getByTestId("event-page").getByRole("tabpanel")).toHaveText(
        "No change requests, and nothing flagged Needs Reconsideration.",
      );
    }
  });

  test("SCRUM-208 [AC4] TC-208-20: a registrations list that can't load says so under its header, rather than leaving the tab blank", async ({
    browser,
  }) => {
    const name = `${PREFIX} registrations ${Date.now()}`;
    const id = await underReviewWithQuestion(
      name,
      { status: "PLANNING", registrationRequired: true },
      false,
    );
    const page = await signedIn(browser, "organiser@test.local");
    await page.goto(`/events/${id}?tab=request`);
    await expect(tab(page, "Registrations")).toBeVisible();
    // Every server action from here fails, as with a lost connection.
    await page.route("**/*", (route) =>
      route.request().headers()["next-action"] ? route.abort() : route.continue(),
    );

    await tab(page, "Registrations").click();
    const pending = page.getByTestId("registration-list-pending");
    await expect(pending).toContainText("Registrations");
    await expect(pending).toContainText("Couldn't load the registrations.");
  });
});

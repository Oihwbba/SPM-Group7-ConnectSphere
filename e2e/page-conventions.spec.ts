import { test, expect, type Locator, type Page } from "@playwright/test";
import type { Role } from "@prisma/client";

import { prisma } from "@/lib/db";
import { NAV_BY_ROLE } from "@/lib/nav";
import { signedIn, usesLocalDatabase } from "./helpers";

/**
 * SCRUM-207 AC1, AC2, AC4, AC5 — every page's title, description and back
 * link; the Coordinator's Awaiting review view; errors inline; every
 * irreversible action asking in the shared dialog.
 * Test cases: docs/testing/SCRUM-207.md (TC-207-01, -02, -09, -10, -30, -31).
 */

const ACCOUNTS: { role: Role; email: string }[] = [
  { role: "ORGANISER", email: "organiser@test.local" },
  { role: "COORDINATOR", email: "coordinator@test.local" },
  { role: "VENUE_STAFF", email: "venuestaff@test.local" },
  { role: "TECH_SUPPORT", email: "techsupport@test.local" },
  { role: "ATTENDEE", email: "attendee@test.local" },
  { role: "COORDINATOR_LEAD", email: "lead@test.local" },
  { role: "SAFETY_OFFICER", email: "safety@test.local" },
];

/** One title, and one line under it saying what the page is for. */
async function expectTitleAndDescription(page: Page) {
  await expect(page.locator("h1:visible")).toHaveCount(1);
  const description = page.getByTestId("page-description");
  await expect(description).toBeVisible();
  const text = (await description.innerText()).trim();
  expect(text.length, "the description says something").toBeGreaterThan(10);
  // One sentence: no full stop followed by another sentence.
  expect(text, "the description is one sentence").not.toMatch(/[.!?]\s+\S/);
}

test.describe("SCRUM-207 [AC1] every page's title, description and back link", () => {
  for (const { role, email } of ACCOUNTS) {
    test(`SCRUM-207 [AC1] TC-207-01, TC-207-02: ${role}'s menu pages each have one title, a one-line description and no back link`, async ({
      browser,
    }) => {
      const page = await signedIn(browser, email);
      for (const { href } of NAV_BY_ROLE[role]) {
        await page.goto(href);
        await expectTitleAndDescription(page);
        await expect(page.getByTestId("back-link"), href).toHaveCount(0);
      }
    });
  }

  const detailPages: {
    name: string;
    email: string;
    path: string;
    back: string;
    to: RegExp;
  }[] = [
    {
      name: "Notifications, for an Organiser",
      email: "organiser@test.local",
      path: "/notifications",
      back: "Back to My Events",
      to: /\/events$/,
    },
    {
      name: "Notifications, for Venue Staff",
      email: "venuestaff@test.local",
      path: "/notifications",
      back: "Back to Bookings",
      to: /\/bookings$/,
    },
    {
      name: "an event's page, for its Organiser",
      email: "organiser@test.local",
      path: "/events/evt_planning",
      back: "Back to My Events",
      to: /\/events$/,
    },
    {
      name: "an event's page, for its Coordinator",
      email: "coordinator@test.local",
      path: "/events/evt_planning",
      back: "Back to Events",
      to: /\/events$/,
    },
    {
      name: "an event's page, for an Attendee",
      email: "attendee@test.local",
      path: "/events/evt_confirmed",
      back: "Back to Browse Events",
      to: /\/events$/,
    },
    {
      name: "an event in All Events",
      email: "lead@test.local",
      path: "/all-events/evt_planning",
      back: "Back to All Events",
      to: /\/all-events$/,
    },
    {
      name: "a venue's page",
      email: "venuestaff@test.local",
      path: "/venues/ven_auditorium",
      back: "Back to Venue Catalogue",
      to: /\/venues$/,
    },
  ];

  for (const { name, email, path, back, to } of detailPages) {
    test(`SCRUM-207 [AC1] TC-207-01, TC-207-02: ${name} has one title, a one-line description, and a back link that leads back`, async ({
      browser,
    }) => {
      const page = await signedIn(browser, email);
      await page.goto(path);
      await expectTitleAndDescription(page);
      const link = page.getByTestId("back-link");
      await expect(link).toHaveText(back);
      await link.click();
      await expect(page).toHaveURL(to);
      await expect(page.locator("h1:visible")).toHaveCount(1);
    });
  }
});

/**
 * SCRUM-207 AC4 — an error appears inline, at the form that failed, and says
 * what to do next; it is not only a toast in the corner.
 */
test.describe("SCRUM-207 [AC1] the app's own not-found page", () => {
  for (const [what, path] of [
    ["an address that matches no page", "/no-such-page"],
    ["a venue that doesn't exist, inside the app", "/venues/no-such-venue"],
  ]) {
    test(`SCRUM-207 [AC1] TC-207-01: ${what} shows one title, says what to do, and leads home`, async ({
      browser,
    }) => {
      const page = await signedIn(browser, "venuestaff@test.local");
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
      const notFound = page.getByTestId("not-found");
      await expect(notFound.getByRole("heading", { level: 1 })).toHaveText("This page doesn't exist");
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await notFound.getByRole("link", { name: "Go to my home page" }).click();
      await expect(page).toHaveURL(/\/bookings$/);
    });
  }
});

test.describe("SCRUM-207 [AC4] messages in one place", () => {
  test("SCRUM-207 [AC4] TC-207-09: a form's error appears inline, in the form, saying what to do next", async ({
    browser,
  }) => {
    const page = await signedIn(browser, "venuestaff@test.local");
    await page.goto("/venues");
    await page.getByRole("button", { name: "Add venue" }).click();
    const form = page.getByRole("dialog");
    // Nothing filled in: refused before anything is sent.
    await form
      .getByRole("button", { name: /^(Add|Save|Create)/ })
      .last()
      .click();
    const error = form.getByTestId("action-error");
    await expect(error).toBeVisible();
    await expect(error).toHaveText(/fix|try again|refresh|choose|enter/i);
    // Not a toast: Sonner's region holds no error.
    await expect(
      page.locator("[data-sonner-toast][data-type='error']"),
    ).toHaveCount(0);
  });
});

/**
 * SCRUM-207 AC2 — the Coordinator's one-click Awaiting review view, kept by
 * the PO (2 Nov 2026) when the tabs became the status filter. Each row still
 * shows its own status; only the Organiser's list may not group statuses
 * (SCRUM-131 AC1). Writes three requests of its own, so local database only.
 */
test.describe("SCRUM-207 [AC2] the Coordinator's Awaiting review view", () => {
  test.skip(!usesLocalDatabase, "writes its own events; local database only");

  const prefix = "SCRUM-207 Awaiting review";
  const remove = () =>
    prisma.event.deleteMany({ where: { name: { startsWith: prefix } } });
  test.beforeAll(remove);
  test.afterAll(remove);

  test("SCRUM-207 [AC2] TC-207-30: the Coordinator's Awaiting review option lists Submitted and Under Review together", async ({
    browser,
  }) => {
    const request = (status: "SUBMITTED" | "UNDER_REVIEW" | "PLANNING") => ({
      name: `${prefix} ${status} ${Date.now()}`,
      purpose: "SCRUM-207 e2e",
      description: "Owned by the SCRUM-207 page-conventions spec.",
      status,
      organiserId: "usr_organiser",
      coordinatorId: "usr_coordinator",
      startAt: new Date("2031-09-01T02:00:00Z"),
      endAt: new Date("2031-09-01T10:00:00Z"),
      expectedAttendance: 50,
      requiredFacilities: [],
      submittedAt: new Date(),
    });
    // A resubmitted amendment is Submitted and keeps its Coordinator
    // (SCRUM-108), so their list can hold both statuses, and others besides.
    const submitted = await prisma.event.create({ data: request("SUBMITTED") });
    const underReview = await prisma.event.create({
      data: request("UNDER_REVIEW"),
    });
    const planning = await prisma.event.create({ data: request("PLANNING") });
    const rowOf = (page: Page, name: string) =>
      page.getByRole("row").filter({ hasText: name });

    const page = await signedIn(browser, "coordinator@test.local");
    await page.goto("/events");
    await expect(rowOf(page, planning.name)).toBeVisible();

    // The count is every Submitted and Under Review request in their list.
    const awaiting = await prisma.event.count({
      where: {
        coordinatorId: "usr_coordinator",
        status: { in: ["SUBMITTED", "UNDER_REVIEW"] },
      },
    });
    const option = page.getByRole("button", { name: /^Awaiting review \(/ });
    await expect(option).toHaveText(`Awaiting review (${awaiting})`);
    await expect(option).toHaveAttribute("aria-pressed", "false");
    // The status dropdown stays beside it, unchanged.
    await expect(
      page.getByRole("combobox", { name: "Filter by status" }),
    ).toHaveText(/All Statuses/);

    await option.click();
    await expect(option).toHaveAttribute("aria-pressed", "true");
    await expect(rowOf(page, planning.name)).toHaveCount(0);
    await expect(
      rowOf(page, submitted.name).getByText("Submitted", { exact: true }),
    ).toBeVisible();
    await expect(
      rowOf(page, underReview.name).getByText("Under Review", { exact: true }),
    ).toBeVisible();
    const rows = page.locator("tr[data-status]");
    await expect(rows).toHaveCount(awaiting);
    expect(
      new Set(await rows.evaluateAll((els) => els.map((el) => el.dataset.status))),
    ).toEqual(new Set(["SUBMITTED", "UNDER_REVIEW"]));

    // One more click shows the whole list again.
    await option.click();
    await expect(rowOf(page, planning.name)).toBeVisible();

    // SCRUM-131 AC1: the Organiser's list has no such view.
    const organiser = await signedIn(browser, "organiser@test.local");
    await organiser.goto("/events");
    await expect(
      organiser.getByRole("combobox", { name: "Filter by status" }),
    ).toBeVisible();
    await expect(
      organiser.getByRole("button", { name: /Awaiting review/ }),
    ).toHaveCount(0);
  });
});

/**
 * SCRUM-207 AC5 — every action that can't be undone asks in the one shared
 * dialog, and its way back changes nothing. Each test opens the dialog,
 * chooses the way back, and checks the record is as it was. Writes nothing
 * when it passes, but runs on a local database only, in case it doesn't.
 */
test.describe("SCRUM-207 [AC5] irreversible actions ask in the shared dialog", () => {
  test.skip(!usesLocalDatabase, "local database only");

  /** Opens the shared dialog, checks its title, and chooses the way back. */
  async function backOutOf(page: Page, open: Locator, title: string | RegExp) {
    await open.click();
    const dialog = page
      .getByRole("dialog")
      .filter({ has: page.getByTestId("confirm-dialog-cancel") });
    await expect(dialog.getByRole("heading", { name: title })).toBeVisible();
    await expect(dialog.getByTestId("confirm-dialog-confirm")).toBeVisible();
    await dialog.getByTestId("confirm-dialog-cancel").click();
    await expect(dialog).toHaveCount(0);
  }

  const eventStatus = async (id: string) =>
    (await prisma.event.findUniqueOrThrow({ where: { id } })).status;
  const bookingStatus = async (id: string) =>
    (await prisma.booking.findUniqueOrThrow({ where: { id } })).status;

  test("SCRUM-207 [AC5] TC-207-10: the Organiser's Discard Draft asks first; Keep Draft changes nothing", async ({
    browser,
  }) => {
    const page = await signedIn(browser, "organiser@test.local");
    await page.goto("/events");
    const row = page
      .getByRole("row")
      .filter({ hasText: "Annual Tech Summit" });
    await backOutOf(
      page,
      row.getByRole("button", { name: "Discard" }),
      "Discard this draft?",
    );
    expect(
      (await prisma.event.findUniqueOrThrow({ where: { id: "evt_draft" } }))
        .discardedAt,
    ).toBeNull();
  });

  test("SCRUM-207 [AC5] TC-207-10: the Coordinator's Reject on a request, Cancel event and Reject event each ask first; the way back changes nothing", async ({
    browser,
  }) => {
    const page = await signedIn(browser, "coordinator@test.local");
    await page.goto("/events");
    const row = page
      .getByRole("row")
      .filter({ hasText: "Career Fair" });
    await backOutOf(
      page,
      row.getByRole("button", { name: "Reject" }),
      "Reject event request",
    );
    expect(await eventStatus("evt_under_review")).toBe("UNDER_REVIEW");

    await page.goto("/events/evt_planning?tab=arrangements");
    await backOutOf(
      page,
      page.getByRole("button", { name: "Cancel event" }),
      "Cancel this event",
    );
    await backOutOf(
      page,
      page.getByRole("button", { name: "Reject event" }),
      "Reject this event",
    );
    expect(await eventStatus("evt_planning")).toBe("PLANNING");
  });

  test("SCRUM-207 [AC5] TC-207-10: the Coordinator's Release hold, Withdraw a venue or equipment request, and Cancel arrangement each ask first; the way back changes nothing", async ({
    browser,
  }) => {
    const page = await signedIn(browser, "coordinator@test.local");
    await page.goto("/events/evt_hold?tab=arrangements");
    await backOutOf(
      page,
      page.getByRole("button", { name: "Release hold" }),
      "Release this hold?",
    );
    expect(await bookingStatus("bkg_held")).toBe("HELD");

    await page.goto("/events/evt_planning?tab=arrangements");
    await backOutOf(
      page,
      page.getByRole("button", { name: "Withdraw request", exact: true }),
      "Withdraw this venue request?",
    );
    expect(await bookingStatus("bkg_pending")).toBe("PENDING");

    await page.goto("/events/evt_equipment_in_review?tab=arrangements");
    await backOutOf(
      page,
      page.getByRole("button", { name: "Withdraw", exact: true }),
      "Withdraw this equipment request?",
    );
    expect(
      (
        await prisma.equipmentRequest.findUniqueOrThrow({
          where: { id: "eqr_in_review" },
        })
      ).status,
    ).toBe("IN_REVIEW");

    await page.goto("/events/evt_flagged?tab=changes");
    await backOutOf(
      page,
      page.getByRole("button", { name: "Cancel arrangement" }).first(),
      /^Cancel /,
    );
    expect(
      (await prisma.booking.findUniqueOrThrow({ where: { id: "bkg_flagged" } }))
        .needsReconsideration,
    ).toBe(true);
  });

  test("SCRUM-207 [AC5] TC-207-10: the Coordinator's decision on a change request asks first; the way back changes nothing", async ({
    browser,
  }) => {
    const page = await signedIn(browser, "coordinator@test.local");
    await page.goto("/events/evt_cancellation_requested?tab=changes");
    const decision = page.getByTestId("change-request-decision");
    await backOutOf(
      page,
      decision.getByRole("button", { name: "Approve" }),
      "Approve the cancellation?",
    );
    await backOutOf(
      page,
      decision.getByRole("button", { name: "Reject" }),
      "Reject this change request?",
    );
    expect(
      (
        await prisma.eventChangeRequest.findUniqueOrThrow({
          where: { id: "chg_cancellation" },
        })
      ).status,
    ).toBe("PENDING_REVIEW");
    expect(await eventStatus("evt_cancellation_requested")).toBe("CONFIRMED");
  });

  test("SCRUM-207 [AC5] TC-207-10: Venue Staff's Retire venue and Reject a booking, Technical Support's Reject and the Safety Officer's Approve each ask first; the way back changes nothing", async ({
    browser,
  }) => {
    const staff = await signedIn(browser, "venuestaff@test.local");
    await staff.goto("/venues/ven_auditorium");
    await backOutOf(
      staff,
      staff.getByRole("button", { name: "Retire venue" }),
      /^Retire /,
    );
    expect(
      (
        await prisma.venue.findUniqueOrThrow({
          where: { id: "ven_auditorium" },
        })
      ).isActive,
    ).toBe(true);
    await staff.goto("/bookings?status=all&open=bkg_pending");
    await backOutOf(
      staff,
      staff.getByRole("button", { name: "Reject" }),
      "Reject booking request",
    );
    expect(await bookingStatus("bkg_pending")).toBe("PENDING");

    const tech = await signedIn(browser, "techsupport@test.local");
    await tech.goto("/equipment-requests?status=all&open=eqr_in_review");
    await backOutOf(
      tech,
      tech.getByRole("button", { name: "Reject" }),
      "Reject this equipment request?",
    );
    expect(
      (
        await prisma.equipmentRequest.findUniqueOrThrow({
          where: { id: "eqr_in_review" },
        })
      ).status,
    ).toBe("IN_REVIEW");

    const safety = await signedIn(browser, "safety@test.local");
    await safety.goto("/safety-checks?status=all&open=sfc_awaiting");
    await backOutOf(
      safety,
      safety.getByRole("button", { name: "Approve" }),
      "Approve this safety check?",
    );
    expect(
      (
        await prisma.safetyCheck.findUniqueOrThrow({
          where: { id: "sfc_awaiting" },
        })
      ).status,
    ).toBe("AWAITING_REVIEW");
  });

  test("SCRUM-207 [AC4, AC5] TC-207-31: a too-long Approve note is refused inside its confirmation dialog, saying what to do next, and nothing is recorded", async ({
    browser,
  }) => {
    const history = { where: { entityId: "sfc_awaiting" } };
    const historyBefore = await prisma.auditLog.count(history);
    const safety = await signedIn(browser, "safety@test.local");
    await safety.goto("/safety-checks?status=all&open=sfc_awaiting");
    const panel = safety.getByTestId("safety-check-outcome");
    // The note is asked for in the dialog, not on the page behind it.
    await expect(panel.getByRole("textbox")).toHaveCount(0);
    await panel.getByRole("button", { name: "Approve" }).click();
    const dialog = safety.getByRole("dialog", {
      name: "Approve this safety check?",
    });
    await expect(dialog).not.toContainText("above");

    const tooLong = "x".repeat(2001);
    const note = dialog.getByLabel(/^Note/);
    await note.fill(tooLong);
    await dialog.getByTestId("confirm-dialog-confirm").click();
    // SCRUM-264's limit, and AC4's next step, inside the dialog.
    await expect(
      dialog.getByText("Keep the note under 2000 characters."),
    ).toBeVisible();
    await expect(note).toHaveAttribute("aria-invalid", "true");
    await expect(note).toHaveValue(tooLong);

    expect(
      await prisma.safetyCheck.findUniqueOrThrow({
        where: { id: "sfc_awaiting" },
      }),
    ).toMatchObject({ status: "AWAITING_REVIEW", note: null, decidedAt: null });
    expect(await prisma.auditLog.count(history)).toBe(historyBefore);
  });
});

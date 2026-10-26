import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";

import { usesLocalDatabase, openEvent } from "./helpers";

/**
 * SCRUM-128 — the assigned Coordinator decides an Organiser's change request
 * from the event's details. Each test creates its own event and Submitted
 * change request straight in the database, as SCRUM-41 records them. Test
 * cases: docs/testing/SCRUM-128.md.
 */

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/events");
}

/** SCRUM-208: the event's page, on the tab this journey works in. */
async function openDetails(page: Page, name: string, tab = "Changes") {
  return openEvent(page, name, tab);
}

const PERIOD = {
  startAt: new Date("2033-02-01T02:00:00Z"),
  endAt: new Date("2033-02-01T06:00:00Z"),
};

let eventId: string;

async function eventWithRequest(name: string, requestsCancellation = false) {
  const event = await prisma.event.create({
    data: {
      name,
      purpose: "SCRUM-128 journey",
      description: "Owned by the SCRUM-128 e2e spec.",
      status: "CONFIRMED",
      organiserId: "usr_organiser",
      coordinatorId: "usr_coordinator",
      ...PERIOD,
      expectedAttendance: 40,
      submittedAt: new Date(),
    },
    select: { id: true },
  });
  eventId = event.id;
  await prisma.booking.create({
    data: {
      eventId,
      venueId: "ven_hall",
      ...PERIOD,
      status: "APPROVED",
      requestedById: "usr_coordinator",
      decidedById: "usr_venuestaff",
      decidedAt: new Date(),
    },
  });
  await prisma.eventChangeRequest.create({
    data: requestsCancellation
      ? {
          eventId,
          requestedById: "usr_organiser",
          reason: "The sponsor pulled out.",
          requestsCancellation: true,
        }
      : {
          eventId,
          requestedById: "usr_organiser",
          reason: "More people signed up.",
          fields: {
            create: [
              { fieldName: "expectedAttendance", oldValue: "40", newValue: "60", isMajor: true },
            ],
          },
        },
  });
}

test.describe("SCRUM-128 — Decide a change request and apply it in one step", () => {
  test.skip(!usesLocalDatabase, "writes its own events; local database only");

  test.afterEach(async () => {
    const bookings = await prisma.booking.findMany({ where: { eventId }, select: { id: true } });
    const requests = await prisma.eventChangeRequest.findMany({ where: { eventId }, select: { id: true } });
    await prisma.auditLog.deleteMany({
      where: {
        entityId: { in: [eventId, ...bookings.map((b) => b.id), ...requests.map((r) => r.id)] },
      },
    });
    await prisma.notification.deleteMany({ where: { eventId } });
    await prisma.booking.deleteMany({ where: { eventId } });
    await prisma.event.deleteMany({ where: { id: eventId } });
  });

  test("SCRUM-128 [AC1, AC2, AC4, AC5] TC-128-13, SCRUM-208 [AC2] TC-208-06: the Coordinator sees the current and requested values and what's affected, approves, and the Confirmed event returns to Planning with its booking flagged", async ({
    page,
  }) => {
    const name = `SCRUM-128 Approve ${Date.now()}`;
    await eventWithRequest(name);

    await signIn(page, "coordinator@test.local");
    const dialog = await openDetails(page, name);
    // SCRUM-208 AC2, AC3: the request waiting on the Coordinator is counted on its tab.
    await expect(
      dialog.getByRole("tab", { name: /^Changes/ }).getByTestId("tab-attention"),
    ).toContainText("1");
    const decision = dialog.getByTestId("change-request-decision");
    await expect(decision.getByRole("row", { name: /Expected attendance/ })).toContainText("40");
    await expect(decision.getByRole("row", { name: /Expected attendance/ })).toContainText("60");
    await expect(decision.getByTestId("potentially-affected")).toContainText(
      "Exhibition Hall (Approved)",
    );

    await decision.getByRole("button", { name: "Approve" }).click();
    await expect(
      page.getByText(
        "Change request approved. The event is back in Planning and its arrangements are flagged.",
      ),
    ).toBeVisible();

    expect(await prisma.event.findUniqueOrThrow({ where: { id: eventId } })).toMatchObject({
      expectedAttendance: 60,
      status: "PLANNING",
    });
    expect(
      (await prisma.booking.findFirstOrThrow({ where: { eventId } })).needsReconsideration,
    ).toBe(true);

    // SCRUM-45 AC5: the Organiser is told, once, in their own list, why.
    await signIn(page, "organiser@test.local");
    await page.goto("/notifications");
    const back = page
      .getByTestId("notification")
      .filter({ hasText: "Your event is back in Planning" })
      .filter({ hasText: name });
    await expect(back).toHaveCount(1);
    await expect(back).toContainText("a change to Expected attendance was approved");
  });

  test("SCRUM-128 [AC3, AC9, AC10] TC-128-14: rejecting needs a reason, which the Organiser then sees; the Organiser can't decide", async ({
    page,
  }) => {
    const name = `SCRUM-128 Reject ${Date.now()}`;
    const REASON = "No larger room is free that day.";
    await eventWithRequest(name);

    // AC9: the Organiser sees their request but no way to decide it.
    await signIn(page, "organiser@test.local");
    let dialog = await openDetails(page, name);
    await expect(dialog.getByTestId("change-request")).toBeVisible();
    await expect(dialog.getByTestId("change-request-decision")).toHaveCount(0);

    await signIn(page, "coordinator@test.local");
    dialog = await openDetails(page, name);
    const decision = dialog.getByTestId("change-request-decision");
    await decision.getByRole("button", { name: "Reject" }).click();
    const confirmReject = decision.getByRole("button", { name: "Reject change request" });
    // Failure path (AC3): no reason, no rejection.
    await expect(confirmReject).toBeDisabled();
    await decision.getByLabel("Reason for rejecting the change request").fill(REASON);
    await confirmReject.click();
    await expect(
      page.getByText("Change request rejected. The organiser has been told why."),
    ).toBeVisible();
    expect((await prisma.event.findUniqueOrThrow({ where: { id: eventId } })).expectedAttendance).toBe(40);

    // AC10: the Organiser sees it was rejected and why.
    await signIn(page, "organiser@test.local");
    dialog = await openDetails(page, name);
    await expect(dialog.getByTestId("change-request")).toHaveAttribute("data-status", "REJECTED");
    await expect(dialog.getByTestId("change-request")).toContainText(REASON);
  });

  test("SCRUM-128 [AC8] TC-128-07: approving a cancellation request lists what it releases, cancels the event with the Organiser's reason, and the Organiser sees it Cancelled", async ({
    page,
  }) => {
    const name = `SCRUM-128 Cancel ${Date.now()}`;
    await eventWithRequest(name, true);

    await signIn(page, "coordinator@test.local");
    const dialog = await openDetails(page, name);
    const decision = dialog.getByTestId("change-request-decision");
    // A cancellation has no fields to compare, only what it would release.
    await expect(decision.getByRole("table")).toHaveCount(0);
    await expect(decision.getByTestId("potentially-affected")).toContainText("Cancelling releases:");
    await expect(decision.getByTestId("potentially-affected")).toContainText(
      "Exhibition Hall (Approved)",
    );

    await decision.getByRole("button", { name: "Approve" }).click();
    await expect(
      page.getByText("Change request approved. The event is cancelled."),
    ).toBeVisible();
    expect(await prisma.event.findUniqueOrThrow({ where: { id: eventId } })).toMatchObject({
      status: "CANCELLED",
      cancellationReason: "The sponsor pulled out.",
    });
    expect((await prisma.booking.findFirstOrThrow({ where: { eventId } })).status).toBe("CANCELLED");

    await signIn(page, "organiser@test.local");
    const seen = await openDetails(page, name);
    await expect(seen.getByTestId("cancellation-reason")).toContainText("The sponsor pulled out.");
  });

  test("SCRUM-128 [AC1] TC-128-01: if the decision can't be loaded, the Coordinator is told and can try again", async ({
    page,
  }) => {
    const name = `SCRUM-128 Retry ${Date.now()}`;
    await eventWithRequest(name);
    await signIn(page, "coordinator@test.local");

    // Server actions are POSTs to the page with a Next-Action header. Only the
    // decision's own read fails, as a dropped connection would: its view is the
    // one that names what the change could affect. The change request above it
    // still loads.
    let failing = true;
    await page.route("**/events**", async (route) => {
      const request = route.request();
      if (!failing || request.method() !== "POST" || !request.headers()["next-action"]) {
        return route.continue();
      }
      const response = await route.fetch();
      const body = await response.text();
      if (body.includes('"impactful"') && body.includes('"affected"')) {
        return route.abort("failed");
      }
      return route.fulfill({ response, body });
    });
    const dialog = await openDetails(page, name);
    const alert = dialog.getByRole("alert").filter({
      hasText: "Couldn't load the decision for this change request.",
    });
    await expect(alert).toBeVisible();
    await expect(dialog.getByTestId("change-request-decision")).toHaveCount(0);

    failing = false;
    await alert.getByRole("button", { name: "Try again" }).click();
    await expect(
      dialog.getByTestId("change-request-decision").getByRole("button", { name: "Approve" }),
    ).toBeVisible();
  });

  test("SCRUM-128 [AC2] TC-128-10: a decision that never reaches the server says so, and one already made elsewhere refreshes the request instead of offering it again", async ({
    page,
  }) => {
    const name = `SCRUM-128 Lost ${Date.now()}`;
    await eventWithRequest(name);
    await signIn(page, "coordinator@test.local");
    const dialog = await openDetails(page, name);
    const decision = dialog.getByTestId("change-request-decision");
    await expect(decision.getByRole("button", { name: "Approve" })).toBeVisible();

    // The decision's POST carries the decision; it fails as a dropped connection would.
    await page.route("**/events**", (route) =>
      route.request().method() === "POST" && route.request().postData()?.includes('"decision"')
        ? route.abort("failed")
        : route.continue(),
    );
    await decision.getByRole("button", { name: "Approve" }).click();
    await expect(
      page.getByText("The decision couldn't be sent. If the request above isn't decided, try again."),
    ).toBeVisible();
    expect((await prisma.event.findUniqueOrThrow({ where: { id: eventId } })).expectedAttendance).toBe(40);
    await page.unroute("**/events**");
    // The request list is read again after the failure; let that finish (it
    // queues behind the page's own refresh, SCRUM-208) before anything else.
    await page.waitForLoadState("networkidle");
    await expect(decision.getByRole("button", { name: "Approve" })).toBeVisible();

    // Meanwhile it is decided elsewhere (another tab): approving is refused and
    // the request shows as decided, with nothing left to click.
    await prisma.eventChangeRequest.updateMany({
      where: { eventId },
      data: { status: "REJECTED", decidedById: "usr_coordinator", decidedAt: new Date(), decisionReason: "Decided in another tab." },
    });
    await decision.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText(/already Rejected; nothing was changed/)).toBeVisible();
    await expect(dialog.getByTestId("change-request")).toHaveAttribute("data-status", "REJECTED");
    await expect(dialog.getByTestId("change-request-decision")).toHaveCount(0);
  });
});

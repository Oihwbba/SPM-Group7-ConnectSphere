import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";
import { selectFrom, optionsOf, openEquipmentRequest, openReview } from "./helpers";

/**
 * SCRUM-28 — Review and Update Equipment Request. Technical Support reviews a
 * coordinator's request, suggests an alternative for what is unavailable, and
 * approves or rejects it; the coordinator is notified and sees the history.
 *
 * Each test builds its own event and request (the "rig") in a far-future
 * period with no seeded commitments: a Lectern × 5 line (the pool has 4, so
 * it is short) and a Projector × 1 line (which fits). Rigs are removed
 * afterwards. They write to the database, so they only run against a
 * localhost one.
 */
const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);
const RIG = "E2E equipment review";

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

async function openRequests(page: Page, email: string) {
  await signIn(page, email);
  await page.goto("/equipment-requests");
  await expect(
    page.getByRole("heading", { name: "Equipment requests" }),
  ).toBeVisible();
  // Buttons only work once the page has hydrated.
  await page.waitForLoadState("networkidle");
}

async function makeRig(label: string) {
  const event = await prisma.event.create({
    data: {
      name: `${RIG} ${label} ${Date.now()}`,
      status: "APPROVED",
      startAt: new Date("2033-09-10T01:00:00.000Z"),
      endAt: new Date("2033-09-10T09:00:00.000Z"),
      organiserId: "usr_organiser",
      coordinatorId: "usr_coordinator",
    },
    select: { id: true, name: true },
  });
  await prisma.equipmentRequest.create({
    data: {
      eventId: event.id,
      requestedById: "usr_coordinator",
      status: "PENDING_REVIEW",
      notes: "Breakout rooms need their own lecterns.",
      lines: {
        create: [
          {
            equipmentId: "eqp_lectern",
            quantity: 5,
            technicalRequirements: "Gooseneck mic",
          },
          { equipmentId: "eqp_projector", quantity: 1 },
        ],
      },
      updates: {
        create: {
          actorId: "usr_coordinator",
          toStatus: "PENDING_REVIEW",
          note: "Request submitted.",
        },
      },
    },
  });
  return event;
}


test.describe("SCRUM-28 — Review and Update Equipment Request", () => {
  test.skip(
    !usesLocalDatabase,
    "writes rig events, so it needs the local database",
  );

  test.afterEach(async () => {
    await prisma.notification.deleteMany({
      where: { event: { name: { startsWith: RIG } } },
    });
    await prisma.event.deleteMany({ where: { name: { startsWith: RIG } } });
  });

  test("SCRUM-28 [AC1] TC-28-01: a pending request shows every line's equipment details, requirements and availability", async ({
    page,
  }) => {
    const rig = await makeRig("details");
    await openRequests(page, "techsupport@test.local");

    const request = await openReview(page, rig.name);
    await expect(request.getByTestId("request-status")).toHaveText(
      "Pending Review",
    );
    await expect(request).toContainText("Requested by Cody Coordinator");
    await expect(request).toContainText(
      "Breakout rooms need their own lecterns.",
    );

    const lectern = request
      .getByTestId("request-line")
      .filter({ hasText: "Lectern" });
    await expect(lectern).toContainText("Gooseneck mic");
    await expect(lectern.getByTestId("line-availability")).toHaveText(
      /Unavailable: only 4 of 4 free for this event, 1 short\./,
    );

    const projector = request
      .getByTestId("request-line")
      .filter({ hasText: "Projector" });
    await expect(projector).toContainText("Specs: HDMI + USB-C, 1080p");
    await expect(projector.getByTestId("line-availability")).toHaveText(
      "Available: 10 of 10 free for this event.",
    );
  });

  test("SCRUM-28 [AC2, AC3, AC5, AC6] TC-28-02, TC-28-03, TC-28-09, TC-28-10, SCRUM-207 TC-207-24: reviewing then approving updates the status, notifies the coordinator and logs each change", async ({
    page,
  }) => {
    const rig = await makeRig("approve");
    await openRequests(page, "techsupport@test.local");
    const request = await openReview(page, rig.name);

    await request.getByRole("button", { name: "Start review" }).click();
    await expect(
      page.getByText("Review started. The coordinator has been notified."),
    ).toBeVisible();
    await expect(request.getByTestId("request-status")).toHaveText("In Review");

    await request
      .getByLabel("Note for the coordinator")
      .fill("Lecterns swapped for laptops.");
    await request.getByRole("button", { name: "Approve" }).click();
    await expect(
      page.getByText("Request approved. The coordinator has been notified."),
    ).toBeVisible();

    // SCRUM-211 AC4: the request leaves the page for the next one; it is
    // under Decided, with its history.
    await expect(request).toHaveCount(0);
    await page.getByRole("link", { name: "Decided", exact: true }).click();
    const decided = await openReview(page, rig.name);
    await expect(decided.getByTestId("request-status")).toHaveText("Approved");
    await expect(decided.getByTestId("history-entry")).toHaveText([
      /Submitted as Pending Review\s*Request submitted\./,
      /Pending Review → In Review.*by Theo Tech/,
      /In Review → Approved\s*Lecterns swapped for laptops\./,
    ]);

    const notifications = await prisma.notification.findMany({
      where: { event: { name: rig.name } },
      orderBy: { createdAt: "asc" },
    });
    expect(notifications.map((n) => [n.userId, n.type])).toEqual([
      ["usr_coordinator", "EQUIPMENT_REQUEST_UPDATED"],
      ["usr_coordinator", "EQUIPMENT_REQUEST_UPDATED"],
    ]);
    expect(notifications[1].message).toContain("is now Approved");
  });

  test("SCRUM-28 [AC3] TC-28-04: rejecting needs a reason, and the reason is recorded", async ({
    page,
  }) => {
    const rig = await makeRig("reject");
    await openRequests(page, "techsupport@test.local");
    const request = await openReview(page, rig.name);
    await request.getByRole("button", { name: "Start review" }).click();
    await expect(request.getByTestId("request-status")).toHaveText("In Review");

    // SCRUM-211 AC3: Reject asks first; without a note it is refused.
    await request.getByRole("button", { name: "Reject" }).click();
    await page.getByRole("button", { name: "Reject request" }).click();
    await expect(
      request.getByText(
        "Give the coordinator a reason for rejecting the request.",
      ),
    ).toBeVisible();
    await expect(
      request.getByLabel("Note for the coordinator"),
    ).toHaveAttribute("aria-invalid", "true");
    await expect(request.getByTestId("request-status")).toHaveText("In Review");

    await request
      .getByLabel("Note for the coordinator")
      .fill("Not enough lecterns that day.");
    await request.getByRole("button", { name: "Reject" }).click();
    await page.getByRole("button", { name: "Reject request" }).click();
    await expect(
      page.getByText("Request rejected. The coordinator has been notified."),
    ).toBeVisible();

    const saved = await prisma.equipmentRequest.findFirstOrThrow({
      where: { event: { name: rig.name } },
      include: { updates: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    expect(saved.status).toBe("REJECTED");
    expect(saved.updates[0].note).toBe("Not enough lecterns that day.");
  });

  // SCRUM-27 AC8 (SCRUM-33 merged in): the Coordinator sees each request's
  // status, "Rejected with the reason". The reason is required on rejection
  // (SCRUM-28 AC3), so it has to be on the card they read, not only inside the
  // collapsed history log.
  test("SCRUM-27 [AC8] TC-27-14: the coordinator sees a rejected request with its reason, without opening the history", async ({
    page,
  }) => {
    const rig = await makeRig("reason-visible");
    await openRequests(page, "techsupport@test.local");
    const request = await openReview(page, rig.name);
    await request.getByRole("button", { name: "Start review" }).click();
    await expect(request.getByTestId("request-status")).toHaveText("In Review");
    await request
      .getByLabel("Note for the coordinator")
      .fill("Not enough lecterns that day.");
    await request.getByRole("button", { name: "Reject" }).click();
    await page.getByRole("button", { name: "Reject request" }).click();
    await expect(
      page.getByText("Request rejected. The coordinator has been notified."),
    ).toBeVisible();

    await openRequests(page, "coordinator@test.local");
    const mine = page
      .getByTestId("equipment-request")
      .filter({ hasText: rig.name });
    await expect(mine.getByTestId("request-status")).toHaveText("Rejected");
    const rejected = await openEquipmentRequest(page, rig.name);
    await expect(rejected.getByTestId("rejection-reason")).toContainText(
      "Not enough lecterns that day.",
    );
  });

  test("SCRUM-28 [AC4, AC5, AC6] TC-28-07, TC-28-09, TC-28-10, SCRUM-207 TC-207-24: an unavailable line gets an alternative, and the coordinator sees it and the history", async ({
    page,
  }) => {
    const rig = await makeRig("suggest");
    await openRequests(page, "techsupport@test.local");
    const request = await openReview(page, rig.name);

    // Only offered once the request is in review (SCRUM-211: in the
    // decision, between Approve and Reject).
    await expect(
      request.getByRole("button", { name: "Suggest alternative" }),
    ).toHaveCount(0);
    await request.getByRole("button", { name: "Start review" }).click();
    await expect(request.getByTestId("request-status")).toHaveText("In Review");

    await request.getByRole("button", { name: "Suggest alternative" }).click();
    const dialog = page.getByRole("dialog");
    const choices = dialog.getByLabel("Suggest instead of Lectern");
    expect(
      (await optionsOf(choices)).some((o) => o.label.includes("Lectern")),
    ).toBe(false);
    await selectFrom(choices, "eqp_laptop");
    await dialog.getByRole("button", { name: "Suggest" }).click();

    await expect(
      page.getByText("Laptop suggested to the coordinator."),
    ).toBeVisible();
    // The line that fits is never offered alternatives.
    await expect(dialog.getByLabel(/Suggest instead of Projector/)).toHaveCount(0);
    await page.keyboard.press("Escape");
    const lectern = request
      .getByTestId("request-line")
      .filter({ hasText: "Lectern" });
    await expect(lectern.getByTestId("suggested-alternative")).toHaveText(
      "Suggested instead: Laptop",
    );

    expect(
      await prisma.notification.count({
        where: {
          userId: "usr_coordinator",
          event: { name: rig.name },
          message: { contains: "suggested Laptop instead of Lectern" },
        },
      }),
    ).toBe(1);

    await openRequests(page, "coordinator@test.local");
    const mine = page
      .getByTestId("equipment-request")
      .filter({ hasText: rig.name });
    await expect(mine.getByTestId("request-status")).toHaveText("In Review");
    const details = await openEquipmentRequest(page, rig.name);
    await expect(details.getByTestId("suggested-alternative")).toHaveText(
      "Suggested instead: Laptop",
    );
    await details.getByRole("tab", { name: /History/ }).click();
    await expect(details.getByTestId("history-entry").last()).toContainText(
      "Suggested Laptop instead of Lectern (only 4 of 4 free).",
    );
    // A coordinator follows the request; they cannot review it.
    await expect(
      details.getByRole("button", { name: "Start review" }),
    ).toHaveCount(0);
  });

  test("SCRUM-28 [AC1] TC-28-01: Technical Support finds the queue in their navigation, with requests waiting for review first", async ({
    page,
  }) => {
    await makeRig("nav");
    await signIn(page, "techsupport@test.local");

    await page
      .getByRole("link", { name: "Equipment Requests" })
      .first()
      .click();

    await expect(page).toHaveURL(/\/equipment-requests$/);
    // SCRUM-211 AC2: Waiting is the filter it opens on.
    await expect(
      page.getByRole("link", { name: "Waiting", exact: true }),
    ).toHaveAttribute("aria-current", "page");
  });
});

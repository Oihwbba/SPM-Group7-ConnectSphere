import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";
import { selectFrom, optionsOf, openEquipmentRequest } from "./helpers";

/**
 * SCRUM-27 — Create Equipment Request. An Event Coordinator asks Technical
 * Support for equipment for one of their events.
 *
 * Each test builds its own APPROVED event (the "rig"), so tests never share a
 * request and a CI retry starts clean: one event can hold only one open
 * request (AC 7). Rigs are removed afterwards, and their requests go with them.
 * They write to the database, so they only run against a localhost one.
 */
const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);
const RIG = "E2E equipment request";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

async function openRequests(page: Page) {
  await signIn(page, "coordinator@test.local");
  await page.goto("/equipment-requests");
  await expect(
    page.getByRole("heading", { name: "Equipment requests" }),
  ).toBeVisible();
}

async function makeRig(label: string) {
  return prisma.event.create({
    data: {
      name: `${RIG} ${label} ${Date.now()}`,
      status: "APPROVED",
      startAt: new Date("2032-08-20T01:00:00.000Z"),
      endAt: new Date("2032-08-20T09:30:00.000Z"),
      organiserId: "usr_organiser",
      coordinatorId: "usr_coordinator",
    },
    select: { id: true, name: true },
  });
}

async function addLine(
  page: Page,
  equipmentId: string,
  quantity: string,
  requirements = "",
) {
  const dialog = page.getByRole("dialog");
  await selectFrom(dialog.getByLabel("Equipment type"), equipmentId);
  await dialog.getByLabel("Quantity").fill(quantity);
  await dialog
    .getByLabel("Technical requirements (optional)")
    .fill(requirements);
  await dialog.getByRole("button", { name: "Add equipment" }).click();
}

test.describe("SCRUM-27 — Create Equipment Request", () => {
  test.skip(
    !usesLocalDatabase,
    "writes rig events, so it needs the local database",
  );

  test.afterEach(async () => {
    await prisma.event.deleteMany({ where: { name: { startsWith: RIG } } });
  });

  test("SCRUM-27 [AC1, AC2, AC5, AC6] TC-27-01, TC-27-03, TC-27-07, TC-27-08: a coordinator requests equipment for their event and it is saved as Pending Review", async ({
    page,
  }) => {
    const rig = await makeRig("happy");
    await openRequests(page);

    await page.getByRole("button", { name: "New request" }).first().click();
    const dialog = page.getByRole("dialog", { name: "New equipment request" });

    // AC 1: the event is chosen by its name and date.
    const events = await optionsOf(dialog.getByLabel("Event"));
    expect(events.find((o) => o.value === rig.id)?.label).toBe(
      `${rig.name} — 20 Aug 2032`,
    );
    await selectFrom(dialog.getByLabel("Event"), rig.id);
    await expect(dialog.getByTestId("selected-event-period")).toContainText(
      "20 Aug 2032",
    );

    await addLine(page, "eqp_projector", "2", "HDMI to the lectern");
    await addLine(page, "eqp_mic", "3");
    await expect(dialog.getByTestId("draft-line")).toHaveCount(2);
    await dialog
      .getByLabel("Notes for Technical Support (optional)")
      .fill("Keynote at 10am.");
    await dialog.getByRole("button", { name: "Submit request" }).click();

    await expect(
      page.getByText("Request submitted. It's now Pending Review."),
    ).toBeVisible();
    await expect(dialog).toBeHidden();

    const card = page
      .getByTestId("equipment-request")
      .filter({ hasText: rig.name });
    await expect(card).toHaveAttribute("data-highlighted", "true");
    await expect(card.getByTestId("request-status")).toHaveText(
      "Pending Review",
    );
    const details = await openEquipmentRequest(page, rig.name);
    await expect(details.getByTestId("request-line").nth(0)).toContainText(
      /Projector\s*2\s*HDMI to the lectern/,
    );
    await expect(details.getByTestId("request-line").nth(1)).toContainText(
      /Wireless Microphone\s*3\s*None given/,
    );
    await expect(details).toContainText("Keynote at 10am.");

    const saved = await prisma.equipmentRequest.findFirstOrThrow({
      where: { eventId: rig.id },
      include: { lines: true },
    });
    expect(saved.status).toBe("PENDING_REVIEW");
    expect(saved.lines).toHaveLength(2);
  });

  test("SCRUM-27 [AC2] TC-27-03: equipment is chosen from the predefined list of active types", async ({
    page,
  }) => {
    await makeRig("list");
    await openRequests(page);
    await page.getByRole("button", { name: "New request" }).first().click();

    const active = await prisma.equipment.findMany({
      where: { isActive: true },
      select: { id: true },
      orderBy: { type: "asc" },
    });
    const offered = await optionsOf(
      page.getByRole("dialog").getByLabel("Equipment type"),
    );
    expect(offered.map((option) => option.value)).toEqual(
      active.map((item) => item.id),
    );
  });

  test("SCRUM-27 [AC3] TC-27-05: a quantity that is not a positive whole number is refused next to the field", async ({
    page,
  }) => {
    await makeRig("quantity");
    await openRequests(page);
    await page.getByRole("button", { name: "New request" }).first().click();
    const dialog = page.getByRole("dialog");

    for (const quantity of ["0", "-1", "1.5"]) {
      await addLine(page, "eqp_projector", quantity);
      await expect(
        dialog.getByText("Quantity must be a positive whole number."),
      ).toBeVisible();
      await expect(dialog.getByLabel("Quantity")).toHaveAttribute(
        "aria-invalid",
        "true",
      );
    }
    await expect(dialog.getByText("No equipment added yet.")).toBeVisible();

    await addLine(page, "eqp_projector", "1");
    await expect(dialog.getByTestId("draft-line")).toHaveCount(1);
  });

  test("SCRUM-27 [AC4] TC-27-06: adding a type already on the request says so and adds no second line", async ({
    page,
  }) => {
    await makeRig("duplicate");
    await openRequests(page);
    await page.getByRole("button", { name: "New request" }).first().click();
    const dialog = page.getByRole("dialog");

    await addLine(page, "eqp_projector", "2");
    await addLine(page, "eqp_projector", "1");

    await expect(
      dialog.getByText("Projector is already on this request."),
    ).toBeVisible();
    await expect(dialog.getByTestId("draft-line")).toHaveCount(1);
    await expect(dialog.getByTestId("draft-line")).toContainText("× 2");
  });

  test("SCRUM-27 [AC7] TC-27-09: submitting for an event with a request pending review shows that request instead", async ({
    page,
  }) => {
    const rig = await makeRig("existing");
    const existing = await prisma.equipmentRequest.create({
      data: {
        eventId: rig.id,
        requestedById: "usr_coordinator",
        status: "PENDING_REVIEW",
        lines: { create: [{ equipmentId: "eqp_lectern", quantity: 1 }] },
      },
      select: { id: true },
    });
    await openRequests(page);

    await page.getByRole("button", { name: "New request" }).first().click();
    const dialog = page.getByRole("dialog");
    await selectFrom(dialog.getByLabel("Event"), rig.id);
    await addLine(page, "eqp_projector", "2");
    await dialog.getByRole("button", { name: "Submit request" }).click();

    await expect(
      page.getByText("This event already has a request waiting for review", {
        exact: false,
      }),
    ).toBeVisible();
    const shown = page.locator(`#request-${existing.id}`);
    await expect(shown).toHaveAttribute("data-highlighted", "true");
    await expect(shown).toBeInViewport();
    await shown.getByTestId("view-request-button").click();
    await expect(
      page.getByTestId("equipment-request-details").getByTestId("request-line"),
    ).toContainText("Lectern");
    expect(
      await prisma.equipmentRequest.count({ where: { eventId: rig.id } }),
    ).toBe(1);
  });

  test("SCRUM-27 TC-27-13: a request needs an event and at least one item before it is sent", async ({
    page,
  }) => {
    await makeRig("incomplete");
    await openRequests(page);
    await page.getByRole("button", { name: "New request" }).first().click();
    const dialog = page.getByRole("dialog");

    await dialog.getByRole("button", { name: "Submit request" }).click();

    await expect(dialog.getByText("Select an event.")).toBeVisible();
    await expect(
      dialog.getByText("Add at least one equipment item."),
    ).toBeVisible();
    await expect(dialog).toBeVisible();
  });

  test("equipment picked but not yet added is included when the request is submitted", async ({
    page,
  }) => {
    const rig = await makeRig("pending-line");
    await openRequests(page);
    await page.getByRole("button", { name: "New request" }).first().click();
    const dialog = page.getByRole("dialog");

    await selectFrom(dialog.getByLabel("Event"), rig.id);
    await selectFrom(dialog.getByLabel("Equipment type"), "eqp_laptop");
    await dialog.getByLabel("Quantity").fill("2");
    await dialog.getByRole("button", { name: "Submit request" }).click();

    const details = await openEquipmentRequest(page, rig.name);
    await expect(details.getByTestId("request-line")).toContainText(/Laptop\s*2/);
  });
});

test.describe("SCRUM-27 — who can raise equipment requests", () => {
  test("a coordinator finds Equipment Requests in their navigation", async ({
    page,
  }) => {
    await signIn(page, "coordinator@test.local");
    await page
      .getByRole("link", { name: "Equipment Requests" })
      .first()
      .click();
    await expect(page).toHaveURL(/\/equipment-requests$/);
    await expect(
      page.getByRole("heading", { name: "Equipment requests" }),
    ).toBeVisible();
  });

  test("SCRUM-27 [AC8] TC-27-15: a coordinator with no requests is told how to raise one, not shown an empty list", async ({
    page,
  }) => {
    await signIn(page, "coordinator2@test.local");
    await page.goto("/equipment-requests");

    await expect(page.getByText("No equipment requests yet")).toBeVisible();
    await expect(page.getByTestId("equipment-request")).toHaveCount(0);
  });

  test("SCRUM-27 TC-27-12: an organiser typing the URL is refused server-side", async ({
    page,
  }) => {
    await signIn(page, "organiser@test.local");
    await page.goto("/equipment-requests");

    await expect(
      page.getByRole("heading", { name: "Access denied" }),
    ).toBeVisible();
  });
});

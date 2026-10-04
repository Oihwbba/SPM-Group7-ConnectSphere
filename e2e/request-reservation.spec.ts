import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";

import { usesLocalDatabase } from "./helpers";

/**
 * SCRUM-155 — Technical Support reserves an approved request in one step. Each
 * test owns its event and approved request (created straight in the database)
 * in 2033, far from any seeded commitment, and like the other writing specs it
 * only runs against a localhost database. Test cases: docs/testing/SCRUM-155.md.
 */

// 09:00–17:00 Singapore time.
const PERIOD = {
  startAt: new Date("2033-08-01T01:00:00Z"),
  endAt: new Date("2033-08-01T09:00:00Z"),
};

async function signInAsTechSupport(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page
    .getByLabel("Email", { exact: true })
    .fill("techsupport@test.local");
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  await page.goto("/equipment");
  await page.locator('[data-hydrated="true"]').waitFor();
}

async function chooseRequest(page: Page, eventName: string) {
  const select = page.getByLabel("Approved request");
  const value = await select
    .locator("option", { hasText: eventName })
    .getAttribute("value");
  await select.selectOption(value!);
}

test.describe("SCRUM-155 — Reserve an approved request in one step", () => {
  test.skip(!usesLocalDatabase, "writes its own events; local database only");

  const eventIds: string[] = [];

  async function approvedRequest(name: string) {
    const event = await prisma.event.create({
      data: {
        name,
        purpose: "Reservation journey",
        description: "Owned by the SCRUM-155 e2e spec.",
        status: "PLANNING",
        organiserId: "usr_organiser",
        coordinatorId: "usr_coordinator",
        ...PERIOD,
        expectedAttendance: 40,
        submittedAt: new Date(),
      },
      select: { id: true },
    });
    eventIds.push(event.id);
    const request = await prisma.equipmentRequest.create({
      data: {
        eventId: event.id,
        requestedById: "usr_coordinator",
        status: "APPROVED",
        decidedAt: new Date(),
        lines: {
          create: [
            { equipmentId: "eqp_projector", quantity: 1 },
            { equipmentId: "eqp_mic", quantity: 2 },
          ],
        },
      },
      select: { id: true },
    });
    return request.id;
  }

  test.afterEach(async () => {
    await prisma.reservation.deleteMany({
      where: { eventId: { in: eventIds } },
    });
    await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
    eventIds.length = 0;
  });

  test("SCRUM-155 [AC1, AC2] TC-155-02: choosing an approved request fills in its period and one row per requested item", async ({
    page,
  }) => {
    const name = `SCRUM-155 prefill ${Date.now()}`;
    await approvedRequest(name);
    await signInAsTechSupport(page);

    await chooseRequest(page, name);

    await expect(page.getByLabel("Reservation starts")).toHaveValue(
      "2033-08-01T09:00",
    );
    await expect(page.getByLabel("Reservation ends")).toHaveValue(
      "2033-08-01T17:00",
    );
    const rows = page.getByTestId("request-row");
    await expect(rows).toHaveCount(2);
    await expect(page.getByLabel("Item 1", { exact: true })).toHaveValue(
      "eqp_projector",
    );
    await expect(page.getByLabel("Units for item 1")).toHaveValue("1");
    await expect(page.getByLabel("Item 2", { exact: true })).toHaveValue(
      "eqp_mic",
    );
    await expect(page.getByLabel("Units for item 2")).toHaveValue("2");
    // Each row says whether it fits before anything is saved.
    await expect(rows.nth(0).getByTestId("row-availability")).toHaveText(
      /\d+ of 10 free for this period\./,
    );
  });

  test("SCRUM-155 [AC2] TC-155-03: rows can be removed, added and changed, and what is reserved is the edited list", async ({
    page,
  }) => {
    const name = `SCRUM-155 edit ${Date.now()}`;
    const requestId = await approvedRequest(name);
    await signInAsTechSupport(page);
    await chooseRequest(page, name);

    await page.getByRole("button", { name: "Remove item 2" }).click();
    await page.getByRole("button", { name: "Add item" }).click();
    await page.getByLabel("Item 2", { exact: true }).selectOption("eqp_laptop");
    await page.getByLabel("Units for item 2").fill("3");
    await page.getByLabel("Units for item 1").fill("2");
    await page.getByRole("button", { name: "Reserve all 2 item(s)" }).click();

    await expect(
      page.getByText(`Reserved 2 item(s) for ${name}.`),
    ).toBeVisible();
    const reserved = await prisma.reservation.findMany({
      where: { requestId, status: "CONFIRMED" },
      select: { equipmentId: true, quantity: true },
      orderBy: { equipmentId: "asc" },
    });
    expect(reserved).toEqual([
      { equipmentId: "eqp_laptop", quantity: 3 },
      { equipmentId: "eqp_projector", quantity: 2 },
    ]);
  });

  test("SCRUM-155 [AC3, AC6] TC-155-04, TC-155-06: every row is reserved at once, linked to the request, and the request is no longer offered", async ({
    page,
  }) => {
    const name = `SCRUM-155 reserve ${Date.now()}`;
    const requestId = await approvedRequest(name);
    await signInAsTechSupport(page);
    await chooseRequest(page, name);

    await page.getByRole("button", { name: "Reserve all 2 item(s)" }).click();

    await expect(
      page.getByText(`Reserved 2 item(s) for ${name}.`),
    ).toBeVisible();
    await expect(
      page.getByLabel("Approved request").locator("option", { hasText: name }),
    ).toHaveCount(0);
    const reserved = await prisma.reservation.findMany({
      where: { requestId, status: "CONFIRMED" },
      select: { equipmentId: true, quantity: true, startAt: true, endAt: true },
      orderBy: { equipmentId: "asc" },
    });
    expect(reserved).toEqual([
      { equipmentId: "eqp_mic", quantity: 2, ...PERIOD },
      { equipmentId: "eqp_projector", quantity: 1, ...PERIOD },
    ]);
  });

  test("SCRUM-155 [AC4] TC-155-05: an edited row that is short reserves nothing and says by how much", async ({
    page,
  }) => {
    const name = `SCRUM-155 short ${Date.now()}`;
    const requestId = await approvedRequest(name);
    await signInAsTechSupport(page);
    await chooseRequest(page, name);

    await page.getByLabel("Units for item 2").fill("999");
    const micRow = page.getByTestId("request-row").nth(1);
    await expect(micRow.getByTestId("row-availability")).toHaveText(
      /Only \d+ of 25 free for this period — \d+ short\./,
    );
    await page.getByRole("button", { name: "Reserve all 2 item(s)" }).click();

    await expect(
      page.getByRole("alert").filter({ hasText: "Nothing was reserved" }),
    ).toBeVisible();
    await expect(
      micRow.getByText(/Only \d+ of 25 free for this period — \d+ short\./),
    ).toHaveCount(2);
    expect(await prisma.reservation.count({ where: { requestId } })).toBe(0);
  });
});

import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";

import { usesLocalDatabase } from "./helpers";

/**
 * SCRUM-252 — on My Registrations, a cancelled event keeps the venues it was
 * last confirmed with, and rows are in the order of the dates they show. Each
 * test creates its own events and registrations straight in the database, for
 * attendee2, whose own list no other spec counts. Test cases:
 * docs/testing/SCRUM-252.md.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const ATTENDEE = "usr_attendee_2";
const ids: string[] = [];

/** Far enough out to come after every seeded event of attendee2's. */
const at = (days: number) => new Date(Date.now() + days * DAY_MS);

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("attendee2@test.local");
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/events");
  await page.goto("/registrations");
}

async function registered(
  name: string,
  status: "CONFIRMED" | "PLANNING" | "CANCELLED",
  startDay: number,
  extra: { confirmedStartDay?: number; confirmedVenues?: string[] } = {},
) {
  const { confirmedStartDay, confirmedVenues = [] } = extra;
  const { id } = await prisma.event.create({
    data: {
      name,
      purpose: "SCRUM-252 journey",
      description: "Owned by the SCRUM-252 e2e spec.",
      status,
      organiserId: "usr_organiser",
      coordinatorId: "usr_coordinator",
      startAt: at(startDay),
      endAt: new Date(at(startDay).getTime() + 2 * 60 * 60 * 1000),
      expectedAttendance: 30,
      registrationRequired: true,
      registrationEnabled: true,
      confirmedStartAt: confirmedStartDay === undefined ? null : at(confirmedStartDay),
      confirmedEndAt:
        confirmedStartDay === undefined
          ? null
          : new Date(at(confirmedStartDay).getTime() + 2 * 60 * 60 * 1000),
      confirmedVenues,
    },
    select: { id: true },
  });
  ids.push(id);
  await prisma.registration.create({
    data: {
      eventId: id,
      userId: ATTENDEE,
      status: status === "CANCELLED" ? "CANCELLED" : "REGISTERED",
    },
  });
}

test.describe("SCRUM-252 — My Registrations", () => {
  test.skip(!usesLocalDatabase, "writes events straight to the database");

  test.afterAll(async () => {
    await prisma.registration.deleteMany({ where: { eventId: { in: ids } } });
    await prisma.event.deleteMany({ where: { id: { in: ids } } });
  });

  test("SCRUM-252 [AC1] TC-252-03: a cancelled event shows the venues it was last confirmed with", async ({
    page,
  }) => {
    const name = `SCRUM-252 Cancelled ${Date.now()}`;
    await registered(name, "CANCELLED", 500, {
      confirmedStartDay: 500,
      confirmedVenues: ["Seminar Room 2.1 — Level 2, Block B", "Exhibition Hall — Level 1, Block C"],
    });

    await signIn(page);
    const row = page.getByTestId("registration-card").filter({ hasText: name });

    await expect(row.getByTestId("registration-status")).toHaveText("Cancelled");
    await expect(row.getByTestId("venue")).toHaveText(
      "Seminar Room 2.1 — Level 2, Block B; Exhibition Hall — Level 1, Block C",
    );
  });

  test("SCRUM-252 [AC2] TC-252-07: rows are in the order of the dates they show, whatever the re-planned events' own dates", async ({
    page,
  }) => {
    const prefix = `SCRUM-252 Order ${Date.now()}`;
    await registered(`${prefix} middle`, "CONFIRMED", 610);
    // Their own dates are the other way round, so ordering by those fails.
    await registered(`${prefix} last`, "PLANNING", 600, {
      confirmedStartDay: 620,
      confirmedVenues: ["Seminar Room 2.1 — Level 2, Block B"],
    });
    await registered(`${prefix} first`, "PLANNING", 630, {
      confirmedStartDay: 605,
      confirmedVenues: ["Seminar Room 2.1 — Level 2, Block B"],
    });

    await signIn(page);

    await expect(
      page
        .getByTestId("registration-card")
        .filter({ hasText: prefix })
        .getByRole("heading", { level: 2 }),
    ).toHaveText([`${prefix} first`, `${prefix} middle`, `${prefix} last`]);
  });
});

import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";

import { signedIn, usesLocalDatabase } from "./helpers";

/**
 * SCRUM-211 — one layout for every work queue: the Unassigned Queue,
 * Bookings, Equipment Requests and Safety Checks. Each queue gets its own
 * items, named with one prefix and searched for by it, so seeded and other
 * suites' items never show; everything is removed afterwards. Test cases:
 * docs/testing/SCRUM-211.md.
 */
const STAMP = Date.now();
const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(Date.now() - days * DAY - 60 * 60 * 1000);
const COLUMNS = ["Event", "Event date", "What's asked", "Requested"];

/** A day far ahead, one per item, so nothing seeded overlaps it. */
const on = (day: string) => ({
  startAt: new Date(`2037-03-${day}T02:00:00Z`),
  endAt: new Date(`2037-03-${day}T04:00:00Z`),
});

const rows = (page: Page) => page.getByTestId("queue-row");
const names = (page: Page) => rows(page).getByRole("link").allTextContents();

async function searchFor(page: Page, path: string, q: string) {
  await page.goto(`${path}?q=${encodeURIComponent(q)}`);
  await expect(page.getByTestId("queue-controls")).toBeVisible();
}

/**
 * AC1, AC2 — the list: four columns, the queue's own order, both sorts, the
 * three filters, and the search with both empty states.
 */
async function checkList(
  page: Page,
  path: string,
  prefix: string,
  expected: {
    byDefault: string[];
    byEventAsc: string[];
    byRequestedAsc: string[];
    decided: string;
    noun?: string;
  },
) {
  await searchFor(page, path, prefix);
  // AC1: four columns, the same everywhere.
  expect(await page.getByRole("columnheader").allTextContents()).toEqual(COLUMNS);
  expect(await names(page)).toEqual(expected.byDefault);
  // Requested reads the date and how long ago.
  await expect(rows(page).getByTestId("requested")).toContainText([/\(\d+ days ago\)$/]);

  // AC1: sorted by a column, then the other way; the heading says how. A
  // column already sorted flips first.
  const flip = async (label: RegExp) => {
    const head = page.getByRole("columnheader", { name: label });
    const before = await head.getAttribute("aria-sort");
    const after = before === "ascending" ? "descending" : "ascending";
    await head.getByRole("link").click();
    await expect(head).toHaveAttribute("aria-sort", after, { timeout: 20_000 });
    return after;
  };
  const inOrder = (list: string[], dir: string) =>
    dir === "ascending" ? list : [...list].reverse();
  let dir = await flip(/Event date/);
  expect(await names(page)).toEqual(inOrder(expected.byEventAsc, dir));
  dir = await flip(/Event date/);
  expect(await names(page)).toEqual(inOrder(expected.byEventAsc, dir));
  const requested = page.getByRole("columnheader", { name: /Requested/ });
  dir = await flip(/Requested/);
  expect(await names(page)).toEqual(inOrder(expected.byRequestedAsc, dir));
  // AC2: the sort is in the link, so a refresh keeps it.
  await page.reload();
  await expect(requested).toHaveAttribute("aria-sort", dir);

  // AC2: Decided and All, the same three choices everywhere.
  await searchFor(page, path, prefix);
  await page.getByRole("link", { name: "Decided", exact: true }).click();
  await expect(page).toHaveURL(/status=decided/);
  await expect(rows(page)).toHaveCount(1);
  expect(await names(page)).toEqual([expected.decided]);
  await page.getByRole("link", { name: "All", exact: true }).click();
  await page.waitForURL(/status=all/);
  await expect(rows(page)).toHaveCount(expected.byDefault.length + 1);
  expect((await names(page)).sort()).toEqual([...expected.byDefault, expected.decided].sort());

  // AC2: a search that matches nothing says so, with a way to clear it.
  const q = `no such event ${STAMP}`;
  await searchFor(page, path, q);
  await expect(page.getByTestId("queue-empty")).toHaveText(
    new RegExp(`No ${expected.noun ?? "requests"} match ‘${q}’`),
  );
  await page.getByRole("link", { name: "Clear search" }).click();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
}

/** AC3 — the decision's buttons, in order: positive, middle, then Reject. */
async function decisionButtons(page: Page) {
  return page
    .getByTestId("queue-decision")
    .getByRole("button")
    .evaluateAll((buttons) => buttons.map((b) => b.textContent?.trim()));
}

/** AC4 — after a decision, the next item opens; after the last, all caught up. */
// A decision and the next item's page can take a while on a dev server.
async function expectOpened(page: Page, name: string) {
  await expect(page.getByTestId("queue-item-name")).toHaveText(name, { timeout: 20_000 });
}
async function expectCaughtUp(page: Page) {
  await expect(page.getByTestId("queue-empty")).toHaveText(
    "Nothing waiting. You're all caught up.",
    { timeout: 20_000 },
  );
}

test.describe("SCRUM-211 — One layout for every work queue", () => {
  test.describe.configure({ timeout: 120_000 });
  test.skip(!usesLocalDatabase, "writes its own requests; local database only");

  const eventIds: string[] = [];

  async function event(name: string, data: object = {}) {
    const { id } = await prisma.event.create({
      data: {
        name,
        purpose: "Owned by the SCRUM-211 e2e spec.",
        organiserId: "usr_organiser",
        expectedAttendance: 40,
        submittedAt: new Date(),
        ...data,
      },
      select: { id: true },
    });
    eventIds.push(id);
    return id;
  }

  test.afterAll(async () => {
    const bookings = await prisma.booking.findMany({
      where: { eventId: { in: eventIds } },
      select: { id: true },
    });
    const requests = await prisma.equipmentRequest.findMany({
      where: { eventId: { in: eventIds } },
      select: { id: true },
    });
    const checks = await prisma.safetyCheck.findMany({
      where: { eventId: { in: eventIds } },
      select: { id: true },
    });
    const entityIds = [...eventIds, ...[...bookings, ...requests, ...checks].map((r) => r.id)];
    await prisma.notification.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: entityIds } } });
    await prisma.reservation.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.equipmentRequestUpdate.deleteMany({
      where: { requestId: { in: requests.map((r) => r.id) } },
    });
    await prisma.equipmentRequest.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.safetyCheck.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.clarificationRequest.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.booking.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
  });

  test.describe("the Unassigned Queue", () => {
    const P = `SCRUM-211 Unassigned ${STAMP}`;
    // Requested 3, 2 and 1 days ago; events on the 3rd, 1st and 2nd.
    const [A, B, C] = ["A", "B", "C"].map((x) => `${P} ${x}`);
    const DONE = `${P} Assigned`;

    test.beforeAll(async () => {
      await event(A, { status: "SUBMITTED", submittedAt: ago(3), ...on("03") });
      await event(B, { status: "SUBMITTED", submittedAt: ago(2), ...on("01") });
      await event(C, { status: "SUBMITTED", submittedAt: ago(1), ...on("02") });
      await event(DONE, {
        status: "UNDER_REVIEW",
        submittedAt: ago(4),
        coordinatorId: "usr_coordinator",
        supervisingLeadId: "usr_coordinatorlead",
        ...on("04"),
      });
    });

    test("SCRUM-211 [AC1, AC2] TC-211-01, TC-211-02, TC-211-03, TC-211-04: four columns, oldest request first, sortable, filtered and searched", async ({
      browser,
    }) => {
      const page = await signedIn(browser, "lead@test.local");
      await checkList(page, "/queue", P, {
        byDefault: [A, B, C],
        byEventAsc: [B, C, A],
        byRequestedAsc: [A, B, C],
        decided: DONE,
      });
      await searchFor(page, "/queue", P);
      await expect(rows(page).first().getByTestId("asked")).toHaveText("Needs a Coordinator");
      await expect(rows(page).first().getByTestId("event-date")).toHaveText("3 Mar 2037");
    });

    test("SCRUM-211 [AC3, AC4] TC-211-06, TC-211-07, TC-211-08: Assign, and the next request opens, until all are caught up", async ({
      browser,
    }) => {
      const page = await signedIn(browser, "lead@test.local");
      await searchFor(page, "/queue", P);
      await rows(page).filter({ hasText: A }).getByRole("link").click();
      await expectOpened(page, A);
      // AC3: the decision on the right, the same side everywhere.
      expect(await decisionButtons(page)).toEqual(["Assign"]);

      for (const [now, next] of [[A, B], [B, C]]) {
        await expectOpened(page, now);
        await page.getByTestId("assign-button").click();
        await expect(page.getByText(/^Assigned to /).first()).toBeVisible();
        await expectOpened(page, next);
      }
      await page.getByTestId("assign-button").click();
      await expectCaughtUp(page);
      expect(
        await prisma.event.count({ where: { name: { in: [A, B, C] }, status: "UNDER_REVIEW" } }),
      ).toBe(3);
    });

    test("SCRUM-211 [AC3] TC-211-09: a request another Lead assigned meanwhile is refused, with the same message, and stays open", async ({
      browser,
    }) => {
      const name = `${P} Refused`;
      const id = await event(name, { status: "SUBMITTED", submittedAt: ago(1), ...on("05") });
      const page = await signedIn(browser, "lead@test.local");
      await page.goto(`/queue?open=${id}`);
      await expectOpened(page, name);
      // Another Lead assigns it first.
      await prisma.event.update({
        where: { id },
        data: { coordinatorId: "usr_coordinator_2", status: "UNDER_REVIEW" },
      });

      await page.getByTestId("assign-button").click();
      await expect(page.getByTestId("decision-refused")).toHaveText(
        "This request is already assigned to Cara Coordinator.",
      );
      await expect(page).toHaveURL(new RegExp(`open=${id}`));
      expect(
        await prisma.event.findUniqueOrThrow({ where: { id }, select: { coordinatorId: true } }),
      ).toEqual({ coordinatorId: "usr_coordinator_2" });
    });
  });

  test.describe("Bookings", () => {
    const P = `SCRUM-211 Bookings ${STAMP}`;
    const [A, B, C] = ["A", "B", "C"].map((x) => `${P} ${x}`);
    const DONE = `${P} Approved`;

    async function booking(name: string, venueId: string, day: string, createdAt: Date, over: object = {}) {
      const eventId = await event(name, {
        status: "PLANNING",
        coordinatorId: "usr_coordinator",
        ...on(day),
      });
      await prisma.booking.create({
        data: {
          eventId,
          venueId,
          ...on(day),
          status: "PENDING",
          requestedAttendance: 40,
          requestedById: "usr_coordinator",
          createdAt,
          ...over,
        },
      });
      return eventId;
    }

    test.beforeAll(async () => {
      // Soonest event first: B (10th), C (11th), A (12th).
      await booking(A, "ven_hall", "12", ago(3));
      await booking(B, "ven_seminar", "10", ago(2));
      await booking(C, "ven_auditorium", "11", ago(1));
      await booking(DONE, "ven_hall", "13", ago(4), {
        status: "APPROVED",
        decidedById: "usr_venuestaff",
        decidedAt: new Date(),
      });
    });

    test("SCRUM-211 [AC1, AC2] TC-211-01, TC-211-02, TC-211-03, TC-211-04: four columns, soonest event first, sortable, filtered and searched", async ({
      browser,
    }) => {
      const page = await signedIn(browser, "venuestaff@test.local");
      await checkList(page, "/bookings", P, {
        byDefault: [B, C, A],
        byEventAsc: [B, C, A],
        byRequestedAsc: [A, B, C],
        decided: DONE,
      });
      await searchFor(page, "/bookings", P);
      await expect(rows(page).first().getByTestId("asked")).toHaveText("Seminar Room 2.1 for 40");
    });

    test("SCRUM-211 [AC3, AC4] TC-211-06, TC-211-07, TC-211-08: Approve, Hold, Reject in that order; each decision opens the next, until all are caught up", async ({
      browser,
    }) => {
      const page = await signedIn(browser, "venuestaff@test.local");
      await searchFor(page, "/bookings", P);
      await rows(page).first().getByRole("link").click();
      await expectOpened(page, B);
      expect(await decisionButtons(page)).toEqual(["Approve", "Hold", "Reject"]);

      await page.getByRole("button", { name: "Approve" }).click();
      await expectOpened(page, C);
      // Reject asks first, with its required reason.
      await page.getByRole("button", { name: "Reject" }).click();
      const confirm = page.getByRole("button", { name: "Reject request" });
      await expect(confirm).toBeDisabled();
      await page.getByLabel("Rejection reason").fill("The auditorium is closed that week.");
      await confirm.click();
      await expectOpened(page, A);
      await page.getByRole("button", { name: "Approve" }).click();
      await expectCaughtUp(page);

      const decided = await prisma.booking.findMany({
        where: { event: { name: { in: [A, B, C] } } },
        select: { status: true, event: { select: { name: true } } },
      });
      expect(Object.fromEntries(decided.map((b) => [b.event.name, b.status]))).toEqual({
        [A]: "APPROVED",
        [B]: "APPROVED",
        [C]: "REJECTED",
      });
    });

    test("SCRUM-211 [AC3] TC-211-09, SCRUM-134 [AC2]: approving a request with an earlier competing one is refused, with the same message, stays open and writes nothing", async ({
      browser,
    }) => {
      await booking(`${P} Earlier`, "ven_boardroom", "20", ago(2));
      const laterEvent = await booking(`${P} Later`, "ven_boardroom", "20", ago(1));
      const later = await prisma.booking.findFirstOrThrow({ where: { eventId: laterEvent } });
      const page = await signedIn(browser, "venuestaff@test.local");
      await page.goto(`/bookings?open=${later.id}`);
      await expectOpened(page, `${P} Later`);

      await page.getByRole("button", { name: "Approve" }).click();
      await expect(page.getByTestId("decision-refused")).toHaveText(
        /^An earlier request for Executive Boardroom/,
      );
      await expect(page).toHaveURL(new RegExp(`open=${later.id}`));
      expect(
        (await prisma.booking.findUniqueOrThrow({ where: { id: later.id } })).status,
      ).toBe("PENDING");
    });

    test("SCRUM-211 [AC3] TC-211-10, SCRUM-17: Venue Staff see what the booking needs, not the event's purpose, clarification or registrations", async ({
      browser,
    }) => {
      const name = `${P} Need to know`;
      const eventId = await booking(name, "ven_hall", "22", ago(1));
      await prisma.event.update({
        where: { id: eventId },
        data: { purpose: "A purpose only the Coordinator reads", registrationRequired: true },
      });
      await prisma.clarificationRequest.create({
        data: {
          eventId,
          requestedById: "usr_coordinator",
          message: "A question only the Organiser answers",
        },
      });
      const page = await signedIn(browser, "venuestaff@test.local");
      await searchFor(page, "/bookings", name);
      await rows(page).first().getByRole("link").click();
      const details = page.getByTestId("queue-details");

      await expect(details).toContainText("Exhibition Hall");
      await expect(details).toContainText("40 expected · venue holds 200");
      await expect(details).toContainText("Setup and turnaround");
      await expect(details).not.toContainText("A purpose only the Coordinator reads");
      await expect(details).not.toContainText("A question only the Organiser answers");
      await expect(details).not.toContainText(/Registration/i);
    });
  });

  test.describe("Equipment Requests", () => {
    const P = `SCRUM-211 Equipment ${STAMP}`;
    const [A, B, C] = ["A", "B", "C"].map((x) => `${P} ${x}`);
    const DONE = `${P} Approved`;

    async function request(name: string, day: string, createdAt: Date, status = "PENDING_REVIEW") {
      const eventId = await event(name, {
        status: "PLANNING",
        coordinatorId: "usr_coordinator",
        ...on(day),
      });
      const { id } = await prisma.equipmentRequest.create({
        data: {
          eventId,
          requestedById: "usr_coordinator",
          status: status as "PENDING_REVIEW",
          createdAt,
          ...(status === "APPROVED" ? { decidedAt: new Date() } : {}),
          lines: {
            create: [
              { equipmentId: "eqp_projector", quantity: 1 },
              { equipmentId: "eqp_mic", quantity: 4 },
            ],
          },
        },
        select: { id: true },
      });
      return id;
    }

    test.beforeAll(async () => {
      await request(A, "03", ago(3));
      await request(B, "01", ago(2));
      await request(C, "02", ago(1));
      await request(DONE, "04", ago(4), "APPROVED");
    });

    test("SCRUM-211 [AC1, AC2] TC-211-01, TC-211-02, TC-211-03, TC-211-04: four columns, oldest request first, sortable, filtered and searched", async ({
      browser,
    }) => {
      const page = await signedIn(browser, "techsupport@test.local");
      await checkList(page, "/equipment-requests", P, {
        byDefault: [A, B, C],
        byEventAsc: [B, C, A],
        byRequestedAsc: [A, B, C],
        decided: DONE,
      });
      await searchFor(page, "/equipment-requests", P);
      await expect(rows(page).first().getByTestId("asked")).toHaveText(
        "Projector ×1, Wireless Microphone ×4",
      );
    });

    test("SCRUM-211 [AC3, AC4] TC-211-06, TC-211-07, TC-211-08: in review, Approve, Suggest alternative, Reject in that order; each decision opens the next, until all are caught up", async ({
      browser,
    }) => {
      const page = await signedIn(browser, "techsupport@test.local");
      await searchFor(page, "/equipment-requests", P);
      await rows(page).first().getByRole("link").click();

      for (const [now, next] of [
        [A, B],
        [B, C],
        [C, null],
      ] as const) {
        await expectOpened(page, now);
        // Starting the review keeps the request open, as before.
        await page.getByRole("button", { name: "Start review" }).click();
        await expect(page.getByTestId("queue-details").getByTestId("request-status")).toHaveText(
          "In Review",
        );
        expect(await decisionButtons(page)).toEqual(["Approve", "Suggest alternative", "Reject"]);
        if (now === B) {
          await page.getByLabel("Note for the coordinator").fill("No microphones that day.");
          await page.getByRole("button", { name: "Reject" }).click();
          await page.getByRole("button", { name: "Reject request" }).click();
        } else {
          await page.getByRole("button", { name: "Approve" }).click();
        }
        if (next) await expectOpened(page, next);
      }
      await expectCaughtUp(page);
      const decided = await prisma.equipmentRequest.findMany({
        where: { event: { name: { in: [A, B, C] } } },
        select: { status: true, event: { select: { name: true } } },
      });
      expect(Object.fromEntries(decided.map((r) => [r.event.name, r.status]))).toEqual({
        [A]: "APPROVED",
        [B]: "REJECTED",
        [C]: "APPROVED",
      });
    });

    test("SCRUM-211 [AC3] TC-211-09, SCRUM-28 [AC3]: rejecting without a note is refused next to the note, stays open and writes nothing", async ({
      browser,
    }) => {
      const name = `${P} Refused`;
      const id = await request(name, "05", ago(1));
      const page = await signedIn(browser, "techsupport@test.local");
      await page.goto(`/equipment-requests?open=${id}`);
      await page.getByRole("button", { name: "Start review" }).click();
      await expect(page.getByLabel("Note for the coordinator")).toBeVisible();

      await page.getByRole("button", { name: "Reject" }).click();
      await page.getByRole("button", { name: "Reject request" }).click();
      await expect(
        page.getByText("Give the coordinator a reason for rejecting the request."),
      ).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`open=${id}`));
      expect((await prisma.equipmentRequest.findUniqueOrThrow({ where: { id } })).status).toBe(
        "IN_REVIEW",
      );
    });
  });

  test.describe("Safety Checks", () => {
    const P = `SCRUM-211 Safety ${STAMP}`;
    const [A, B, C] = ["A", "B", "C"].map((x) => `${P} ${x}`);
    const DONE = `${P} Approved`;

    async function check(name: string, day: string, createdAt: Date, status = "AWAITING_REVIEW") {
      const eventId = await event(name, {
        status: "PLANNING",
        coordinatorId: "usr_coordinator",
        ...on(day),
      });
      const { id } = await prisma.safetyCheck.create({
        data: {
          eventId,
          requestedById: "usr_coordinator",
          status: status as "AWAITING_REVIEW",
          createdAt,
          ...(status === "APPROVED"
            ? { decidedById: "usr_safetyofficer_2", decidedAt: new Date() }
            : {}),
        },
        select: { id: true },
      });
      return id;
    }

    test.beforeAll(async () => {
      await check(A, "03", ago(3));
      await check(B, "01", ago(2));
      await check(C, "02", ago(1));
      await check(DONE, "04", ago(4), "APPROVED");
    });

    test("SCRUM-211 [AC1, AC2] TC-211-01, TC-211-02, TC-211-03, TC-211-04: four columns, oldest request first, sortable, filtered and searched", async ({
      browser,
    }) => {
      const page = await signedIn(browser, "safety@test.local");
      await checkList(page, "/safety-checks", P, {
        byDefault: [A, B, C],
        byEventAsc: [B, C, A],
        byRequestedAsc: [A, B, C],
        decided: DONE,
        noun: "checks",
      });
      await searchFor(page, "/safety-checks", P);
      await expect(rows(page).first().getByTestId("asked")).toHaveText("Safety check, 40 people");
    });

    test("SCRUM-211 [AC3, AC4] TC-211-06, TC-211-07, TC-211-08: Approve, Request changes, Reject in that order; each decision opens the next, until all are caught up", async ({
      browser,
    }) => {
      const page = await signedIn(browser, "safety@test.local");
      await searchFor(page, "/safety-checks", P);
      await rows(page).first().getByRole("link").click();
      await expectOpened(page, A);
      expect(await decisionButtons(page)).toEqual(["Approve", "Request changes", "Reject"]);

      await page.getByRole("button", { name: "Approve" }).click();
      await expectOpened(page, B);
      // Reject asks first, with its required note.
      await page.getByRole("button", { name: "Reject" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("button", { name: "Reject" })).toBeDisabled();
      await dialog.getByLabel(/^Note/).fill("No fire marshal arranged.");
      await dialog.getByRole("button", { name: "Reject" }).click();
      await expectOpened(page, C);
      await page.getByRole("button", { name: "Approve" }).click();
      await expectCaughtUp(page);

      const decided = await prisma.safetyCheck.findMany({
        where: { event: { name: { in: [A, B, C] } } },
        select: { status: true, event: { select: { name: true } } },
      });
      expect(Object.fromEntries(decided.map((c) => [c.event.name, c.status]))).toEqual({
        [A]: "APPROVED",
        [B]: "REJECTED",
        [C]: "APPROVED",
      });
    });

    test("SCRUM-211 [AC3] TC-211-09, SCRUM-166 [AC3]: a check another officer recorded meanwhile is refused, with the same message, stays open and writes nothing", async ({
      browser,
    }) => {
      const name = `${P} Refused`;
      const id = await check(name, "05", ago(1));
      const page = await signedIn(browser, "safety@test.local");
      await page.goto(`/safety-checks?open=${id}`);
      await expectOpened(page, name);
      // Another officer records it first.
      await prisma.safetyCheck.update({
        where: { id },
        data: { status: "APPROVED", decidedById: "usr_safetyofficer_2", decidedAt: new Date() },
      });

      await page.getByRole("button", { name: "Approve" }).click();
      await expect(page.getByText(/^This check is already Approved by Sasha Safety/).first()).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`open=${id}`));
      expect(await prisma.auditLog.count({ where: { entityId: id } })).toBe(0);
    });
  });

  test("SCRUM-211 [AC3] TC-211-11: on a phone the details come first, then the decision", async ({
    browser,
  }) => {
    const name = `SCRUM-211 Phone ${STAMP}`;
    const id = await event(name, { status: "SUBMITTED", submittedAt: ago(1), ...on("25") });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill("lead@test.local");
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/queue/);
    await page.goto(`/queue?open=${id}`);
    await expect(page.getByTestId("queue-decision")).toBeVisible({ timeout: 20_000 });

    const details = (await page.getByTestId("queue-details").boundingBox())!;
    const decision = (await page.getByTestId("queue-decision").boundingBox())!;
    expect(decision.y).toBeGreaterThanOrEqual(details.y + details.height);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
    ).toBe(false);
    await context.close();
  });
});

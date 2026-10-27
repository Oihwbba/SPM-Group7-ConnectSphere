import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";

/**
 * Shared steps for the journeys: signing in, and driving the app's dropdown
 * and its date and time picker (shared page conventions).
 */

export const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

/**
 * The contexts signedIn opened, with the test that opened each (SCRUM-182).
 * Tests don't close them, and a page left on the events list or a venue
 * calendar refreshes itself from the server every few seconds, so a run that
 * kept them all would slow the one test server for every later test. A
 * worker runs one test at a time, so a context from an earlier test is done
 * with.
 */
let opened: { testId: string; context: BrowserContext }[] = [];

export async function signedIn(browser: Browser, email: string): Promise<Page> {
  const { testId } = test.info();
  for (const { context } of opened.filter((o) => o.testId !== testId)) {
    await context.close();
  }
  opened = opened.filter((o) => o.testId === testId);
  const context = await browser.newContext();
  opened.push({ testId, context });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  return page;
}

/** A half-hour option's on-screen label, e.g. "13:30" -> "1:30 pm SGT" (SCRUM-129). */
export function timeOption(hhmm: string): RegExp {
  const [h, m] = hhmm.split(":").map(Number);
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const minutes = String(m).padStart(2, "0");
  return new RegExp(`^${hour12}:${minutes}\\s${h < 12 ? "am" : "pm"}\\sSGT$`);
}

export async function choose(
  page: Page,
  label: string,
  option: string | RegExp,
) {
  await page.getByLabel(label, { exact: true }).click();
  await page.getByRole("option", { name: option }).click();
}

/** Set one end of the period. Times are Singapore wall time, "YYYY-MM-DDTHH:mm". */
export async function setTime(
  page: Page,
  which: "Start" | "End" | "Expiry",
  wallTime: string,
) {
  await pickDateTime(page.getByLabel(which, { exact: true }), wallTime);
}

/**
 * Open the app's date and time picker (components/app/date-time-picker.tsx)
 * at `trigger` and pick `value`, given the way the field holds it:
 * "YYYY-MM-DD", "HH:mm" or "YYYY-MM-DDTHH:mm" (Singapore time). "" clears it.
 */
export async function pickDateTime(trigger: Locator, value: string) {
  const page = trigger.page();
  await trigger.click();
  const menu = page.getByRole("menu");
  if (value === "") {
    await menu.getByRole("menuitem", { name: "Clear" }).click();
    return;
  }
  const isTime = /^\d{2}:\d{2}$/.test(value);
  const [date, time] = isTime ? ["", value] : value.split("T");
  if (date) await pickDay(menu, date);
  if (time) {
    const [h, m] = time.split(":").map(Number);
    // AM or PM first, so the hour wanted is offered.
    await menu.locator(`[data-period="${h >= 12 ? "PM" : "AM"}"]`).click();
    await menu
      .locator(`[data-hour="${String(h % 12 || 12).padStart(2, "0")}"]`)
      .click();
    await menu.locator(`[data-minute="${String(m).padStart(2, "0")}"]`).click();
  }
  // A date alone closes the picker; with a time it stays open until closed.
  if (await menu.isVisible()) await page.keyboard.press("Escape");
  await menu.waitFor({ state: "hidden" });
}

/**
 * Jump the open calendar to the day's month — its header opens a year, then
 * a month — and pick the day.
 */
async function pickDay(menu: Locator, day: string) {
  const [year, month] = day.split("-");
  const heading = menu.locator("[data-month]");
  if ((await heading.getAttribute("data-month")) !== `${year}-${month}`) {
    await heading.click();
    for (;;) {
      if (await menu.locator(`[data-year="${year}"]`).count()) break;
      const first = Number(
        await menu.locator("[data-year]").first().getAttribute("data-year"),
      );
      await menu
        .getByRole("menuitem", {
          name: Number(year) < first ? "Earlier years" : "Later years",
        })
        .click();
    }
    await menu.locator(`[data-year="${year}"]`).click();
    await menu.locator(`[data-pick-month="${month}"]`).click();
  }
  await menu.locator(`[data-date="${day}"]`).click();
}

/**
 * Choose an option in the app's dropdown (components/app/app-select.tsx) at
 * `trigger`: by its value, as a native select's selectOption did, by the
 * text it shows, or by text it contains.
 */
export async function selectFrom(
  trigger: Locator,
  option:
    | string
    | { value?: string; label?: string | RegExp; containing?: string },
) {
  const page = trigger.page();
  await trigger.click();
  const list = page.getByRole("listbox");
  const wanted = typeof option === "string" ? { value: option } : option;
  const item =
    wanted.value !== undefined
      ? list.locator(`[role="option"][data-value="${wanted.value}"]`)
      : wanted.containing !== undefined
        ? list
            .getByRole("option")
            .filter({ hasText: wanted.containing })
            .first()
        : list.getByRole("option", { name: wanted.label, exact: true });
  await item.click();
  await list.waitFor({ state: "hidden" });
}

/**
 * Answer a pill dropdown with free text (components/app/pill-select.tsx):
 * choose Other and type into the box it opens. Text naming an option shows
 * as that option's pill; what is saved is the text either way.
 */
export async function fillOther(trigger: Locator, text: string) {
  const page = trigger.page();
  const id = await trigger.getAttribute("id");
  const box = page.locator(`[id="${id}-other"]`);
  if (!(await box.isVisible())) {
    await trigger.click();
    await page.getByRole("menuitemcheckbox", { name: "Other" }).click();
    await page.getByRole("menu").waitFor({ state: "hidden" });
  }
  await box.fill(text);
}

/** Choose options in a pill dropdown, by the value each one adds as a pill. */
export async function pickOptions(trigger: Locator, names: string[]) {
  const page = trigger.page();
  for (const name of names) {
    if (!(await page.getByRole("menu").isVisible())) await trigger.click();
    await page.getByRole("menu").locator(`[data-option="${name}"]`).click();
  }
  if (await page.getByRole("menu").isVisible()) {
    await page.keyboard.press("Escape");
  }
  await page.getByRole("menu").waitFor({ state: "hidden" });
}

/**
 * Save the event request form as a draft (shared page conventions, change 2):
 * the form stays open and the button says so; then close the form.
 */
export async function saveDraft(page: Page) {
  await page.getByRole("button", { name: /Save as Draft/i }).click();
  await expect(
    page.getByRole("button", { name: "Saved as draft" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

/**
 * Submit the event request form for review (change 8): the confirmation
 * pop-up appears in its place; close it.
 */
export async function submitRequest(page: Page) {
  await page
    .getByRole("button", { name: /Submit Request for Review/i })
    .click();
  const submitted = page.getByTestId("event-request-submitted");
  await expect(submitted).toContainText("Request submitted");
  await submitted.getByRole("button", { name: "Close" }).click();
  await expect(submitted).toHaveCount(0);
}

/** The options the app's dropdown at `trigger` offers: value and text, in order. */
export async function optionsOf(trigger: Locator) {
  const page = trigger.page();
  // A dropdown no longer shown offers nothing.
  if ((await trigger.count()) === 0) return [];
  try {
    await trigger.click({ timeout: 2_000 });
  } catch (error) {
    // It went between the check and the click: the list was refreshed away.
    if ((await trigger.count()) === 0) return [];
    throw error;
  }
  const list = page.getByRole("listbox");
  const options = await list.getByRole("option").evaluateAll((items) =>
    items.map((item) => ({
      value: item.getAttribute("data-value") ?? "",
      label: (item.textContent ?? "").trim(),
      disabled: item.hasAttribute("data-disabled"),
    })),
  );
  await page.keyboard.press("Escape");
  await list.waitFor({ state: "hidden" });
  return options;
}

/**
 * Open a request in Venue Staff's booking queue (SCRUM-211): its row, by
 * event name or booking id, opens it on the same page. Returns the opened
 * request: its details beside the decision.
 */
export async function openBooking(
  page: Page,
  which: string | RegExp | { id: string },
) {
  const id = await openQueueRow(page, which);
  const details = page.locator(`[data-testid="booking-${id}"][data-item="${id}"]`);
  await expect(details).toBeVisible();
  return details;
}

/**
 * SCRUM-211 — open an item from any work queue's list: the row for an event
 * name, or for an item's id. Returns the item's id.
 */
export async function openQueueRow(
  page: Page,
  which: string | RegExp | { id: string },
) {
  // After a decision the next item is open: back to the list first.
  if (/[?&]open=/.test(page.url())) {
    await page.getByRole("link", { name: /^All (requests|checks)$/ }).click();
    await page.waitForURL((url) => !url.searchParams.has("open"));
  }
  const row =
    typeof which === "object" && "id" in which
      ? page.locator(`[data-testid="queue-row"][data-item="${which.id}"]`)
      : page.getByTestId("queue-row").filter({ hasText: which });
  const id = (await row.getAttribute("data-item"))!;
  await row.getByRole("link").click();
  await page.waitForURL(new RegExp(`[?&]open=${id}`));
  return id;
}

/**
 * Open a Coordinator's equipment request (shared page conventions, change
 * 11): the table row for the event, then its details. Returns the pop-up,
 * whose History tab holds the request's log.
 */
export async function openEquipmentRequest(page: Page, eventName: string) {
  await page
    .getByTestId("equipment-request")
    .filter({ hasText: eventName })
    .getByTestId("view-request-button")
    .click();
  const details = page.getByTestId("equipment-request-details");
  await expect(details).toBeVisible();
  return details;
}

/**
 * Open a request in Technical Support's review queue (SCRUM-211): its row,
 * by event name or id. Returns the opened request: its details, history and
 * notes beside the decision.
 */
export async function openReview(
  page: Page,
  request: string | { id: string },
) {
  const id = await openQueueRow(page, request);
  const details = page.locator(`[data-testid="review-item"][data-item="${id}"]`);
  await expect(details).toBeVisible();
  return details;
}

/**
 * Open an event's page from the events list (SCRUM-208): its name in the
 * list, then, when given, one of its tabs. Returns the page.
 */
export async function openEvent(page: Page, name: string, tab?: string) {
  if (!/^\/events\/?$/.test(new URL(page.url()).pathname)) {
    await page.goto("/events");
  }
  await page
    .getByTestId("event-name-link")
    .getByText(name, { exact: true })
    .first()
    .click();
  const event = page.getByTestId("event-page");
  // A navigation, not a pop-up: allow for the page's first load.
  await expect(event.getByRole("heading", { level: 1, name })).toBeVisible({ timeout: 15_000 });
  if (tab) await event.getByRole("tab", { name: new RegExp(`^${tab}`) }).click();
  return event;
}

/**
 * SCRUM-190 AC1 — the request form's one event date with a start and an end
 * time, Singapore time: "2031-11-01", "09:00", "17:00".
 */
export async function fillEventSchedule(
  page: Page,
  date: string,
  startTime: string,
  endTime: string,
) {
  await pickDateTime(page.getByLabel("Event Date *"), date);
  await pickDateTime(page.getByLabel("Start Time *"), startTime);
  await pickDateTime(page.getByLabel("End Time *"), endTime);
}

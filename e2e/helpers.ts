import {
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";

/**
 * Shared steps for the venue journeys (SCRUM-36/37/50/52/53): signing in, and
 * driving the app's Select, calendar and half-hour time pickers.
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
  const [date, time] = wallTime.split("T");
  await pickDate(page, which, date);
  await choose(page, `${which} time`, timeOption(time));
}

/** Open the in-app calendar, page to the target month, and pick the day. */
export async function pickDate(
  page: Page,
  which: "Start" | "End" | "Expiry",
  day: string,
) {
  await page.getByLabel(`${which} date`).click();
  const heading = page.locator("[data-month]");
  const [targetYear, targetMonth] = day.split("-").map(Number);
  for (;;) {
    const [y, m] = (await heading.getAttribute("data-month"))!
      .split("-")
      .map(Number);
    const months = targetYear * 12 + targetMonth - (y * 12 + m);
    if (months === 0) break;
    const step =
      Math.abs(months) >= 12
        ? months > 0
          ? "Next year"
          : "Previous year"
        : months > 0
          ? "Next month"
          : "Previous month";
    await page.getByRole("menuitem", { name: step }).click();
  }
  await page.locator(`[data-date="${day}"]`).click();
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
  await page.getByLabel("Event Date *").fill(date);
  await page.getByLabel("Start Time *").fill(startTime);
  await page.getByLabel("End Time *").fill(endTime);
}

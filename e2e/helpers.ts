import { type Browser, type Page } from "@playwright/test";

/**
 * Shared steps for the venue journeys (SCRUM-36/37/50/52/53): signing in, and
 * driving the app's Select, calendar and half-hour time pickers.
 */

export const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

export async function signedIn(browser: Browser, email: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  return page;
}

/** A half-hour option's on-screen label, e.g. "13:30" -> "1:30 pm". */
export function timeOption(hhmm: string): RegExp {
  const [h, m] = hhmm.split(":").map(Number);
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const minutes = String(m).padStart(2, "0");
  return new RegExp(`^${hour12}:${minutes}\\s${h < 12 ? "am" : "pm"}$`);
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
  which: "Start" | "End",
  wallTime: string,
) {
  const [date, time] = wallTime.split("T");
  await pickDate(page, which, date);
  await choose(page, `${which} time`, timeOption(time));
}

/** Open the in-app calendar, page to the target month, and pick the day. */
export async function pickDate(
  page: Page,
  which: "Start" | "End",
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

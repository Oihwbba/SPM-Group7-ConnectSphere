import { test, expect } from "@playwright/test";

// SCRUM-65 — the security properties around sign-in. The happy path (sign in,
// reach a protected page) is covered by events.spec.ts; this file pins the
// three properties the story calls out: a wrong password is refused, an unknown
// email is refused the SAME way (no account enumeration), and signing out makes
// protected pages unreachable again.

test("SCRUM-65 [AC2] TC-65-02: a wrong password is refused", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("organiser@test.local");
  await page.getByLabel("Password", { exact: true }).fill("WrongPassword!");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText("Invalid email or password.")).toBeVisible();
});

test("SCRUM-65 [AC2] TC-65-02: an unknown email gets the same refusal (no account enumeration)", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("nobody@test.local");
  await page.getByLabel("Password", { exact: true }).fill("WrongPassword!");
  await page.getByRole("button", { name: "Sign in" }).click();

  // Identical message to the wrong-password case — the app never reveals
  // whether the account exists.
  await expect(page.getByText("Invalid email or password.")).toBeVisible();
});

test("SCRUM-65 [AC4, AC5] TC-65-04: signing out makes protected pages unreachable again", async ({ page }) => {
  // Sign in.
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("organiser@test.local");
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/events");

  // Sign out through the user menu.
  await page.getByRole("button", { name: "Open user menu" }).click();
  await page.getByRole("menuitem", { name: /sign out/i }).click();
  await page.waitForURL("**/login");

  // The protected page now bounces back to /login for the (now) stranger.
  await page.goto("/events");
  await page.waitForURL("**/login");
});

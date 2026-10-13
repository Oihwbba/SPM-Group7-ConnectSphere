import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright drives a real browser against a running app. It expects:
 *   - a Postgres database that has been migrated and seeded, and
 *   - the Next.js app running on http://localhost:3000.
 *
 * Locally, point the terminal at the Docker database first, never at `.env`'s
 * shared one, because some specs write data (README, "Local database
 * (Docker)"). Then run `npm run db:reset` and `npm run test:e2e`. The
 * `webServer` block below starts the app automatically. In CI the same
 * sequence runs against a Postgres service container (see .github/workflows).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["html"], ["list"]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Build once and run the production server so the E2E run matches CI.
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});

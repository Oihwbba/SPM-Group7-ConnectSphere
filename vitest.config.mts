import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // Playwright specs live in e2e/ and are run by `npm run test:e2e`, not Vitest.
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules", ".next", "e2e"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      // Every server-side file, whatever it is named. Components (.tsx) need a
      // DOM environment this suite doesn't have (SCRUM-87).
      include: ["lib/**/*.ts", "app/**/*.ts"],
      // Patterns match anywhere in the path, so "*.ts" would also take .tsx.
      // Auth.js's route handler only re-exports GET and POST from auth.ts.
      exclude: ["**/*.tsx", "app/api/auth/**"],
      thresholds: { 100: true, perFile: true },
    },
  },
});

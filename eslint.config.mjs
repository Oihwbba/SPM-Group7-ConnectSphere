import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

// ESLint flat config. Next.js 16 removed the `next lint` command, so linting
// runs through the ESLint CLI (`npm run lint` → `eslint .`) and this file
// replaces the old .eslintrc.json.
//
// `eslint-config-prettier/flat` is imported directly rather than through
// FlatCompat: the compat shim would pull in @eslint/js and @eslint/eslintrc
// just to translate one legacy config, and prettier ships a native flat build.
export default defineConfig([
  globalIgnores([
    "**/node_modules/",
    "**/.next/",
    "**/coverage/",
    "**/playwright-report/",
    "**/test-results/",
    "lib/generated/",
  ]),
  {
    extends: [...nextCoreWebVitals, ...nextTypescript, prettier],

    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
]);

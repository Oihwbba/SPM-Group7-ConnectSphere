// Applies pending migrations to the production (shared Supabase) database
// before each production deploy (deploy.yml), so the database is always on the
// schema the code being deployed expects. #148 shipped a follow-up migration
// that nobody applied, and production failed until `db:deploy` was run by
// hand.
//
// `prisma migrate deploy` only applies migrations that aren't applied yet. It
// never resets or rewrites anything, so it's the one migration command allowed
// on the shared database (CLAUDE.md). The URLs come from the production
// environment `vercel pull` writes, and are passed straight to Prisma: the file
// is parsed here rather than sourced by the shell, so a `$` in a password isn't
// expanded.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const ENV_FILE = ".vercel/.env.production.local";
const REQUIRED = ["DATABASE_URL", "DIRECT_URL"];

/** `KEY="value"` lines, as `vercel pull` writes them, with JSON escapes. */
export function parseEnvFile(text) {
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, raw] = match;
    env[key] = raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2 ? JSON.parse(raw) : raw;
  }
  return env;
}

/** The database URLs Prisma needs, or the names of those missing. */
export function databaseEnv(env) {
  const missing = REQUIRED.filter((key) => !env[key]);
  if (missing.length) return { missing };
  return { env: Object.fromEntries(REQUIRED.map((key) => [key, env[key]])) };
}

function main() {
  const { env, missing } = databaseEnv(parseEnvFile(readFileSync(ENV_FILE, "utf8")));
  if (missing) {
    console.log(`::error::The production environment has no ${missing.join(" or ")}, so its migrations can't be applied. Nothing was deployed.`);
    process.exitCode = 1;
    return;
  }
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: { ...process.env, ...env },
    shell: process.platform === "win32",
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

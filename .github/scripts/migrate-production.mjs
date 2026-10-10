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
    env[key] = raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2 ? unquote(key, raw) : raw;
  }
  return env;
}

/** A quoted value. A malformed one is refused by its name only: the value may be a database URL. */
function unquote(key, raw) {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`${ENV_FILE} has a malformed value for ${key}.`);
  }
}

/** The database URLs Prisma needs, or the names of those missing. */
export function databaseEnv(env) {
  const missing = REQUIRED.filter((key) => !env[key]);
  if (missing.length) return { missing };
  return { env: Object.fromEntries(REQUIRED.map((key) => [key, env[key]])) };
}

/**
 * The deploy step: read the production environment and apply its pending
 * migrations. Returns the exit code. A failed `migrate deploy` throws, which
 * fails the step and stops the deploy. The file reader and the command runner
 * are passed in so the step can be tested without a database.
 *
 * @param {{
 *   readFile?: (path: string) => string,
 *   exec?: (command: string, args: string[], options: object) => unknown,
 *   log?: (message: string) => void,
 *   baseEnv?: Record<string, string | undefined>,
 * }} [deps]
 * @returns {number}
 */
export function run({
  readFile = (path) => readFileSync(path, "utf8"),
  exec = (command, args, options) => execFileSync(command, args, options),
  log = console.log,
  baseEnv = process.env,
} = {}) {
  const { env, missing } = databaseEnv(parseEnvFile(readFile(ENV_FILE)));
  if (missing) {
    log(`::error::The production environment has no ${missing.join(" or ")}, so its migrations can't be applied. Nothing was deployed.`);
    return 1;
  }
  // The URLs aren't repository secrets, so Actions wouldn't hide them if
  // Prisma or an error printed one.
  for (const value of Object.values(env)) log(`::add-mask::${value}`);
  exec("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: { ...baseEnv, ...env },
    shell: process.platform === "win32",
  });
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = run();
}

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the workspace root. Turbopack infers it by walking up for a lockfile,
  // and an unrelated package-lock.json in a parent folder makes it guess a
  // directory outside this repository. Pinning keeps dev, build and file
  // tracing deterministic for everyone.
  turbopack: {
    root: projectRoot,
  },
  outputFileTracingRoot: projectRoot,
  // We fail the build on type errors rather than shipping them, because CI
  // treats a red typecheck as a broken pipeline.
  typescript: {
    ignoreBuildErrors: false,
  },
  // NOTE: there is deliberately no `eslint` key. Next.js 16 removed the
  // `next lint` command and the `eslint` config option with it — `next build`
  // no longer lints at all. Linting is its own CI step (`npm run lint` →
  // `eslint .`, configured in eslint.config.mjs).
};

export default nextConfig;

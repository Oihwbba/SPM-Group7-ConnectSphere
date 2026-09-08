/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // We fail the build on type and lint errors rather than shipping them,
  // because CI treats a red typecheck/lint as a broken pipeline.
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  eslint: {
    // Prevent deployment halts on harmless styling warnings during CI
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Next.js typechecking will still run if configured, or can be validated beforehand
    ignoreBuildErrors: false,
  },
};

module.exports = nextConfig;

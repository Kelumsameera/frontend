import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Safely instructs Turbopack to handle the internal packages cleanly
  transpilePackages: ["recharts", "d3-array", "d3-scale", "d3-shape", "d3-time"],
};

export default nextConfig;

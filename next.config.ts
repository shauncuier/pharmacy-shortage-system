import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  // Allow all local network origins to connect to the dev server without CORS / origin blocking
  allowedDevOrigins: [
    '192.168.*.*',
    '10.*.*.*',
    '172.*.*.*',
    'localhost',
    '127.0.0.1',
    '*.local',
  ],
};

export default nextConfig;


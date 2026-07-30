import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel Cron: har 30 daqiqada bot intizom eslatmalarini tekshiradi
  ...(process.env.VERCEL
    ? {
        async headers() {
          return [];
        },
      }
    : {}),
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "drizzle-orm",
      "@supabase/supabase-js",
      "@supabase/ssr",
      "recharts",
    ],
  },
};

export default nextConfig;

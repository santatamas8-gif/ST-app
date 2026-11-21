import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  serverExternalPackages: ["sharp"],
  outputFileTracingIncludes: {
    "/api/movement-prep/media": ["./content/movement-prep/**/*"],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
};

export default nextConfig;

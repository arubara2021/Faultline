import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.5"],
  serverExternalPackages: ["drizzle-orm", "pg"],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
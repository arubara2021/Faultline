import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["drizzle-orm", "pg"],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;

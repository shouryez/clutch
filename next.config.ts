import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // the dev log file under .next/ retriggers the watcher when the project lives in OneDrive
  experimental: { mcpServer: false },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

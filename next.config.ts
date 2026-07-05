import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the production Docker image.
  output: "standalone",
  // BullMQ/ioredis use dynamic requires that break when bundled — load them
  // from node_modules at runtime instead.
  serverExternalPackages: ["bullmq", "ioredis"],
};

export default nextConfig;

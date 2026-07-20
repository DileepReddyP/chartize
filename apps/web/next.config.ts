import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";
import { createVanillaExtractPlugin } from "@vanilla-extract/next-plugin";
import { fileURLToPath } from "node:url";
import path from "node:path";

// The app is launched from apps/web, while deployable secrets live once at the
// workspace root. Let Next load that standard env file into the server process;
// no values are copied into client bundles or duplicated into app-local files.
const webDirectory = path.dirname(fileURLToPath(import.meta.url));
loadEnvConfig(path.resolve(webDirectory, "../.."), process.env.NODE_ENV !== "production", console, true);

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  transpilePackages: ["@chartize/contracts"],
  serverExternalPackages: ["@duckdb/node-api", "@duckdb/node-bindings"],
  webpack(config) {
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    config.resolve.fallback = { ...config.resolve.fallback, canvas: false };
    return config;
  },
};

export default createVanillaExtractPlugin()(nextConfig);

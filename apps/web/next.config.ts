import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";
import { createVanillaExtractPlugin } from "@vanilla-extract/next-plugin";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import path from "node:path";

const webDirectory = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
loadEnvConfig(path.resolve(webDirectory, "../.."), process.env.NODE_ENV !== "production", console, true);

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  transpilePackages: ["@chartize/contracts"],
  serverExternalPackages: ["@duckdb/node-api", "@duckdb/node-bindings", "@atproto/oauth-client-node", "@atproto-labs/fetch-node"],
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      // Select Monaco's ESM build even when Next resolves a CommonJS condition.
      "monaco-editor$": require.resolve("monaco-editor/index.js"),
      // Monaco vendors DOMPurify too; the pnpm override alone misses that copy.
      "./dompurify/dompurify.js$": require.resolve("dompurify"),
    };
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    config.resolve.fallback = { ...config.resolve.fallback, canvas: false };
    return config;
  },
};

export default createVanillaExtractPlugin()(nextConfig);

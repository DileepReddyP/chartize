import { defineConfig, mergeConfig } from "vitest/config";
import config from "./vitest.config.mts";

export default mergeConfig(config, defineConfig({
  test: { include: ["evals/**/*.eval.ts"], testTimeout: 300_000, fileParallelism: false, silent: false, disableConsoleIntercept: true },
}));

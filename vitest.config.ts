import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "node",
    globals: true,
    // Each integration file builds its own in-process Postgres, so files must
    // not share a worker. Without this they race on the same schema.
    fileParallelism: false,
    include: ["tests/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});

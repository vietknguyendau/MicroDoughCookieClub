import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    globalSetup: ["./tests/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    env: {
      AUTH_SECRET: "test-secret-test-secret-test-secret-123456",
      TEST_DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://postgres@localhost:5433/microdough_test",
    },
  },
});

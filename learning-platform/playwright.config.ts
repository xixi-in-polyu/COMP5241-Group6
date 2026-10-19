import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  use: {
    baseURL: process.env.SMOKE_BASE_URL || "http://localhost:3011",
    trace: "retain-on-failure",
  },
});

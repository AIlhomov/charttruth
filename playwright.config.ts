import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  expect: { timeout: 60_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  outputDir: "test-results",
  use: {
    baseURL: process.env.CHARTTRUTH_TEST_URL || "http://127.0.0.1:5191",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: process.env.CI ? undefined : "chrome",
      },
    },
  ],
  webServer: process.env.CHARTTRUTH_TEST_URL
    ? undefined
    : {
        command: "npm run dev -- --port 5191 --strictPort",
        url: "http://127.0.0.1:5191",
        reuseExistingServer: false,
      },
});

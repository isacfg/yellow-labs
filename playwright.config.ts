import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // Convex has rate limits, run serially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",

  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    // Global setup: create a test user and save auth state
    {
      name: "setup",
      testMatch: /global\.setup\.ts/,
    },
    // Tests that need no auth
    {
      name: "unauthenticated",
      testMatch: ["**/landing.test.ts", "**/auth.test.ts"],
      use: { ...devices["Desktop Chrome"] },
    },
    // Tests that need a signed-in user
    {
      name: "authenticated",
      testMatch: ["**/dashboard.test.ts", "**/present.test.ts"],
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true, // use already-running Vite server
    timeout: 30_000,
  },
});

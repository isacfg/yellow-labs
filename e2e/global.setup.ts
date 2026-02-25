import { test as setup, expect } from "@playwright/test";
import path from "path";

const authFile = path.join(import.meta.dirname, ".auth/user.json");

// Deterministic test account — sign up once, reuse across all authenticated tests
const TEST_EMAIL = "e2e-test@example.com";
const TEST_PASSWORD = "password1234";

setup("create test user and save auth state", async ({ page }) => {
  await page.goto("/auth");
  await page.waitForLoadState("networkidle");

  // Try to sign in first (in case account already exists from a previous run)
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');

  // Wait briefly — if sign-in succeeds we'll be on /dashboard
  await page.waitForTimeout(4000);

  if (!page.url().includes("/dashboard")) {
    // Account doesn't exist yet — sign up
    await page.goto("/auth");
    await page.waitForLoadState("networkidle");

    // Switch to sign-up mode
    await page.click('button[type="button"]:has-text("Sign up")');
    await expect(page.locator('button[type="submit"]')).toContainText("Create account");

    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
  }

  await expect(page).toHaveURL(/dashboard/);
  await page.context().storageState({ path: authFile });
});

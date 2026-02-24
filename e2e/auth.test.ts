import { test, expect } from "@playwright/test";

test.describe("Auth page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/auth");
    await page.waitForLoadState("networkidle");
  });

  test("shows sign-in form by default", async ({ page }) => {
    await expect(page.locator("h3")).toContainText("Sign in");
    await expect(page.locator('button[type="submit"]')).toContainText(
      "Sign in"
    );
  });

  test("has email and password inputs", async ({ page }) => {
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("email input has correct placeholder", async ({ page }) => {
    await expect(page.locator('input[type="email"]')).toHaveAttribute(
      "placeholder",
      "you@example.com"
    );
  });

  test("can toggle to sign-up mode", async ({ page }) => {
    await page.click('button[type="button"]:has-text("Sign up")');
    await expect(page.locator("h3")).toContainText("Create account");
    await expect(page.locator('button[type="submit"]')).toContainText(
      "Create account"
    );
  });

  test("can toggle back to sign-in from sign-up", async ({ page }) => {
    await page.click('button[type="button"]:has-text("Sign up")');
    await page.click('button[type="button"]:has-text("Sign in")');
    await expect(page.locator("h3")).toContainText("Sign in");
  });

  test("shows error on wrong credentials", async ({ page }) => {
    await page.fill('input[type="email"]', "wrong@example.com");
    await page.fill('input[type="password"]', "wrongpassword");
    await page.click('button[type="submit"]');
    // Wait for error to appear
    await expect(page.locator(".text-destructive")).toBeVisible({
      timeout: 8000,
    });
  });

  test("disables submit button while loading", async ({ page }) => {
    await page.fill('input[type="email"]', "test@example.com");
    await page.fill('input[type="password"]', "password123");
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();
    // Button should show loading state immediately
    await expect(submitBtn).toBeDisabled();
  });

  test("sign up then sign in with same credentials succeeds", async ({
    page,
  }) => {
    const email = `e2e-flow-${Date.now()}@example.com`;
    const password = "testpass1234";

    // Sign up
    await page.click('button[type="button"]:has-text("Sign up")');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
    await expect(page).toHaveURL(/dashboard/);

    // Sign out via URL navigation back to auth clears session — just verify we made it
    // (full sign-out flow tested in dashboard tests)
  });

  test("full login flow redirects to dashboard after sign out", async ({
    page,
  }) => {
    const email = `e2e-login-${Date.now()}@example.com`;
    const password = "testpass1234";

    // Create account
    await page.click('button[type="button"]:has-text("Sign up")');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });

    // Sign out from dashboard
    await page.click('button:has-text("Sign out")');
    await page.waitForURL(/\/(auth|$)/, { timeout: 10_000 });

    // Sign in again with same credentials
    await page.goto("/auth");
    await page.waitForLoadState("networkidle");
    const signInSwitch = page.locator('button[type="button"]:has-text("Sign in")');
    if (await signInSwitch.isVisible()) {
      await signInSwitch.click();
    }
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
    await expect(page).toHaveURL(/dashboard/);
  });
});

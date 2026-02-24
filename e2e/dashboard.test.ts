import { test, expect } from "@playwright/test";

// All tests in this file use the saved auth state from global.setup.ts

test.describe("Dashboard (authenticated)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
  });

  test("stays on /dashboard when authenticated", async ({ page }) => {
    await expect(page).toHaveURL(/dashboard/);
  });

  test("shows app header with logo", async ({ page }) => {
    await expect(page.locator("header")).toContainText("Slides AI");
  });

  test("shows user email in header", async ({ page }) => {
    await expect(page.locator("header")).toContainText("e2e-test@example.com");
  });

  test("shows New presentation button", async ({ page }) => {
    await expect(
      page.locator('a[href="/chat"], a:has-text("New presentation")')
    ).toBeVisible();
  });

  test("shows empty state when no presentations", async ({ page }) => {
    // Fresh test user may have no presentations — check for the empty state OR the grid
    const emptyState = page.locator('text="No presentations yet"');
    const grid = page.locator(".grid");
    // One of them must be visible
    const emptyVisible = await emptyState.isVisible();
    const gridVisible = await grid.isVisible();
    expect(emptyVisible || gridVisible).toBe(true);
  });

  test("sign out button is present and works", async ({ page }) => {
    const signOutBtn = page.locator('button:has-text("Sign out")');
    await expect(signOutBtn).toBeVisible();
    await signOutBtn.click();
    await page.waitForURL("**/{,index.html}", { timeout: 5000 });
    // After sign-out should land on landing or auth
    expect(["http://localhost:5173/", "http://localhost:5173/auth"]).toContain(
      page.url()
    );
  });
});

test.describe("Dashboard (unauthenticated)", () => {
  test("redirects to /auth if not signed in", async ({ page }) => {
    // Clear storage to simulate logged-out state
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    // Should redirect to /auth (give it a moment for the Convex query to resolve)
    await page.waitForURL(/\/(auth|$)/, { timeout: 8000 });
    expect(page.url()).toMatch(/\/(auth|$)/);
  });
});

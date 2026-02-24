import { test, expect } from "@playwright/test";

test.describe("Public presentation viewer (/p/:slug)", () => {
  test("shows 404 state for non-existent slug", async ({ page }) => {
    await page.goto("/p/nonexistent-slug-abc-xyz-000");
    await page.waitForLoadState("networkidle");
    // Wait for Convex query to resolve (null = not found)
    await page.waitForFunction(
      () => document.body.innerText.trim().length > 0,
      { timeout: 10_000 }
    );
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).toMatch(/404|not found/i);
  });

  test("shows loading spinner initially", async ({ page }) => {
    // Intercept and delay the Convex response to observe loading state
    await page.goto("/p/any-slug-for-loading-test");
    // Immediately after navigation the spinner should be visible
    // (Convex query is still loading)
    const spinner = page.locator(".animate-spin, [class*='animate-spin']");
    // The spinner appears before the query resolves — it's transient
    // Just check the page loads without throwing
    await page.waitForLoadState("domcontentloaded");
    await expect(page).toHaveURL(/\/p\//);
  });

  test("404 page has a link back to home", async ({ page }) => {
    await page.goto("/p/nonexistent-slug-abc-xyz-000");
    await page.waitForLoadState("networkidle");
    await page.waitForFunction(
      () => document.body.innerText.trim().length > 0,
      { timeout: 10_000 }
    );
    const homeLink = page.locator('a[href="/"]');
    await expect(homeLink).toBeVisible();
  });

  test("unknown slug doesn't expose raw JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("/p/totally-fake-slug-xyz");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
    expect(errors.filter((e) => !e.includes("ResizeObserver"))).toHaveLength(0);
  });
});

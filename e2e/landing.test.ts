import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("renders hero headline", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Beautiful presentations");
    await expect(page.locator("h1")).toContainText("built by AI");
  });

  test("nav has Sign in and Get started links pointing to /auth", async ({
    page,
  }) => {
    const nav = page.locator("nav");
    await expect(nav.locator('a[href="/auth"]').first()).toBeVisible();
    const links = await nav.locator("a").all();
    const hrefs = await Promise.all(links.map((l) => l.getAttribute("href")));
    expect(hrefs.every((h) => h === "/auth")).toBe(true);
  });

  test("CTA buttons navigate to /auth", async ({ page }) => {
    await page.locator('a[href="/auth"]').first().click();
    await expect(page).toHaveURL(/\/auth/);
  });

  test("shows three feature cards", async ({ page }) => {
    const cards = page.locator(".grid > div");
    await expect(cards).toHaveCount(3);
  });

  test("feature cards have expected titles", async ({ page }) => {
    const headings = await page.locator(".grid > div h3").allInnerTexts();
    expect(headings).toContain("Visual style discovery");
    expect(headings).toContain("Instant generation");
    expect(headings).toContain("Share anywhere");
  });

  test("page title includes Slides", async ({ page }) => {
    await expect(page).toHaveTitle(/Slides/i);
  });
});

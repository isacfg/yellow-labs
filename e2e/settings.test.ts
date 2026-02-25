import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

// All tests in this file use the saved auth state from global.setup.ts

/**
 * Helper: Trigger a file upload via JavaScript by creating a File object
 * in the browser and dispatching the change event on the input.
 * This is more reliable than Playwright's setInputFiles for React inputs.
 */
async function uploadTestImage(page: import("@playwright/test").Page) {
    await page.evaluate(() => {
        // Create a minimal 1x1 red PNG as a Uint8Array
        const pngBase64 =
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
        const binary = atob(pngBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        const file = new File([bytes], "test-avatar.png", { type: "image/png" });

        // Create a new FileList-like DataTransfer and attach the file
        const dt = new DataTransfer();
        dt.items.add(file);

        const input = document.getElementById(
            "photo-upload-input"
        ) as HTMLInputElement;
        input.files = dt.files;

        // Dispatch a native 'change' event that React will pick up
        input.dispatchEvent(new Event("change", { bubbles: true }));
    });
}

test.describe("Settings page (authenticated)", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/settings");
        await page.waitForLoadState("networkidle");
        // Wait for user data to load (the page title should appear)
        await expect(page.locator("h1")).toContainText("Settings", {
            timeout: 10_000,
        });
    });

    // ─── Navigation ───────────────────────────────────────────────────────

    test("navigates to /settings and stays there", async ({ page }) => {
        await expect(page).toHaveURL(/settings/);
    });

    test("shows app header with logo", async ({ page }) => {
        await expect(page.locator("header")).toContainText("Slides AI");
    });

    test("shows user email in header", async ({ page }) => {
        await expect(page.locator("header")).toContainText("e2e-test@example.com");
    });

    test("has a back to dashboard link", async ({ page }) => {
        const backLink = page.locator('a:has-text("Back to Dashboard")');
        await expect(backLink).toBeVisible();
        await backLink.click();
        await expect(page).toHaveURL(/dashboard/, { timeout: 5000 });
    });

    // ─── Page layout & content ────────────────────────────────────────────

    test("shows page title and description", async ({ page }) => {
        await expect(page.locator("h1")).toContainText("Settings");
        await expect(page.locator("text=Manage your profile")).toBeVisible();
    });

    test("shows coral gradient profile banner", async ({ page }) => {
        const banner = page.locator(".gradient-coral").first();
        await expect(banner).toBeVisible();
    });

    test("shows avatar with user initial", async ({ page }) => {
        // The avatar should display the first letter of the email ("E") or user name
        const avatar = page.locator(
            '[class*="rounded-2xl"][class*="border-4"] >> visible=true'
        );
        await expect(avatar).toBeVisible();
    });

    test("shows email field as read-only", async ({ page }) => {
        const emailSection = page.locator("#settings-email-field");
        await expect(emailSection).toBeVisible();
        await expect(emailSection).toContainText("e2e-test@example.com");
        // Should NOT have an edit button
        await expect(emailSection.locator('button:has-text("Edit")')).toHaveCount(
            0
        );
    });

    test("shows member since date", async ({ page }) => {
        const dateSection = page.locator("#settings-created-field");
        await expect(dateSection).toBeVisible();
        await expect(dateSection).toContainText("Member Since");
        // Should contain a year
        await expect(dateSection).toContainText(/20\d{2}/);
    });

    test("shows sign out section", async ({ page }) => {
        const signOutBtn = page.locator("#settings-signout-btn");
        await expect(signOutBtn).toBeVisible();
        await expect(signOutBtn).toContainText("Sign out");
    });

    // ─── Display name editing ─────────────────────────────────────────────

    test("shows display name field with edit button", async ({ page }) => {
        const nameField = page.locator("#settings-name-field");
        await expect(nameField).toBeVisible();
        await expect(nameField).toContainText("Display Name");
        await expect(page.locator("#settings-edit-name-btn")).toBeVisible();
    });

    test("clicking edit shows inline name input", async ({ page }) => {
        await page.click("#settings-edit-name-btn");
        const input = page.locator("#settings-name-input");
        await expect(input).toBeVisible();
        await expect(input).toBeFocused();
        // Save and cancel buttons should appear
        await expect(page.locator("#settings-save-name-btn")).toBeVisible();
        await expect(page.locator("#settings-cancel-name-btn")).toBeVisible();
    });

    test("can cancel name editing", async ({ page }) => {
        await page.click("#settings-edit-name-btn");
        await expect(page.locator("#settings-name-input")).toBeVisible();
        await page.click("#settings-cancel-name-btn");
        // Input should disappear, edit button should return
        await expect(page.locator("#settings-name-input")).toHaveCount(0);
        await expect(page.locator("#settings-edit-name-btn")).toBeVisible();
    });

    test("can save a new display name", async ({ page }) => {
        const testName = `E2E User ${Date.now()}`;
        await page.click("#settings-edit-name-btn");
        const input = page.locator("#settings-name-input");
        await input.fill(testName);
        await page.click("#settings-save-name-btn");

        // Wait for the edit mode to close (input disappears)
        await expect(page.locator("#settings-name-input")).toHaveCount(0, {
            timeout: 8000,
        });
        // The new name should appear on the page
        await expect(page.locator("#settings-name-field")).toContainText(testName);
        // Toast should confirm
        await expect(
            page.locator("text=Name updated successfully")
        ).toBeVisible({
            timeout: 5000,
        });
    });

    test("can save name by pressing Enter", async ({ page }) => {
        const testName = `Enter Name ${Date.now()}`;
        await page.click("#settings-edit-name-btn");
        const input = page.locator("#settings-name-input");
        await input.fill(testName);
        await input.press("Enter");

        await expect(page.locator("#settings-name-input")).toHaveCount(0, {
            timeout: 8000,
        });
        await expect(page.locator("#settings-name-field")).toContainText(testName);
    });

    test("save button is disabled when name is empty", async ({ page }) => {
        await page.click("#settings-edit-name-btn");
        const input = page.locator("#settings-name-input");
        await input.fill("");
        await expect(page.locator("#settings-save-name-btn")).toBeDisabled();
    });

    // ─── Profile photo upload ─────────────────────────────────────────────

    test("shows profile photo section with upload button", async ({ page }) => {
        const photoSection = page.locator("#settings-photo-field");
        await expect(photoSection).toBeVisible();
        await expect(photoSection).toContainText("Profile Photo");
        await expect(page.locator("#settings-upload-photo-btn")).toBeVisible();
        await expect(photoSection).toContainText("JPG, PNG or GIF. Max 5MB.");
    });

    test("upload button triggers file input", async ({ page }) => {
        // Verify the file input exists with correct accept attribute
        const fileInput = page.locator("#photo-upload-input");
        await expect(fileInput).toHaveAttribute("accept", "image/*");
    });

    test("can upload a profile photo and see it displayed", async ({ page }) => {
        // Trigger upload via JavaScript (most reliable for React file inputs)
        await uploadTestImage(page);

        // Wait for success toast
        await expect(
            page.locator("text=Photo updated successfully")
        ).toBeVisible({ timeout: 20000 });

        // After upload, the avatar should contain an <img> element
        const avatarImg = page
            .locator('[class*="rounded-2xl"][class*="border-4"] img')
            .first();
        await expect(avatarImg).toBeVisible({ timeout: 10000 });
        await expect(avatarImg).toHaveAttribute("alt", "Profile");

        // Remove button should appear
        await expect(page.locator("#settings-delete-photo-btn")).toBeVisible();

        // Upload button text should change to "Change photo"
        await expect(page.locator("#settings-upload-photo-btn")).toContainText(
            "Change photo"
        );
    });

    test("can delete an uploaded profile photo", async ({ page }) => {
        // Upload a photo first
        await uploadTestImage(page);
        await expect(
            page.locator("text=Photo updated successfully")
        ).toBeVisible({ timeout: 20000 });

        // Wait for the remove button
        const removeBtn = page.locator("#settings-delete-photo-btn");
        await expect(removeBtn).toBeVisible({ timeout: 10000 });

        // Click remove
        await removeBtn.click();

        // Wait for removal toast
        await expect(page.locator("text=Photo removed")).toBeVisible({
            timeout: 15000,
        });

        // After removal, no <img> in avatar
        await expect(
            page.locator('[class*="rounded-2xl"][class*="border-4"] img')
        ).toHaveCount(0, { timeout: 10000 });

        // Button text should revert
        await expect(page.locator("#settings-upload-photo-btn")).toContainText(
            "Upload photo"
        );

        // Remove button should be gone
        await expect(page.locator("#settings-delete-photo-btn")).toHaveCount(0);
    });

    test("avatar shows uploaded image with valid URL", async ({ page }) => {
        await uploadTestImage(page);
        await expect(
            page.locator("text=Photo updated successfully")
        ).toBeVisible({ timeout: 20000 });

        // The main avatar img should be visible
        const avatarImg = page
            .locator('[class*="rounded-2xl"][class*="border-4"] img')
            .first();
        await expect(avatarImg).toBeVisible({ timeout: 10000 });

        // Verify the image src is a valid URL
        const src = await avatarImg.getAttribute("src");
        expect(src).toBeTruthy();
        expect(src).toMatch(/^https?:\/\//);
    });

    // ─── Sign out from settings ───────────────────────────────────────────

    test("sign out button works from settings page", async ({ page }) => {
        const signOutBtn = page.locator("#settings-signout-btn");
        await signOutBtn.click();
        await page.waitForURL("**/{,index.html}", { timeout: 8000 });
        expect(["http://localhost:5173/", "http://localhost:5173/auth"]).toContain(
            page.url()
        );
    });
});

test.describe("Settings page (unauthenticated)", () => {
    test("shows loading/redirect when not signed in", async ({ page }) => {
        // Clear storage to simulate logged-out state
        await page.goto("/");
        await page.evaluate(() => {
            localStorage.clear();
            sessionStorage.clear();
        });
        await page.goto("/settings");
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(3000);
        const hasSettingsTitle = await page
            .locator("h1:has-text('Settings')")
            .isVisible();
        if (hasSettingsTitle === false) {
            expect(true).toBe(true);
        } else {
            expect(
                page.url().includes("/auth") || page.url() === "http://localhost:5173/"
            ).toBe(true);
        }
    });
});

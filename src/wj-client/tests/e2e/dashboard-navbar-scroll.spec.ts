import { test, expect } from "@playwright/test";

test.describe("Dashboard sidebar navbar scroll", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard (requires auth — use storageState if available,
    // otherwise skip auth check and just verify layout structure)
    await page.goto("/en/dashboard/home");
  });

  test("nav element allows vertical scroll when viewport is short", async ({
    page,
  }) => {
    // Set a short viewport to force overflow
    await page.setViewportSize({ width: 1024, height: 600 });

    const nav = page.locator("nav[aria-label]").first();
    await expect(nav).toBeVisible();

    // Nav should be scrollable: scrollHeight > clientHeight
    const isScrollable = await nav.evaluate(
      (el) => el.scrollHeight > el.clientHeight,
    );
    expect(isScrollable).toBe(true);
  });

  test("User section remains visible without scrolling the nav", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 600 });

    // The user section is OUTSIDE <nav> — it should always be in viewport
    // Check it exists in the sidebar (outside nav)
    const userSection = page
      .locator("aside")
      .locator("div.px-3.pt-2.pb-3")
      .first();
    await expect(userSection).toBeVisible();
  });

  test("all nav items are reachable by scrolling at 768px viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 768 });

    // Settings nav item should exist in the DOM (may need scrolling to be in view)
    const settingsLink = page.locator('a[href*="/dashboard/settings"]').first();
    await expect(settingsLink).toBeAttached();

    // Scroll to it
    await settingsLink.scrollIntoViewIfNeeded();
    await expect(settingsLink).toBeVisible();
  });
});

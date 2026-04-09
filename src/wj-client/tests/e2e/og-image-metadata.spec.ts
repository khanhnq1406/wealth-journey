import { test, expect } from "@playwright/test";

/**
 * E2E Test: OG Image Metadata
 *
 * Verifies that the og:image and twitter:image meta tags on public pages
 * point to the absolute PNG URL after the Phase 1 fix.
 */

test.describe("OG Image Metadata — Landing Page", () => {
  test("vi/landing should have og:image pointing to absolute PNG URL", async ({ page }) => {
    await page.goto("/vi/landing");
    const ogImage = page.locator('meta[property="og:image"]');
    await expect(ogImage).toHaveAttribute("content", "https://www.congdongvang.com/og-image.png");
  });

  test("vi/landing should have twitter:image pointing to absolute PNG URL", async ({ page }) => {
    await page.goto("/vi/landing");
    const twitterImage = page.locator('meta[name="twitter:image"]');
    await expect(twitterImage).toHaveAttribute("content", "https://www.congdongvang.com/og-image.png");
  });

  test("en/landing should have og:image pointing to absolute PNG URL", async ({ page }) => {
    await page.goto("/en/landing");
    const ogImage = page.locator('meta[property="og:image"]');
    await expect(ogImage).toHaveAttribute("content", "https://www.congdongvang.com/og-image.png");
  });
});

test.describe("OG Image Metadata — Guide Page", () => {
  test("vi/guide should have og:image pointing to absolute PNG URL", async ({ page }) => {
    await page.goto("/vi/guide");
    const ogImage = page.locator('meta[property="og:image"]');
    await expect(ogImage).toHaveAttribute("content", "https://www.congdongvang.com/og-image.png");
  });

  test("vi/guide should have twitter:image pointing to absolute PNG URL", async ({ page }) => {
    await page.goto("/vi/guide");
    const twitterImage = page.locator('meta[name="twitter:image"]');
    await expect(twitterImage).toHaveAttribute("content", "https://www.congdongvang.com/og-image.png");
  });
});

test.describe("OG Image Static PNG", () => {
  test("og-image.png should be accessible and return image/png", async ({ request }) => {
    const response = await request.get("/og-image.png");
    expect(response.status()).toBe(200);
    const contentType = response.headers()["content-type"];
    expect(contentType).toContain("image/png");
  });
});

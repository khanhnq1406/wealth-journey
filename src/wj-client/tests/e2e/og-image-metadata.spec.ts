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

test.describe("Dynamic OG Image Route — Guide", () => {
  test("GET /vi/guide/opengraph-image should return 200", async ({ request }) => {
    const response = await request.get("/vi/guide/opengraph-image");
    expect(response.status()).toBe(200);
    const contentType = response.headers()["content-type"];
    expect(contentType).toContain("image/png");
  });

  test("GET /en/guide/opengraph-image should return 200", async ({ request }) => {
    const response = await request.get("/en/guide/opengraph-image");
    expect(response.status()).toBe(200);
  });
});

test.describe("Dynamic OG Image Route — Landing", () => {
  test("GET /vi/landing/opengraph-image should return 200", async ({ request }) => {
    const response = await request.get("/vi/landing/opengraph-image");
    expect(response.status()).toBe(200);
    const contentType = response.headers()["content-type"];
    expect(contentType).toContain("image/png");
  });

  test("GET /en/landing/opengraph-image should return 200", async ({ request }) => {
    const response = await request.get("/en/landing/opengraph-image");
    expect(response.status()).toBe(200);
    const contentType = response.headers()["content-type"];
    expect(contentType).toContain("image/png");
  });

  test("Unknown locale on opengraph-image should return 200 (fallback to vi)", async ({ request }) => {
    // Unknown locale should not crash — defaults to vi
    const response = await request.get("/xx/landing/opengraph-image");
    expect(response.status()).toBe(200);
  });
});

test.describe("OG Image Auto-Injection (Phase 2)", () => {
  test("vi/landing og:image should point to /vi/landing/opengraph-image", async ({ page }) => {
    await page.goto("/vi/landing");
    const ogImage = page.locator('meta[property="og:image"]');
    const content = await ogImage.getAttribute("content");
    expect(content).toContain("/vi/landing/opengraph-image");
  });

  test("vi/guide og:image should point to /vi/guide/opengraph-image", async ({ page }) => {
    await page.goto("/vi/guide");
    const ogImage = page.locator('meta[property="og:image"]');
    const content = await ogImage.getAttribute("content");
    expect(content).toContain("/vi/guide/opengraph-image");
  });
});

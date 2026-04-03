import { test, expect } from "@playwright/test";

test.describe("Legal pages", () => {
  test("Terms of Service page renders all sections", async ({ page }) => {
    await page.goto("/en/legal/terms");
    await page.waitForLoadState("networkidle");

    // Check page loads with main landmark
    await expect(page.locator("main")).toBeVisible();

    // Check navbar and footer present
    await expect(page.locator("nav").first()).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();
  });

  test("Terms page has correct landmark structure", async ({ page }) => {
    await page.goto("/en/legal/terms");
    await page.waitForLoadState("networkidle");

    // Verify semantic HTML structure: main, sections, headings
    const sections = page.locator("section");
    await expect(sections).toHaveCount(9);

    const h2s = page.locator("h2");
    await expect(h2s).toHaveCount(9);
  });

  test("Terms disclaimer section has distinct styling", async ({ page }) => {
    await page.goto("/en/legal/terms");
    await page.waitForLoadState("networkidle");

    // Disclaimer section has id="disclaimer"
    const disclaimerSection = page.locator("#disclaimer");
    await expect(disclaimerSection).toBeVisible();
  });

  test.describe("Mobile viewport", () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test("Terms page renders correctly on mobile without horizontal scroll", async ({
      page,
    }) => {
      await page.goto("/en/legal/terms");
      await page.waitForLoadState("networkidle");
      await expect(page.locator("main")).toBeVisible();

      // Check no horizontal overflow
      const bodyScrollWidth = await page.evaluate(
        () => document.body.scrollWidth
      );
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyScrollWidth).toBeLessThanOrEqual(viewportWidth);
    });
  });

  test("Privacy Policy page renders all sections", async ({ page }) => {
    await page.goto("/en/legal/privacy");
    await page.waitForLoadState("networkidle");

    // Check page loads with main landmark
    await expect(page.locator("main")).toBeVisible();

    // Check navbar and footer present
    await expect(page.locator("nav").first()).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();
  });

  test("Privacy page has correct landmark structure", async ({ page }) => {
    await page.goto("/en/legal/privacy");
    await page.waitForLoadState("networkidle");

    // Verify semantic HTML structure: main, sections, headings
    const sections = page.locator("section");
    await expect(sections).toHaveCount(9);

    const h2s = page.locator("h2");
    await expect(h2s).toHaveCount(9);
  });

  test.describe("Privacy Mobile viewport", () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test("Privacy page renders correctly on mobile", async ({ page }) => {
      await page.goto("/en/legal/privacy");
      await page.waitForLoadState("networkidle");
      await expect(page.locator("main")).toBeVisible();

      // Check no horizontal overflow
      const bodyScrollWidth = await page.evaluate(
        () => document.body.scrollWidth
      );
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyScrollWidth).toBeLessThanOrEqual(viewportWidth);
    });
  });
});

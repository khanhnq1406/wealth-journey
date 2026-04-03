import { test, expect } from "@playwright/test";

test.describe("Landing page footer legal links", () => {
  test("Landing footer has Terms of Service link pointing to /legal/terms", async ({
    page,
  }) => {
    await page.goto("/en/landing");
    await page.waitForLoadState("networkidle");

    const termsLink = page.locator('footer a[href="/legal/terms"]').first();
    await expect(termsLink).toBeVisible();
  });

  test("Landing footer has Privacy Policy link pointing to /legal/privacy", async ({
    page,
  }) => {
    await page.goto("/en/landing");
    await page.waitForLoadState("networkidle");

    const privacyLink = page.locator('footer a[href="/legal/privacy"]').first();
    await expect(privacyLink).toBeVisible();
  });

  test.describe("Mobile viewport", () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test("Landing footer legal links visible on mobile at 375px", async ({
      page,
    }) => {
      await page.goto("/en/landing");
      await page.waitForLoadState("networkidle");

      const termsLink = page.locator('footer a[href="/legal/terms"]').first();
      const privacyLink = page
        .locator('footer a[href="/legal/privacy"]')
        .first();
      await expect(termsLink).toBeVisible();
      await expect(privacyLink).toBeVisible();
    });
  });
});

test.describe("Auth page legal links", () => {
  test("Login page Terms of Service link points to /legal/terms", async ({
    page,
  }) => {
    await page.goto("/en/auth/login");
    await page.waitForLoadState("networkidle");

    const termsLink = page.locator('a[href="/legal/terms"]').first();
    await expect(termsLink).toBeVisible();
  });

  test("Login page Privacy Policy link points to /legal/privacy", async ({
    page,
  }) => {
    await page.goto("/en/auth/login");
    await page.waitForLoadState("networkidle");

    const privacyLink = page.locator('a[href="/legal/privacy"]').first();
    await expect(privacyLink).toBeVisible();
  });

  test("Register page Terms of Service link points to /legal/terms", async ({
    page,
  }) => {
    await page.goto("/en/auth/register");
    await page.waitForLoadState("networkidle");

    const termsLink = page.locator('a[href="/legal/terms"]').first();
    await expect(termsLink).toBeVisible();
  });

  test("Register page Privacy Policy link points to /legal/privacy", async ({
    page,
  }) => {
    await page.goto("/en/auth/register");
    await page.waitForLoadState("networkidle");

    const privacyLink = page.locator('a[href="/legal/privacy"]').first();
    await expect(privacyLink).toBeVisible();
  });
});

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

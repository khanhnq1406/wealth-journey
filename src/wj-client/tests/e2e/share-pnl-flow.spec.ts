import { test, expect } from "@playwright/test";

/**
 * E2E spec: Share PNL Modal flow
 *
 * Verifies that:
 * - The share button is visible on the NetWorthDisplay card
 * - Clicking the share button opens the PNL share modal
 *
 * Note: If the page redirects to auth (no active session), tests are skipped.
 */

test.describe("Share PNL Modal", () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth verify endpoint so the page doesn't redirect to login
    await page.route("**/api/v1/auth/verify", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          valid: true,
          user: { id: 1, email: "test@test.com" },
        }),
      });
    });

    // Mock wallet list endpoint
    await page.route("**/api/v1/wallets**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ wallets: [], total: 0 }),
      });
    });

    // Mock portfolio summary endpoint
    await page.route("**/api/v1/portfolio**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: null }),
      });
    });

    // Mock public gold prices endpoint
    await page.route("**/api/v1/public/asset-display-prices**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ prices: [] }),
      });
    });

    // Navigate to home dashboard
    await page.goto("/dashboard/home");
    await page.waitForLoadState("networkidle");
  });

  test("share button is visible on NetWorthDisplay card", async ({ page }) => {
    // If redirected to auth, skip
    if (page.url().includes("/auth/")) {
      test.skip();
      return;
    }

    const shareBtn = page.getByRole("button", {
      name: /share pnl|chia sẻ kết quả/i,
    });
    await expect(shareBtn.first()).toBeVisible({ timeout: 10000 });
  });

  test("clicking share button opens PNL share modal", async ({ page }) => {
    // If redirected to auth, skip
    if (page.url().includes("/auth/")) {
      test.skip();
      return;
    }

    const shareBtn = page.getByRole("button", {
      name: /share pnl|chia sẻ kết quả/i,
    });
    await shareBtn.first().click();

    // The modal title should appear
    await expect(
      page.getByText(/share investment results|chia sẻ kết quả đầu tư/i)
    ).toBeVisible({ timeout: 5000 });
  });
});

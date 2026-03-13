import { test, expect } from "@playwright/test";

/**
 * E2E Test: View Market Prices Flow
 *
 * Tests the market prices page with tabs:
 * - Gold tab (default)
 * - Silver tab
 * - Currency tab (new)
 * - Symbol Lookup tab
 */

const MOCK_MARKET_PRICES = {
  success: true,
  message: "Market prices retrieved successfully",
  gold: [
    {
      typeCode: "SJL1L10",
      name: "SJC 1L-10L",
      buy: 95500000,
      sell: 97500000,
      changeBuy: 500000,
      changeSell: 500000,
      currency: "VND",
      updatedAt: Math.floor(Date.now() / 1000),
    },
  ],
  silver: [
    {
      typeCode: "PHU_QUY_THOI_1L",
      name: "Phú Quý thỏi 1L",
      buy: 1150000,
      sell: 1250000,
      changeBuy: 0,
      changeSell: 0,
      currency: "VND",
      updatedAt: Math.floor(Date.now() / 1000),
    },
  ],
  currency: [
    {
      typeCode: "USD",
      name: "USD Tự Do",
      buy: 25800,
      sell: 25900,
      changeBuy: 50,
      changeSell: 50,
      currency: "VND",
      updatedAt: Math.floor(Date.now() / 1000),
    },
    {
      typeCode: "EUR",
      name: "EUR",
      buy: 27500,
      sell: 28000,
      changeBuy: 0,
      changeSell: 0,
      currency: "VND",
      updatedAt: Math.floor(Date.now() / 1000),
    },
  ],
  timestamp: new Date().toISOString(),
};

test.describe("View Market Prices Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth verify
    await page.route("**/api/v1/auth/verify**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            email: "test@example.com",
            name: "Test User",
            picture: "",
            preferredCurrency: "VND",
            preferredLanguage: "en",
          },
        }),
      });
    });

    // Mock market prices endpoint
    await page.route("**/api/v1/investments/market-prices**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_MARKET_PRICES),
      });
    });

    // Mock wallets (sidebar may need this)
    await page.route("**/api/v1/wallets**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [], wallets: [], total: 0 }),
      });
    });

    // Set auth token
    await page.goto("/auth/login");
    await page.evaluate(() => {
      localStorage.setItem("token", "mock-test-token");
    });
  });

  test("should display prices page with gold tab by default", async ({
    page,
  }) => {
    await page.goto("/dashboard/prices");
    await page.waitForLoadState("networkidle");

    // Page title should be visible
    const heading = page.locator("h1");
    await expect(heading).toBeVisible();

    // Tabs should be visible
    const tabs = page.locator("button");
    const tabTexts = await tabs.allTextContents();
    const hasGoldTab = tabTexts.some(
      (t) => t.toLowerCase().includes("gold") || t.includes("Vàng"),
    );
    const hasSilverTab = tabTexts.some(
      (t) => t.toLowerCase().includes("silver") || t.includes("Bạc"),
    );
    const hasCurrencyTab = tabTexts.some(
      (t) =>
        t.toLowerCase().includes("currency") || t.includes("Ngoại Tệ"),
    );

    expect(hasGoldTab).toBeTruthy();
    expect(hasSilverTab).toBeTruthy();
    expect(hasCurrencyTab).toBeTruthy();
  });

  test("should switch to currency tab and display currency prices", async ({
    page,
  }) => {
    await page.goto("/dashboard/prices");
    await page.waitForLoadState("networkidle");

    // Find and click the currency tab
    const currencyTab = page
      .locator("button")
      .filter({
        hasText: /currency|Ngoại Tệ/i,
      })
      .first();
    await currencyTab.click();

    // Wait for content to render
    await page.waitForTimeout(500);

    // Check that currency data is displayed (USD from mock)
    const pageContent = await page.textContent("body");
    expect(
      pageContent?.includes("USD") || pageContent?.includes("EUR"),
    ).toBeTruthy();
  });

  test("should switch between all tabs", async ({ page }) => {
    await page.goto("/dashboard/prices");
    await page.waitForLoadState("networkidle");

    // Click silver tab
    const silverTab = page
      .locator("button")
      .filter({ hasText: /silver|Bạc/i })
      .first();
    await silverTab.click();
    await page.waitForTimeout(300);

    // Click currency tab
    const currencyTab = page
      .locator("button")
      .filter({ hasText: /currency|Ngoại Tệ/i })
      .first();
    await currencyTab.click();
    await page.waitForTimeout(300);

    // Click symbol lookup tab
    const symbolTab = page
      .locator("button")
      .filter({ hasText: /symbol|Tra cứu/i })
      .first();
    await symbolTab.click();
    await page.waitForTimeout(300);

    // Symbol tab should show search input
    const searchInput = page.locator('input[type="text"], input[type="search"]');
    const inputCount = await searchInput.count();
    expect(inputCount).toBeGreaterThan(0);
  });

  test("should show refresh button on commodity tabs but not on symbol tab", async ({
    page,
  }) => {
    await page.goto("/dashboard/prices");
    await page.waitForLoadState("networkidle");

    // On gold tab, refresh button should be visible
    const refreshBtn = page
      .locator("button")
      .filter({ hasText: /refresh|Làm mới/i });
    const refreshCount = await refreshBtn.count();
    expect(refreshCount).toBeGreaterThan(0);

    // Switch to symbol tab
    const symbolTab = page
      .locator("button")
      .filter({ hasText: /symbol|Tra cứu/i })
      .first();
    await symbolTab.click();
    await page.waitForTimeout(300);

    // Refresh button should be hidden on symbol tab
    const refreshAfter = page
      .locator("button")
      .filter({ hasText: /refresh|Làm mới/i });
    await expect(refreshAfter).toHaveCount(0);
  });
});

test.describe("View Market Prices Flow - Mobile", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test.beforeEach(async ({ page }) => {
    await page.route("**/api/v1/auth/verify**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            email: "test@example.com",
            name: "Test User",
            picture: "",
            preferredCurrency: "VND",
            preferredLanguage: "en",
          },
        }),
      });
    });
    await page.route("**/api/v1/investments/market-prices**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_MARKET_PRICES),
      });
    });
    await page.route("**/api/v1/wallets**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [], wallets: [], total: 0 }),
      });
    });
    await page.goto("/auth/login");
    await page.evaluate(() => {
      localStorage.setItem("token", "mock-test-token");
    });
  });

  test("should display tabs on mobile and allow switching", async ({
    page,
  }) => {
    await page.goto("/dashboard/prices");
    await page.waitForLoadState("networkidle");

    // All tabs should be visible (may need horizontal scroll)
    const tabs = page.locator("button");
    const tabTexts = await tabs.allTextContents();
    const hasCurrencyTab = tabTexts.some(
      (t) =>
        t.toLowerCase().includes("currency") || t.includes("Ngoại Tệ"),
    );
    expect(hasCurrencyTab).toBeTruthy();

    // Switch to currency tab on mobile
    const currencyTab = page
      .locator("button")
      .filter({ hasText: /currency|Ngoại Tệ/i })
      .first();
    await currencyTab.click();
    await page.waitForTimeout(500);

    // Content should be displayed
    const body = await page.textContent("body");
    expect(body).toBeTruthy();
  });
});

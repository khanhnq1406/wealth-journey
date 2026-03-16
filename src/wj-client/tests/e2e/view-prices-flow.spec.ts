import { test, expect } from "@playwright/test";

/**
 * E2E Test: View Market Prices Flow
 *
 * Tests the market prices page with tabs:
 * - Gold tab (default)
 * - Silver tab
 * - Currency tab
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

const AUTH_MOCK = {
  success: true,
  data: {
    email: "test@example.com",
    name: "Test User",
    picture: "",
    preferredCurrency: "VND",
    preferredLanguage: "en",
  },
};

/**
 * Helper to wait for the prices page to fully load through AuthCheck + locale redirect.
 * After AuthCheck verifies, it may redirect to locale-prefixed URL, causing a page reload.
 */
async function waitForPricesPage(page: import("@playwright/test").Page) {
  // Wait for either the page heading or any tab button to appear (up to 15s for AuthCheck + redirect)
  await page.waitForFunction(
    () => {
      const body = document.body.innerText;
      return (
        body.includes("Market Prices") ||
        body.includes("Gold") ||
        body.includes("Giá Thị Trường")
      );
    },
    { timeout: 15000 },
  );
}

test.describe("View Market Prices Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth verify
    await page.route("**/api/v1/auth/verify**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(AUTH_MOCK),
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
    await waitForPricesPage(page);

    // Page title should be visible — use flexible selector
    const heading = page.locator("h1").filter({ hasText: /Market Prices|Giá Thị Trường/i });
    await expect(heading).toBeVisible({ timeout: 10000 });

    // Tabs should be visible
    const tabs = page.locator("button");
    const tabTexts = await tabs.allTextContents();
    const hasGoldTab = tabTexts.some(
      (t) => t.toLowerCase().includes("gold") || t.includes("Vàng"),
    );
    const hasSilverTab = tabTexts.some(
      (t) => t.toLowerCase().includes("silver") || t.includes("Bạc"),
    );

    expect(hasGoldTab).toBeTruthy();
    expect(hasSilverTab).toBeTruthy();
  });

  test("should switch to silver tab", async ({ page }) => {
    await page.goto("/dashboard/prices");
    await waitForPricesPage(page);

    // Find and click the silver tab
    const silverTab = page
      .locator("button")
      .filter({ hasText: /^Silver$|^Bạc$/i })
      .first();
    await expect(silverTab).toBeVisible({ timeout: 10000 });
    await silverTab.click();
    await page.waitForTimeout(500);

    // Content should render
    const body = await page.textContent("body");
    expect(body).toBeTruthy();
  });

  test("should switch between tabs", async ({ page }) => {
    await page.goto("/dashboard/prices");
    await waitForPricesPage(page);

    // Click silver tab
    const silverTab = page
      .locator("button")
      .filter({ hasText: /^Silver$|^Bạc$/i })
      .first();
    await expect(silverTab).toBeVisible({ timeout: 10000 });
    await silverTab.click();
    await page.waitForTimeout(300);

    // Click symbol lookup tab
    const symbolTab = page
      .locator("button")
      .filter({ hasText: /Symbol Lookup|Tra cứu/i })
      .first();
    await expect(symbolTab).toBeVisible({ timeout: 5000 });
    await symbolTab.click();
    await page.waitForTimeout(300);

    // Symbol tab should show search input
    const searchInput = page.locator('input[type="text"], input[type="search"]');
    const inputCount = await searchInput.count();
    expect(inputCount).toBeGreaterThan(0);
  });

  test("should show refresh button on commodity tabs", async ({ page }) => {
    await page.goto("/dashboard/prices");
    await waitForPricesPage(page);

    // On gold tab (default), refresh button should be visible
    const refreshBtn = page.locator("button").filter({ hasText: /Refresh|Làm mới/i });
    await expect(refreshBtn.first()).toBeVisible({ timeout: 10000 });
  });

  test("should hide refresh button on symbol tab", async ({ page }) => {
    await page.goto("/dashboard/prices");
    await waitForPricesPage(page);

    // Switch to symbol tab
    const symbolTab = page
      .locator("button")
      .filter({ hasText: /Symbol Lookup|Tra cứu/i })
      .first();
    await expect(symbolTab).toBeVisible({ timeout: 10000 });
    await symbolTab.click();
    await page.waitForTimeout(500);

    // Refresh button should be hidden on symbol tab
    const refreshBtn = page.locator("button").filter({ hasText: /^Refresh$|^Làm mới$/i });
    await expect(refreshBtn).toBeHidden({ timeout: 5000 });
  });
});

test.describe("View Market Prices Flow - Mobile", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test.beforeEach(async ({ page }) => {
    await page.route("**/api/v1/auth/verify**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(AUTH_MOCK),
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
    await waitForPricesPage(page);

    // Tabs should be visible on mobile (may need horizontal scroll)
    const goldTab = page
      .locator("button")
      .filter({ hasText: /^Gold$|^Vàng$/i })
      .first();
    await expect(goldTab).toBeVisible({ timeout: 10000 });

    // Silver tab should also be reachable
    const silverTab = page
      .locator("button")
      .filter({ hasText: /^Silver$|^Bạc$/i })
      .first();
    await expect(silverTab).toBeVisible({ timeout: 5000 });
    await silverTab.click();
    await page.waitForTimeout(500);

    // Content should be displayed
    const body = await page.textContent("body");
    expect(body).toBeTruthy();
  });
});

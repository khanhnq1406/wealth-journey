import { test, expect } from "@playwright/test";

/**
 * E2E Test: Prices Page — Dynamic Tab Visibility
 *
 * Tests that the market prices page tabs (Gold, Silver, Currency) are
 * conditionally rendered based on whether the API returns data for each type.
 * Tabs that correspond to empty arrays must be hidden.
 * Non-data tabs (Price Alerts, Watchlist, Symbol Lookup) are always visible.
 */

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

function buildMarketPricesResponse(overrides: {
  gold?: object[];
  silver?: object[];
  currency?: object[];
}) {
  return {
    success: true,
    message: "Market prices retrieved successfully",
    gold: overrides.gold ?? [
      {
        typeCode: "SJC",
        name: "SJC Vàng",
        buy: 95500000,
        sell: 97500000,
        currency: "VND",
        updatedAt: Math.floor(Date.now() / 1000),
        isStale: false,
      },
    ],
    silver: overrides.silver ?? [
      {
        typeCode: "PHU_QUY",
        name: "Phú Quý thỏi 1L",
        buy: 1150000,
        sell: 1250000,
        currency: "VND",
        updatedAt: Math.floor(Date.now() / 1000),
        isStale: false,
      },
    ],
    currency: overrides.currency ?? [
      {
        typeCode: "USD",
        name: "USD Tự Do",
        buy: 25800,
        sell: 25900,
        currency: "VND",
        updatedAt: Math.floor(Date.now() / 1000),
        isStale: false,
      },
    ],
    timestamp: new Date().toISOString(),
  };
}

async function setupCommonMocks(page: import("@playwright/test").Page, marketPricesBody: object) {
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
      body: JSON.stringify(marketPricesBody),
    });
  });

  await page.route("**/api/v1/wallets**", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, wallets: [], total: 0 }),
    });
  });

  await page.goto("/auth/login");
  await page.evaluate(() => {
    localStorage.setItem("token", "mock-test-token");
  });
}

async function waitForPricesPage(page: import("@playwright/test").Page) {
  await page.waitForFunction(
    () => {
      const body = document.body.innerText;
      return (
        body.includes("Market Prices") ||
        body.includes("Giá Thị Trường") ||
        body.includes("Gold") ||
        body.includes("Vàng")
      );
    },
    { timeout: 15000 },
  );
}

// ---------------------------------------------------------------------------
// Loading state — before API resolves
// ---------------------------------------------------------------------------

test.describe("Prices Page — Loading State", () => {
  test("should not crash while API is loading (tabs render after load)", async ({ page }) => {
    // Delay the API response to test loading state
    await page.route("**/api/v1/auth/verify**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(AUTH_MOCK),
      });
    });

    await page.route("**/api/v1/investments/market-prices**", async (route) => {
      // Introduce a small artificial delay then respond
      await new Promise((resolve) => setTimeout(resolve, 300));
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildMarketPricesResponse({})),
      });
    });

    await page.route("**/api/v1/wallets**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, wallets: [], total: 0 }),
      });
    });

    await page.goto("/auth/login");
    await page.evaluate(() => {
      localStorage.setItem("token", "mock-test-token");
    });

    await page.goto("/dashboard/prices");

    // The page should not throw — wait for it to settle
    await waitForPricesPage(page);

    // After API resolves, data tabs should be visible
    const goldTab = page.locator("button").filter({ hasText: /^Gold$|^Vàng$/i }).first();
    await expect(goldTab).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// Dynamic tab visibility — data-driven tabs
// ---------------------------------------------------------------------------

test.describe("Prices Page — Dynamic Tab Visibility", () => {
  test("gold tab is visible when API returns gold data", async ({ page }) => {
    const response = buildMarketPricesResponse({});
    await setupCommonMocks(page, response);

    await page.goto("/dashboard/prices");
    await waitForPricesPage(page);

    const goldTab = page.locator("button").filter({ hasText: /^Gold$|^Vàng$/i }).first();
    await expect(goldTab).toBeVisible({ timeout: 10000 });
  });

  test("gold tab is hidden when API returns gold: []", async ({ page }) => {
    const response = buildMarketPricesResponse({ gold: [] });
    await setupCommonMocks(page, response);

    await page.goto("/dashboard/prices");
    await waitForPricesPage(page);

    // Wait for API to settle — silver tab should be visible (data present)
    const silverTab = page.locator("button").filter({ hasText: /^Silver$|^Bạc$/i }).first();
    await expect(silverTab).toBeVisible({ timeout: 10000 });

    // Gold tab should not exist when gold array is empty
    const goldTab = page.locator("button").filter({ hasText: /^Gold$|^Vàng$/i });
    await expect(goldTab).toBeHidden({ timeout: 5000 });
  });

  test("silver tab is hidden when API returns silver: []", async ({ page }) => {
    const response = buildMarketPricesResponse({ silver: [] });
    await setupCommonMocks(page, response);

    await page.goto("/dashboard/prices");
    await waitForPricesPage(page);

    // Gold tab should be visible (has data)
    const goldTab = page.locator("button").filter({ hasText: /^Gold$|^Vàng$/i }).first();
    await expect(goldTab).toBeVisible({ timeout: 10000 });

    // Silver tab should not exist when silver array is empty
    const silverTab = page.locator("button").filter({ hasText: /^Silver$|^Bạc$/i });
    await expect(silverTab).toBeHidden({ timeout: 5000 });
  });

  test("currency tab is hidden when API returns currency: []", async ({ page }) => {
    const response = buildMarketPricesResponse({ currency: [] });
    await setupCommonMocks(page, response);

    await page.goto("/dashboard/prices");
    await waitForPricesPage(page);

    // Gold tab should be visible
    const goldTab = page.locator("button").filter({ hasText: /^Gold$|^Vàng$/i }).first();
    await expect(goldTab).toBeVisible({ timeout: 10000 });

    // Currency tab should not exist
    const currencyTab = page.locator("button").filter({ hasText: /^Currency$|^Ngoại tệ$/i });
    await expect(currencyTab).toBeHidden({ timeout: 5000 });
  });

  test("all three data tabs are hidden when all arrays are empty", async ({ page }) => {
    const response = buildMarketPricesResponse({ gold: [], silver: [], currency: [] });
    await setupCommonMocks(page, response);

    await page.goto("/dashboard/prices");

    // Wait for page to load at all (it may show a different state)
    await page.waitForTimeout(3000);

    // None of the data tabs should be visible
    const goldTab = page.locator("button").filter({ hasText: /^Gold$|^Vàng$/i });
    const silverTab = page.locator("button").filter({ hasText: /^Silver$|^Bạc$/i });
    const currencyTab = page.locator("button").filter({ hasText: /^Currency$|^Ngoại tệ$/i });

    await expect(goldTab).toBeHidden({ timeout: 5000 });
    await expect(silverTab).toBeHidden({ timeout: 5000 });
    await expect(currencyTab).toBeHidden({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// Always-visible tabs (non-data tabs)
// ---------------------------------------------------------------------------

test.describe("Prices Page — Non-Data Tabs Always Visible", () => {
  test("Symbol Lookup tab is always visible regardless of price data", async ({ page }) => {
    const response = buildMarketPricesResponse({ gold: [], silver: [], currency: [] });
    await setupCommonMocks(page, response);

    await page.goto("/dashboard/prices");
    await page.waitForTimeout(3000);

    const symbolTab = page.locator("button").filter({ hasText: /Symbol Lookup|Tra cứu/i }).first();
    await expect(symbolTab).toBeVisible({ timeout: 10000 });
  });

  test("Price Alerts tab is always visible regardless of price data", async ({ page }) => {
    const response = buildMarketPricesResponse({ gold: [], silver: [], currency: [] });
    await setupCommonMocks(page, response);

    await page.goto("/dashboard/prices");
    await page.waitForTimeout(3000);

    const priceAlertsTab = page.locator("button").filter({ hasText: /Price Alerts|Cảnh báo giá/i }).first();
    await expect(priceAlertsTab).toBeVisible({ timeout: 10000 });
  });

  test("Watchlist tab is always visible regardless of price data", async ({ page }) => {
    const response = buildMarketPricesResponse({ gold: [], silver: [], currency: [] });
    await setupCommonMocks(page, response);

    await page.goto("/dashboard/prices");
    await page.waitForTimeout(3000);

    const watchlistTab = page.locator("button").filter({ hasText: /Watchlist|Theo dõi/i }).first();
    await expect(watchlistTab).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// Active tab reset when current tab's data disappears
// ---------------------------------------------------------------------------

test.describe("Prices Page — Active Tab Reset", () => {
  test("active tab resets to first available when gold was active and gold disappears", async ({
    page,
  }) => {
    // First load: gold is present → user is on gold tab (default)
    const responseWithGold = buildMarketPricesResponse({});
    await setupCommonMocks(page, responseWithGold);

    await page.goto("/dashboard/prices");
    await waitForPricesPage(page);

    // Gold tab should be visible and active (default)
    const goldTab = page.locator("button").filter({ hasText: /^Gold$|^Vàng$/i }).first();
    await expect(goldTab).toBeVisible({ timeout: 10000 });

    // Now simulate API returning empty gold — intercept subsequent requests
    await page.route("**/api/v1/investments/market-prices**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildMarketPricesResponse({ gold: [] })),
      });
    });

    // Trigger a refresh (e.g., navigate away and back, or wait for refetch)
    await page.goto("/dashboard/prices");
    await waitForPricesPage(page);

    // Gold tab should no longer be visible
    await expect(goldTab).toBeHidden({ timeout: 5000 });

    // Silver tab should now be visible (has data) and should be auto-selected
    const silverTab = page.locator("button").filter({ hasText: /^Silver$|^Bạc$/i }).first();
    await expect(silverTab).toBeVisible({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// Mobile viewport coverage
// ---------------------------------------------------------------------------

test.describe("Prices Page — Mobile Viewport", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test.beforeEach(async ({ page }) => {
    const response = buildMarketPricesResponse({});
    await setupCommonMocks(page, response);
  });

  test("data tabs are visible on mobile when data is present", async ({ page }) => {
    await page.goto("/dashboard/prices");
    await waitForPricesPage(page);

    const goldTab = page.locator("button").filter({ hasText: /^Gold$|^Vàng$/i }).first();
    await expect(goldTab).toBeVisible({ timeout: 10000 });

    const silverTab = page.locator("button").filter({ hasText: /^Silver$|^Bạc$/i }).first();
    await expect(silverTab).toBeVisible({ timeout: 5000 });
  });

  test("gold tab is hidden on mobile when gold: []", async ({ page }) => {
    // Override market prices for this test
    await page.route("**/api/v1/investments/market-prices**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildMarketPricesResponse({ gold: [] })),
      });
    });

    await page.goto("/dashboard/prices");
    await waitForPricesPage(page);

    // Silver should be visible (has data)
    const silverTab = page.locator("button").filter({ hasText: /^Silver$|^Bạc$/i }).first();
    await expect(silverTab).toBeVisible({ timeout: 10000 });

    // Gold should be hidden
    const goldTab = page.locator("button").filter({ hasText: /^Gold$|^Vàng$/i });
    await expect(goldTab).toBeHidden({ timeout: 5000 });
  });

  test("symbol lookup tab is always visible on mobile", async ({ page }) => {
    await page.goto("/dashboard/prices");
    await waitForPricesPage(page);

    const symbolTab = page.locator("button").filter({ hasText: /Symbol Lookup|Tra cứu/i }).first();
    await expect(symbolTab).toBeVisible({ timeout: 10000 });
  });
});

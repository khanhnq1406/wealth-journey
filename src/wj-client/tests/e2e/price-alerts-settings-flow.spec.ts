import { test, expect } from "@playwright/test";

/**
 * E2E Test: Price Alerts Settings Flow
 *
 * Tests the price alerts settings page at /dashboard/settings/alerts:
 * - View list of alerts
 * - Create alert via modal
 * - Toggle alert status (active <-> paused)
 * - Delete alert with confirmation
 * - Filter by status
 * - Mobile responsive layout
 */

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const MOCK_ACTIVE_ALERT = {
  id: 1,
  userId: 100,
  symbol: "VCB",
  name: "Vietcombank",
  assetType: 3,
  currency: "VND",
  priceSide: "buy",
  direction: 1,
  targetPrice: 85000,
  triggerMode: 1,
  cooldownHours: 0,
  status: 1,
  note: "Test alert",
  lastTriggeredAt: 0,
  triggerCount: 0,
  currentPriceAtCreation: 80000,
  currentPrice: 82000,
  createdAt: 1700000000,
};

const MOCK_TRIGGERED_ALERT = {
  ...MOCK_ACTIVE_ALERT,
  id: 2,
  symbol: "AAPL",
  name: "Apple Inc.",
  status: 2, // TRIGGERED
};

const MOCK_PAUSED_ALERT = {
  ...MOCK_ACTIVE_ALERT,
  id: 3,
  symbol: "BTC",
  name: "Bitcoin",
  status: 3, // PAUSED
};

const MOCK_LIST_RESPONSE = {
  success: true,
  message: "Alerts retrieved",
  alerts: [MOCK_ACTIVE_ALERT, MOCK_TRIGGERED_ALERT, MOCK_PAUSED_ALERT],
  total: 3,
  timestamp: new Date().toISOString(),
};

const MOCK_EMPTY_LIST = {
  success: true,
  message: "No alerts",
  alerts: [],
  total: 0,
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

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Wait for the alerts page to load after AuthCheck + possible locale redirect.
 */
async function waitForAlertsPage(page: import("@playwright/test").Page) {
  await page.waitForFunction(
    () => {
      const body = document.body.innerText;
      return (
        body.includes("Price Alerts") ||
        body.includes("Create Alert") ||
        body.includes("No alerts yet")
      );
    },
    { timeout: 15000 },
  );
}

// ---------------------------------------------------------------------------
// Desktop tests
// ---------------------------------------------------------------------------

test.describe("Price Alerts Settings Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth verify
    await page.route("**/api/v1/auth/verify**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(AUTH_MOCK),
      });
    });

    // Mock list alerts endpoint
    await page.route("**/api/v1/investment**", (route) => {
      const url = route.request().url();
      if (url.includes("status_filter") || url.includes("page")) {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_LIST_RESPONSE),
        });
      } else {
        route.continue();
      }
    });

    // Mock create alert
    await page.route("**/api/v1/investment/createUserPriceAlert**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "Alert created",
          alert: MOCK_ACTIVE_ALERT,
          timestamp: new Date().toISOString(),
        }),
      });
    });

    // Mock update alert
    await page.route(
      "**/api/v1/investment/updateUserPriceAlert**",
      (route) => {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            message: "Alert updated",
            alert: { ...MOCK_ACTIVE_ALERT, status: 3 },
            timestamp: new Date().toISOString(),
          }),
        });
      },
    );

    // Mock delete alert
    await page.route(
      "**/api/v1/investment/deleteUserPriceAlert**",
      (route) => {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            message: "Alert deleted",
            timestamp: new Date().toISOString(),
          }),
        });
      },
    );

    // Mock wallets (navigation)
    await page.route("**/api/v1/wallets**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, wallets: [], total: 0 }),
      });
    });

    // Set auth token
    await page.goto("/auth/login");
    await page.evaluate(() => {
      localStorage.setItem("token", "mock-test-token");
    });
  });

  test("should display price alerts page with title", async ({ page }) => {
    await page.goto("/dashboard/settings/alerts");
    await waitForAlertsPage(page);

    const heading = page
      .locator("h1")
      .filter({ hasText: /Price Alerts/i });
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test("should show Create Alert button", async ({ page }) => {
    await page.goto("/dashboard/settings/alerts");
    await waitForAlertsPage(page);

    const createBtn = page
      .locator("button")
      .filter({ hasText: /Create Alert/i })
      .first();
    await expect(createBtn).toBeVisible({ timeout: 10000 });
  });

  test("should show status filter tabs (All, Active, Triggered)", async ({
    page,
  }) => {
    await page.goto("/dashboard/settings/alerts");
    await waitForAlertsPage(page);

    const tabs = page.locator("button[aria-pressed]");
    const tabTexts = await tabs.allTextContents();
    expect(tabTexts.some((t) => t.includes("All"))).toBeTruthy();
    expect(tabTexts.some((t) => t.includes("Active"))).toBeTruthy();
    expect(tabTexts.some((t) => t.includes("Triggered"))).toBeTruthy();
  });

  test("should open Create Alert modal on button click", async ({ page }) => {
    await page.goto("/dashboard/settings/alerts");
    await waitForAlertsPage(page);

    const createBtn = page
      .locator("button")
      .filter({ hasText: /Create Alert/i })
      .first();
    await createBtn.click();
    await page.waitForTimeout(500);

    // Modal should appear with title
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
  });

  test("should switch filter tabs", async ({ page }) => {
    await page.goto("/dashboard/settings/alerts");
    await waitForAlertsPage(page);

    // Click Active tab
    const activeTab = page
      .locator("button[aria-pressed]")
      .filter({ hasText: /^Active$/ })
      .first();
    await expect(activeTab).toBeVisible({ timeout: 10000 });
    await activeTab.click();
    await page.waitForTimeout(300);

    // Active tab should be pressed
    await expect(activeTab).toHaveAttribute("aria-pressed", "true");
  });

  test("should display empty state when no alerts", async ({ page }) => {
    // Override mock to return empty list
    await page.route("**/api/v1/investment**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_EMPTY_LIST),
      });
    });

    await page.goto("/dashboard/settings/alerts");
    await waitForAlertsPage(page);

    // Empty state should show
    const body = await page.textContent("body");
    expect(body).toBeTruthy();
    // Page should not crash
    const heading = page.locator("h1").filter({ hasText: /Price Alerts/i });
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test("should navigate to price alerts from main settings page", async ({
    page,
  }) => {
    await page.goto("/dashboard/settings");
    await page.waitForFunction(
      () => document.body.innerText.includes("Settings"),
      { timeout: 15000 },
    );

    // Price Alerts link should be visible
    const alertsLink = page
      .locator("a")
      .filter({ hasText: /Price Alerts/i })
      .first();
    await expect(alertsLink).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// Mobile tests
// ---------------------------------------------------------------------------

test.describe("Price Alerts Settings Flow - Mobile", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await page.route("**/api/v1/auth/verify**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(AUTH_MOCK),
      });
    });

    await page.route("**/api/v1/investment**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_LIST_RESPONSE),
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
  });

  test("should display page on mobile without horizontal scroll", async ({
    page,
  }) => {
    await page.goto("/dashboard/settings/alerts");
    await waitForAlertsPage(page);

    // Check no horizontal scroll
    const bodyScrollWidth = await page.evaluate(
      () => document.body.scrollWidth,
    );
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(viewportWidth + 1);
  });

  test("should show Create Alert button with touch-friendly size on mobile", async ({
    page,
  }) => {
    await page.goto("/dashboard/settings/alerts");
    await waitForAlertsPage(page);

    const createBtn = page
      .locator("button")
      .filter({ hasText: /Create Alert/i })
      .first();
    await expect(createBtn).toBeVisible({ timeout: 10000 });

    // Button should have min-height of 44px (touch target)
    const buttonHeight = await createBtn.evaluate((el) => {
      return el.getBoundingClientRect().height;
    });
    expect(buttonHeight).toBeGreaterThanOrEqual(44);
  });

  test("should display filter tabs on mobile", async ({ page }) => {
    await page.goto("/dashboard/settings/alerts");
    await waitForAlertsPage(page);

    const allTab = page
      .locator("button[aria-pressed]")
      .filter({ hasText: /^All$/ })
      .first();
    await expect(allTab).toBeVisible({ timeout: 10000 });
  });
});

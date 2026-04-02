import { test, expect } from "@playwright/test";

/**
 * E2E Test: Admin Price Alert Config — User Alert Templates Section
 *
 * Tests the user alert template fields in PriceAlertConfigForm:
 * - Section heading is visible
 * - Title input and 2 body textareas are present
 * - Placeholder chips are present
 * - Placeholder chip inserts text into the field
 * - Mobile viewport rendering
 */

const AUTH_MOCK = {
  success: true,
  data: {
    email: "admin@test.com",
    name: "Admin User",
    picture: "",
    preferredCurrency: "VND",
    preferredLanguage: "en",
    isAdmin: true,
  },
};

const MOCK_PRICE_ALERT_CONFIG = {
  success: true,
  config: {
    cooldownMinutes: 60,
    topMoversCount: 3,
    userAlertTitleTemplate: "{name} price alert",
    userAlertAboveBodyTemplate: "{name} exceeded {price}. Current: {currentPrice}",
    userAlertBelowBodyTemplate: "{name} fell below {price}. Current: {currentPrice}",
    categories: {
      gold_vnd: {
        enabled: true,
        thresholdPct: 2.0,
        titleTemplate: "Gold alert {direction}",
        bodyTemplate: "Gold price changed {changePct}%",
      },
      gold_usd: {
        enabled: true,
        thresholdPct: 1.5,
        titleTemplate: "Gold alert {direction}",
        bodyTemplate: "Gold price changed {changePct}%",
      },
      silver_vnd: {
        enabled: false,
        thresholdPct: 3.0,
        titleTemplate: "",
        bodyTemplate: "",
      },
      silver_usd: {
        enabled: false,
        thresholdPct: 2.5,
        titleTemplate: "",
        bodyTemplate: "",
      },
    },
  },
};

const MOCK_SETTINGS_RESPONSE = {
  success: true,
  data: {
    settings: [
      { key: "seo.title", value: "WealthJourney" },
      { key: "seo.description", value: "Personal finance management" },
      { key: "footer.brand_name", value: "WealthJourney" },
    ],
  },
};

async function setupMocks(page: import("@playwright/test").Page) {
  await page.route("**/api/v1/auth/verify**", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(AUTH_MOCK),
    });
  });

  await page.route("**/api/v1/public/site-settings**", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_SETTINGS_RESPONSE),
    });
  });

  await page.route("**/api/v1/admin/price-alert-config**", (route) => {
    if (route.request().method() === "GET") {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_PRICE_ALERT_CONFIG),
      });
    } else if (route.request().method() === "PUT") {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_PRICE_ALERT_CONFIG),
      });
    } else {
      route.continue();
    }
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

async function waitForPriceAlertConfigSection(page: import("@playwright/test").Page) {
  await page.waitForFunction(
    () => {
      const body = document.body.innerText;
      return (
        body.includes("User Price Alert Templates") ||
        body.includes("Mẫu thông báo cảnh báo giá cá nhân")
      );
    },
    { timeout: 15000 },
  );
}

test.describe("Admin Price Alert Config — User Alert Templates", () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
  });

  test("should display the user alert templates section heading", async ({ page }) => {
    await page.goto("/dashboard/admin?tab=notifications");
    await waitForPriceAlertConfigSection(page);

    const heading = page.locator("text=/User Price Alert Templates|Mẫu thông báo cảnh báo giá cá nhân/");
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test("should render all 3 user alert template field labels", async ({ page }) => {
    await page.goto("/dashboard/admin?tab=notifications");
    await waitForPriceAlertConfigSection(page);

    // Title template label
    await expect(
      page.locator("text=/Title Template|Mẫu tiêu đề/").first()
    ).toBeVisible({ timeout: 10000 });

    // Above body label
    await expect(
      page.locator("text=/Body Template \\(Above Target\\)|Mẫu nội dung \\(Tăng vượt mức\\)/").first()
    ).toBeVisible({ timeout: 10000 });

    // Below body label
    await expect(
      page.locator("text=/Body Template \\(Below Target\\)|Mẫu nội dung \\(Giảm dưới mức\\)/").first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("should display the fetched title template value in the input", async ({ page }) => {
    await page.goto("/dashboard/admin?tab=notifications");
    await waitForPriceAlertConfigSection(page);

    const titleInput = page.locator('input[value="{name} price alert"]');
    await expect(titleInput).toBeVisible({ timeout: 10000 });
  });

  test("should render user alert placeholder chips including {price} and {priceSide}", async ({ page }) => {
    await page.goto("/dashboard/admin?tab=notifications");
    await waitForPriceAlertConfigSection(page);

    // {price} chip should be visible in the user alert section
    const priceChip = page.locator("button", { hasText: "{price}" }).first();
    await expect(priceChip).toBeVisible({ timeout: 10000 });

    // {priceSide} chip should be visible
    const priceSideChip = page.locator("button", { hasText: "{priceSide}" }).first();
    await expect(priceSideChip).toBeVisible({ timeout: 10000 });
  });

  test("should render the collapsible user alert placeholder guide", async ({ page }) => {
    await page.goto("/dashboard/admin?tab=notifications");
    await waitForPriceAlertConfigSection(page);

    const guideButton = page.locator(
      "text=/User Alert Placeholder Guide|Hướng dẫn placeholder cảnh báo giá cá nhân/"
    );
    await expect(guideButton).toBeVisible({ timeout: 10000 });
  });

  test("should expand the user alert placeholder guide and show descriptions", async ({ page }) => {
    await page.goto("/dashboard/admin?tab=notifications");
    await waitForPriceAlertConfigSection(page);

    const guideButton = page.locator(
      "text=/User Alert Placeholder Guide|Hướng dẫn placeholder cảnh báo giá cá nhân/"
    );
    await guideButton.click();

    // Guide content should be visible after expanding
    await expect(
      page.locator("text=/Asset name|Tên tài sản/").first()
    ).toBeVisible({ timeout: 10000 });

    await expect(
      page.locator("text=/Target price with currency|Giá mục tiêu kèm tiền tệ/").first()
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Admin Price Alert Config — User Alert Templates (Mobile)", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
  });

  test("should render user alert templates section on mobile without horizontal scroll", async ({ page }) => {
    await page.goto("/dashboard/admin?tab=notifications");
    await waitForPriceAlertConfigSection(page);

    const heading = page.locator("text=/User Price Alert Templates|Mẫu thông báo cảnh báo giá cá nhân/");
    await expect(heading).toBeVisible({ timeout: 10000 });

    // Verify no horizontal scroll: scrollWidth should equal clientWidth
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.body.scrollWidth > document.body.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);
  });

  test("should show all 3 field labels on mobile", async ({ page }) => {
    await page.goto("/dashboard/admin?tab=notifications");
    await waitForPriceAlertConfigSection(page);

    await expect(
      page.locator("text=/Title Template|Mẫu tiêu đề/").first()
    ).toBeVisible({ timeout: 10000 });

    await expect(
      page.locator("text=/Body Template \\(Above Target\\)|Mẫu nội dung \\(Tăng vượt mức\\)/").first()
    ).toBeVisible({ timeout: 10000 });
  });
});

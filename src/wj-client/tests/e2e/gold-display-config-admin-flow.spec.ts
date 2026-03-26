import { test, expect } from "@playwright/test";

/**
 * E2E Test: Gold Display Config Admin Management
 *
 * Tests admin gold-config tab navigation and CRUD rendering:
 * - Navigate to Gold Config tab
 * - Verify config table renders with display names
 * - Verify Add button opens create modal
 * - Verify Edit button opens edit modal
 * - Verify Delete button opens confirmation dialog
 *
 * Uses mocked API responses for structural verification.
 */

const AUTH_MOCK = {
  success: true,
  data: {
    email: "admin@test.com",
    name: "Admin User",
    picture: "",
    preferredCurrency: "VND",
    preferredLanguage: "vi",
    isAdmin: true,
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

const MOCK_GOLD_DISPLAY_CONFIGS = {
  configs: [
    {
      id: 1,
      typeCode: "SJC_1L",
      displayName: "SJC 1 Lượng",
      displayOrder: 1,
      enabled: true,
      showInInvestment: true,
    },
    {
      id: 2,
      typeCode: "DOJI_1L",
      displayName: "DOJI 1 Lượng",
      displayOrder: 2,
      enabled: false,
      showInInvestment: false,
    },
  ],
};

/**
 * Helper: wait for admin page to load.
 */
async function waitForAdminPage(page: import("@playwright/test").Page) {
  await page.waitForFunction(
    () => {
      const body = document.body.innerText;
      return (
        body.includes("Content Management") ||
        body.includes("Quản lý nội dung") ||
        body.includes("Gold Config") ||
        body.includes("SEO") ||
        body.includes("Users")
      );
    },
    { timeout: 15000 }
  );
}

/**
 * Helper: wait for Gold Config tab content to appear.
 */
async function waitForGoldConfigContent(page: import("@playwright/test").Page) {
  await waitForAdminPage(page);
  await page.waitForFunction(
    () => {
      const body = document.body.innerText;
      return (
        body.includes("Gold Display Configs") ||
        body.includes("No gold display configs found") ||
        body.includes("SJC") ||
        body.includes("DOJI")
      );
    },
    { timeout: 15000 }
  );
}

test.describe("Admin Gold Display Config Tab", () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth verify
    await page.route("**/api/v1/auth/verify**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(AUTH_MOCK),
      });
    });

    // Mock site settings
    await page.route("**/api/v1/public/site-settings**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SETTINGS_RESPONSE),
      });
    });

    // Mock wallets (sidebar)
    await page.route("**/api/v1/wallets**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, wallets: [], total: 0 }),
      });
    });

    // Mock gold display config list
    await page.route("**/api/v1/admin/gold-display-config**", (route) => {
      if (route.request().method() === "GET") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_GOLD_DISPLAY_CONFIGS),
        });
      } else {
        route.continue();
      }
    });

    // Mock admin users (may be fetched by sidebar or other components)
    await page.route("**/api/v1/admin/users**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          users: [],
          pagination: { totalCount: 0, totalPages: 0, page: 1, pageSize: 10 },
        }),
      });
    });

    // Set auth token
    await page.goto("/auth/login");
    await page.evaluate(() => {
      localStorage.setItem("token", "mock-test-token");
    });
  });

  test("should display Gold Config tab in admin page", async ({ page }) => {
    await page.goto("/dashboard/admin");
    await waitForAdminPage(page);

    // Gold Config tab button should be present
    const goldConfigTab = page.locator("button").filter({ hasText: /Gold Config/i });
    await expect(goldConfigTab).toBeVisible({ timeout: 10000 });
  });

  test("should navigate to Gold Config tab and render configs", async ({
    page,
  }) => {
    await page.goto("/dashboard/admin?tab=gold-config");
    await waitForGoldConfigContent(page);

    // Config display names should be visible
    await expect(page.getByText("SJC 1 Lượng")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("DOJI 1 Lượng")).toBeVisible({
      timeout: 10000,
    });
  });

  test("should show type codes in config list", async ({ page }) => {
    await page.goto("/dashboard/admin?tab=gold-config");
    await waitForGoldConfigContent(page);

    await expect(page.getByText("SJC_1L")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("DOJI_1L")).toBeVisible({ timeout: 10000 });
  });

  test("should show Add Gold Type button", async ({ page }) => {
    await page.goto("/dashboard/admin?tab=gold-config");
    await waitForGoldConfigContent(page);

    const addButton = page.locator("button").filter({ hasText: /Add Gold Type/i });
    await expect(addButton).toBeVisible({ timeout: 10000 });
  });

  test("should open create modal when Add Gold Type is clicked", async ({
    page,
  }) => {
    await page.goto("/dashboard/admin?tab=gold-config");
    await waitForGoldConfigContent(page);

    const addButton = page.locator("button").filter({ hasText: /\+ Add Gold Type/i });
    await addButton.click();

    // Modal should appear with create title
    const modal = page.locator("[role='dialog']");
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Type Code field is shown only on create
    const typeCodeLabel = page.getByText("Type Code");
    await expect(typeCodeLabel).toBeVisible({ timeout: 5000 });
  });

  test("should show Edit buttons for each config", async ({ page }) => {
    await page.goto("/dashboard/admin?tab=gold-config");
    await waitForGoldConfigContent(page);

    const editButtons = page.locator("button").filter({ hasText: /^Edit$/ });
    // There should be at least one Edit button (one per config in expanded view)
    // Note: MobileTable uses expandable, so we need to expand first or check collapsed columns
    await expect(editButtons.first()).toBeVisible({ timeout: 10000 });
  });

  test("should open delete confirmation when Delete is clicked", async ({
    page,
  }) => {
    await page.goto("/dashboard/admin?tab=gold-config");
    await waitForGoldConfigContent(page);

    // Click the first Delete button visible
    const deleteButton = page.locator("button").filter({ hasText: /^Delete$/ }).first();
    await deleteButton.click();

    // Confirmation dialog should appear
    const dialog = page.locator("[data-testid='confirmation-dialog'], [role='dialog']").filter({ hasText: /Delete Gold Type/ });
    await expect(dialog).toBeVisible({ timeout: 5000 });
  });

  test("should show empty state when no configs", async ({ page }) => {
    // Override the mock to return empty configs
    await page.route("**/api/v1/admin/gold-display-config**", (route) => {
      if (route.request().method() === "GET") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ configs: [] }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto("/dashboard/admin?tab=gold-config");
    await waitForGoldConfigContent(page);

    await expect(
      page.getByText(/no gold display configs found/i)
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Admin Gold Config Tab — Mobile (375px)", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
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

    await page.route("**/api/v1/wallets**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, wallets: [], total: 0 }),
      });
    });

    await page.route("**/api/v1/admin/gold-display-config**", (route) => {
      if (route.request().method() === "GET") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_GOLD_DISPLAY_CONFIGS),
        });
      } else {
        route.continue();
      }
    });

    await page.route("**/api/v1/admin/users**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          users: [],
          pagination: { totalCount: 0, totalPages: 0, page: 1, pageSize: 10 },
        }),
      });
    });

    await page.goto("/auth/login");
    await page.evaluate(() => {
      localStorage.setItem("token", "mock-test-token");
    });
  });

  test("should render gold config tab on mobile without horizontal scroll", async ({
    page,
  }) => {
    await page.goto("/dashboard/admin?tab=gold-config");
    await waitForGoldConfigContent(page);

    await expect(page.getByText("SJC 1 Lượng")).toBeVisible({
      timeout: 10000,
    });

    // Check that there is no horizontal overflow
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);
  });

  test("should show Add Gold Type button on mobile", async ({ page }) => {
    await page.goto("/dashboard/admin?tab=gold-config");
    await waitForGoldConfigContent(page);

    const addButton = page.locator("button").filter({ hasText: /Add Gold Type/i });
    await expect(addButton).toBeVisible({ timeout: 10000 });

    // Verify minimum touch target height
    const box = await addButton.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });
});

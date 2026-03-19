import { test, expect } from "@playwright/test";

/**
 * E2E Test: Admin User & Feedback Management Flow
 *
 * Tests admin page structure and tab navigation:
 * - SEO tab (default)
 * - Users tab
 * - Feedback tab
 *
 * These tests use mocked API responses to verify structural rendering,
 * not data mutations against a live server.
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

const MOCK_USERS_RESPONSE = {
  success: true,
  users: [
    {
      id: 1,
      name: "Admin User",
      email: "admin@test.com",
      username: "admin",
      picture: "",
      authProvider: "google",
      isAdmin: true,
      createdAt: Math.floor(Date.now() / 1000),
    },
    {
      id: 2,
      name: "Regular User",
      email: "user@test.com",
      username: "user",
      picture: "",
      authProvider: "google",
      isAdmin: false,
      createdAt: Math.floor(Date.now() / 1000),
    },
  ],
  pagination: { totalCount: 2, totalPages: 1, page: 1, pageSize: 10 },
};

const MOCK_FEEDBACK_RESPONSE = {
  success: true,
  feedback: [
    {
      id: 1,
      userId: 2,
      userName: "Regular User",
      userEmail: "user@test.com",
      subject: "Bug Report",
      message: "Something is broken",
      status: 1,
      adminNote: "",
      createdAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
    },
  ],
  pagination: { totalCount: 1, totalPages: 1, page: 1, pageSize: 10 },
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

/**
 * Helper to wait for the admin page to fully load through AuthCheck + locale redirect.
 * Supports both English and Vietnamese locales.
 */
async function waitForAdminPage(page: import("@playwright/test").Page) {
  await page.waitForFunction(
    () => {
      const body = document.body.innerText;
      return (
        body.includes("Content Management") ||
        body.includes("Quản lý nội dung") ||
        body.includes("SEO") ||
        body.includes("Users") ||
        body.includes("Người dùng") ||
        body.includes("Feedback") ||
        body.includes("Phản hồi")
      );
    },
    { timeout: 15000 },
  );
}

/**
 * Helper to wait for the Users tab content (search input) to appear.
 * Supports both English and Vietnamese locales.
 */
async function waitForUsersTabContent(page: import("@playwright/test").Page) {
  await waitForAdminPage(page);
  // Wait for the users tab to load: check for search input or empty/loaded state
  // Uses querySelector because input placeholder is not in innerText
  await page.waitForFunction(
    () => {
      const body = document.body.innerText;
      const hasSearchInput = !!document.querySelector('input[type="text"]');
      return (
        hasSearchInput ||
        body.includes("No users found") ||
        body.includes("Không tìm thấy người dùng")
      );
    },
    { timeout: 15000 },
  );
}

/**
 * Helper to wait for the Feedback tab content (status filter) to appear.
 * Supports both English and Vietnamese locales.
 */
async function waitForFeedbackTabContent(page: import("@playwright/test").Page) {
  await waitForAdminPage(page);
  // Wait for the loading spinner to disappear and content to appear
  await page.waitForFunction(
    () => {
      const body = document.body.innerText;
      return (
        body.includes("Status:") ||
        body.includes("Trạng thái:") ||
        body.includes("No feedback found") ||
        body.includes("Không tìm thấy phản hồi")
      );
    },
    { timeout: 15000 },
  );
}

test.describe("Admin Page Structure", () => {
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

    // Mock admin users
    await page.route("**/api/v1/admin/users**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_USERS_RESPONSE),
      });
    });

    // Mock admin feedback
    await page.route("**/api/v1/admin/feedback**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_FEEDBACK_RESPONSE),
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

    // Set auth token
    await page.goto("/auth/login");
    await page.evaluate(() => {
      localStorage.setItem("token", "mock-test-token");
    });
  });

  test("should display admin page with tabs", async ({ page }) => {
    await page.goto("/dashboard/admin");
    await waitForAdminPage(page);

    // Page title should be visible (supports both English and Vietnamese)
    const heading = page.locator("h1, h2").filter({ hasText: /Content Management|Quản lý nội dung/i });
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test("should navigate to Users tab", async ({ page }) => {
    await page.goto("/dashboard/admin?tab=users");
    await waitForUsersTabContent(page);

    // Users tab content should appear (matches both English and Vietnamese placeholders)
    const searchInput = page.locator('input[type="text"]').first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });
  });

  test("should navigate to Feedback tab", async ({ page }) => {
    await page.goto("/dashboard/admin?tab=feedback");
    await waitForFeedbackTabContent(page);

    // Feedback tab should show status filter (supports both English and Vietnamese)
    const statusLabel = page.locator("text=/Status:|Trạng thái:/");
    await expect(statusLabel).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Admin Users Tab", () => {
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

    await page.route("**/api/v1/admin/users**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_USERS_RESPONSE),
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

  test("should render search input", async ({ page }) => {
    await page.goto("/dashboard/admin?tab=users");
    await waitForUsersTabContent(page);

    // Match both English and Vietnamese placeholders
    const searchInput = page.locator('input[type="text"]').first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });
  });

  test("should render user data in table", async ({ page }) => {
    await page.goto("/dashboard/admin?tab=users");
    await waitForUsersTabContent(page);

    // Scope to main content to avoid strict mode violation with sidebar/heading
    const main = page.getByRole("main");
    await expect(main.getByText("Admin User", { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(main.getByText("Regular User", { exact: true })).toBeVisible({ timeout: 10000 });
  });

  test("should display role badges", async ({ page }) => {
    await page.goto("/dashboard/admin?tab=users");
    await waitForUsersTabContent(page);

    // Wait for user data to load (scoped to main to avoid strict mode violation)
    const main = page.getByRole("main");
    await expect(main.getByText("Admin User", { exact: true })).toBeVisible({ timeout: 10000 });

    // Should have Admin and User badges (supports both English and Vietnamese)
    const adminBadges = page.locator("button").filter({ hasText: /^Admin$|^Quản trị viên$/ });
    const userBadges = page.locator("button").filter({ hasText: /^User$|^Người dùng$/ });
    await expect(adminBadges.first()).toBeVisible();
    await expect(userBadges.first()).toBeVisible();
  });
});

test.describe("Admin Feedback Tab", () => {
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

    await page.route("**/api/v1/admin/feedback**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_FEEDBACK_RESPONSE),
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

  test("should render status filter", async ({ page }) => {
    await page.goto("/dashboard/admin?tab=feedback");
    await waitForFeedbackTabContent(page);

    // Supports both English and Vietnamese
    const statusLabel = page.locator("text=/Status:|Trạng thái:/");
    await expect(statusLabel).toBeVisible({ timeout: 10000 });
  });

  test("should render feedback data in table", async ({ page }) => {
    await page.goto("/dashboard/admin?tab=feedback");
    await waitForFeedbackTabContent(page);

    await expect(page.getByText("Bug Report")).toBeVisible({ timeout: 10000 });
    const main = page.getByRole("main");
    await expect(main.getByText("Regular User", { exact: true })).toBeVisible({ timeout: 10000 });
  });
});

const MOCK_BROADCAST_RESPONSE = {
  success: true,
  message: "Broadcast sent successfully",
  recipientCount: 5,
  timestamp: new Date().toISOString(),
};

/**
 * Helper to wait for the Broadcast tab content (textarea) to appear.
 * Supports both English and Vietnamese locales.
 */
async function waitForBroadcastTabContent(page: import("@playwright/test").Page) {
  await waitForAdminPage(page);
  // Wait for the broadcast form title or the textarea itself to appear
  await page.waitForFunction(
    () => {
      const body = document.body.innerText;
      const hasTextarea = !!document.querySelector("textarea#broadcast-message");
      return (
        hasTextarea ||
        body.includes("Send broadcast to all users") ||
        body.includes("Gửi thông báo đến tất cả người dùng")
      );
    },
    { timeout: 15000 },
  );
}

test.describe("Admin Broadcast Tab", () => {
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

    // Mock broadcast endpoint
    await page.route("**/api/v1/admin/broadcast**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_BROADCAST_RESPONSE),
      });
    });

    // Set auth token
    await page.goto("/auth/login");
    await page.evaluate(() => {
      localStorage.setItem("token", "mock-test-token");
    });
  });

  test("should navigate to Broadcast tab and show textarea", async ({ page }) => {
    await page.goto("/dashboard/admin?tab=broadcast");
    await waitForBroadcastTabContent(page);

    // The textarea should be visible with the correct id
    const textarea = page.locator("textarea#broadcast-message");
    await expect(textarea).toBeVisible({ timeout: 10000 });
  });

  test("should show character counter", async ({ page }) => {
    await page.goto("/dashboard/admin?tab=broadcast");
    await waitForBroadcastTabContent(page);

    const textarea = page.locator("textarea#broadcast-message");
    await expect(textarea).toBeVisible({ timeout: 10000 });

    // Type some text and verify the character counter updates
    const testMessage = "Hello world";
    await textarea.fill(testMessage);

    // Counter should reflect the typed character count (supports both locales)
    // English: "11/500 characters", Vietnamese: "11/500 ký tự"
    const counter = page.locator(
      `text=/${testMessage.length}\\/500/`,
    );
    await expect(counter).toBeVisible({ timeout: 10000 });
  });

  test("should show submit button", async ({ page }) => {
    await page.goto("/dashboard/admin?tab=broadcast");
    await waitForBroadcastTabContent(page);

    // Submit button supports both English and Vietnamese
    const submitButton = page.locator("button").filter({
      hasText: /Send broadcast|Gửi thông báo/,
    });
    await expect(submitButton).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Admin Page Mobile", () => {
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

    await page.route("**/api/v1/admin/users**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_USERS_RESPONSE),
      });
    });

    await page.route("**/api/v1/admin/feedback**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_FEEDBACK_RESPONSE),
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

  test("should render admin page on mobile viewport", async ({ page }) => {
    await page.goto("/dashboard/admin");
    await waitForAdminPage(page);

    // Supports both English and Vietnamese
    const heading = page.locator("h1, h2").filter({ hasText: /Content Management|Quản lý nội dung/i });
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test("should navigate to users tab on mobile", async ({ page }) => {
    await page.goto("/dashboard/admin?tab=users");
    await waitForUsersTabContent(page);

    // Match both English and Vietnamese placeholders
    const searchInput = page.locator('input[type="text"]').first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });
  });
});

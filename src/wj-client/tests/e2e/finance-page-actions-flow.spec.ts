import { test, expect } from "@playwright/test";

/**
 * E2E Test: Finance Page Action Buttons Flow
 *
 * Tests the three action buttons on the finance page:
 * - Add Transaction button opens AddTransactionForm modal
 * - Transfer Money button opens TransferMoneyForm modal
 * - Create Wallet button opens CreateWalletForm modal
 * - Modal closes on ESC / backdrop click
 * - Mobile viewport (375px) coverage
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

const WALLET_MOCK = {
  success: true,
  wallets: [
    {
      id: 1,
      walletName: "My Wallet",
      balance: { amount: "1000000", currency: "VND" },
      type: 0,
      currency: "VND",
    },
  ],
  total: 1,
};

const TRANSACTIONS_MOCK = {
  success: true,
  transactions: [],
  total: 0,
  totalBalance: { amount: "1000000", currency: "VND" },
};

const CATEGORIES_MOCK = {
  success: true,
  categories: [
    { id: 1, name: "Food", type: "expense" },
    { id: 2, name: "Income", type: "income" },
  ],
};

test.describe("Finance Page Action Buttons", () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth verify
    await page.route("**/api/v1/auth/verify**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(AUTH_MOCK),
      });
    });

    // Mock wallets
    await page.route("**/api/v1/wallets**", (route) => {
      if (!route.request().url().includes("total-balance")) {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(WALLET_MOCK),
        });
      }
    });

    // Mock total balance
    await page.route("**/api/v1/wallets/total-balance**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          totalBalance: { amount: "1000000", currency: "VND" },
        }),
      });
    });

    // Mock transactions
    await page.route("**/api/v1/transactions**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(TRANSACTIONS_MOCK),
      });
    });

    // Mock categories
    await page.route("**/api/v1/categories**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(CATEGORIES_MOCK),
      });
    });

    // Mock budgets
    await page.route("**/api/v1/budgets**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, budgets: [], total: 0 }),
      });
    });

    // Set auth token
    await page.goto("/auth/login");
    await page.evaluate(() => {
      localStorage.setItem("token", "mock-test-token");
    });
  });

  test("renders three action buttons on the finance page", async ({ page }) => {
    await page.goto("/en/dashboard/finance");
    await page.waitForLoadState("networkidle");

    const addTxnBtn = page.locator("button").filter({ hasText: /add transaction/i });
    const transferBtn = page.locator("button").filter({ hasText: /transfer money/i });
    const createWalletBtn = page.locator("button").filter({ hasText: /create wallet/i });

    await expect(addTxnBtn.first()).toBeVisible();
    await expect(transferBtn.first()).toBeVisible();
    await expect(createWalletBtn.first()).toBeVisible();
  });

  test("opens Add Transaction modal when button is clicked", async ({ page }) => {
    await page.goto("/en/dashboard/finance");
    await page.waitForLoadState("networkidle");

    const addTxnBtn = page.locator("button").filter({ hasText: /add transaction/i });
    await addTxnBtn.first().click();

    // Modal should appear
    const modal = page.locator('[role="dialog"]');
    await expect(modal.first()).toBeVisible();
  });

  test("opens Transfer Money modal when button is clicked", async ({ page }) => {
    await page.goto("/en/dashboard/finance");
    await page.waitForLoadState("networkidle");

    const transferBtn = page.locator("button").filter({ hasText: /transfer money/i });
    await transferBtn.first().click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal.first()).toBeVisible();
  });

  test("opens Create Wallet modal when button is clicked", async ({ page }) => {
    await page.goto("/en/dashboard/finance");
    await page.waitForLoadState("networkidle");

    const createWalletBtn = page.locator("button").filter({ hasText: /create wallet/i });
    await createWalletBtn.first().click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal.first()).toBeVisible();
  });

  test("modal closes on ESC key press", async ({ page }) => {
    await page.goto("/en/dashboard/finance");
    await page.waitForLoadState("networkidle");

    const addTxnBtn = page.locator("button").filter({ hasText: /add transaction/i });
    await addTxnBtn.first().click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal.first()).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(modal.first()).not.toBeVisible();
  });

  test("modal closes on backdrop click", async ({ page }) => {
    await page.goto("/en/dashboard/finance");
    await page.waitForLoadState("networkidle");

    const addTxnBtn = page.locator("button").filter({ hasText: /add transaction/i });
    await addTxnBtn.first().click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal.first()).toBeVisible();

    // Click the backdrop (outside the modal)
    await page.mouse.click(10, 10);

    await expect(modal.first()).not.toBeVisible();
  });

  test("tab bar is still visible with action buttons present", async ({ page }) => {
    await page.goto("/en/dashboard/finance");
    await page.waitForLoadState("networkidle");

    // Tab bar buttons
    const transactionTab = page.locator('[role="tab"]').filter({ hasText: /transactions/i });
    await expect(transactionTab.first()).toBeVisible();
  });

  test("action buttons are visible on mobile (375px viewport)", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/en/dashboard/finance");
    await page.waitForLoadState("networkidle");

    const addTxnBtn = page.locator("button").filter({ hasText: /add transaction/i });
    await expect(addTxnBtn.first()).toBeVisible();

    // Touch target check: button height should be at least 44px
    const boundingBox = await addTxnBtn.first().boundingBox();
    if (boundingBox) {
      expect(boundingBox.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("all three buttons are accessible on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/en/dashboard/finance");
    await page.waitForLoadState("networkidle");

    const addTxnBtn = page.locator("button").filter({ hasText: /add transaction/i });
    const transferBtn = page.locator("button").filter({ hasText: /transfer money/i });
    const createWalletBtn = page.locator("button").filter({ hasText: /create wallet/i });

    // All buttons should be present in the DOM (may need scroll to see all)
    await expect(addTxnBtn.first()).toBeAttached();
    await expect(transferBtn.first()).toBeAttached();
    await expect(createWalletBtn.first()).toBeAttached();
  });
});

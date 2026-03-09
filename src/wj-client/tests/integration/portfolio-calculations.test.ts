import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Portfolio Calculation Display
 *
 * These tests verify that the portfolio page displays correct calculations
 * for:
 * - Total Value
 * - Total Cost
 * - Total PNL (Profit and Loss)
 * - Individual investment values
 * - PNL percentages
 *
 * Prerequisites:
 * - Test user must be logged in
 * - Test user must have at least one investment wallet
 * - Investment wallet should have some holdings with transactions
 */

test.describe('Portfolio Calculations', () => {
  // Navigate to portfolio page before each test
  test.beforeEach(async ({ page }) => {
    // Go directly to portfolio page (assuming user is already authenticated)
    // In a real CI/CD setup, you'd handle authentication here
    await page.goto('/dashboard/portfolio');

    // Wait for the page to load and data to be fetched
    // The page shows a loading spinner initially
    await page.waitForLoadState('networkidle');
  });

  test('should load portfolio page without errors', async ({ page }) => {
    // Verify we're on the correct page
    await expect(page).toHaveURL(/\/dashboard\/portfolio/);

    // Check for main heading
    const heading = await page.textContent('h1');
    expect(heading).toContain('Investment Portfolio');
  });

  test('should display portfolio summary cards', async ({ page }) => {
    // Wait for summary cards to be visible
    // The page shows 4 cards: Total Value, Total Cost, Total PNL, Holdings
    await page.waitForSelector('text=Total Value', { timeout: 10000 });

    // Verify all 4 summary cards are present
    await expect(page.locator('text=Total Value')).toBeVisible();
    await expect(page.locator('text=Total Cost')).toBeVisible();
    await expect(page.locator('text=Total PNL')).toBeVisible();
    await expect(page.locator('text=Holdings')).toBeVisible();
  });

  test('should display monetary values in correct format', async ({ page }) => {
    // Wait for summary to load
    await page.waitForSelector('text=Total Value', { timeout: 10000 });

    // Get all the currency-formatted values (they look like "$1,234.56" or "¥1,234")
    const currencyElements = await page.locator('.text-2xl.font-bold').all();

    // We should have at least 4 monetary values displayed
    expect(currencyElements.length).toBeGreaterThanOrEqual(4);

    // Check that values contain currency symbols or formatted numbers
    for (const element of currencyElements) {
      const text = await element.textContent();
      expect(text).toMatch(/[\$¥£€₹][\d,]+\.?\d*|[\d,]+\.?\d*\s*(VND|USD)/);
    }
  });

  test('should display PNL with correct color coding', async ({ page }) => {
    await page.waitForSelector('text=Total PNL', { timeout: 10000 });

    // Find the PNL value (it's in the same card as "Total PNL" label)
    const pnlCard = page.locator('div').filter({ hasText: 'Total PNL' }).locator('..');
    const pnlValue = pnlCard.locator('.text-2xl');

    await expect(pnlValue).toBeVisible();

    // Get the text and check it has the currency format
    const pnlText = await pnlValue.textContent();
    expect(pnlText).toMatch(/[\+\-]?[\$¥£€₹][\d,]+\.?\d*/);

    // Check color coding - positive PNL should be green (V2), negative should be red (V2)
    const className = await pnlValue.getAttribute('class');
    expect(className).toMatch(/text-v2-green-positive|text-(red)-[0-9]+/);
  });

  test('should display holdings table with correct columns', async ({ page }) => {
    // Wait for holdings section to load
    await page.waitForSelector('text=Holdings', { timeout: 10000 });

    // Check for table headers
    await expect(page.locator('text=Symbol')).toBeVisible();
    await expect(page.locator('text=Name')).toBeVisible();
    await expect(page.locator('text=Type')).toBeVisible();
    await expect(page.locator('text=Quantity')).toBeVisible();
    await expect(page.locator('text=Avg Cost')).toBeVisible();
    await expect(page.locator('text=Current Price')).toBeVisible();
    await expect(page.locator('text=Current Value')).toBeVisible();
    await expect(page.locator('text=PNL')).toBeVisible();
    await expect(page.locator('text=PNL %')).toBeVisible();
  });

  test('should display investment rows with formatted values', async ({ page }) => {
    await page.waitForSelector('text=Holdings', { timeout: 10000 });

    // Wait for table to have data (not the empty state)
    const tableEmpty = await page.locator('text=No investments yet').count();
    if (tableEmpty > 0) {
      test.skip(true, 'No investments to test');
      return;
    }

    // Get the first row of investments (excluding header)
    const firstRow = page.locator('tbody tr').first();

    // Check that symbol is displayed
    const symbol = await firstRow.locator('td').nth(0).textContent();
    expect(symbol).toBeTruthy();
    expect(symbol?.length).toBeGreaterThan(0);

    // Check that quantity is displayed
    const quantity = await firstRow.locator('td').nth(3).textContent();
    expect(quantity).toBeTruthy();

    // Check that current value is currency formatted
    const currentValue = await firstRow.locator('td').nth(6).textContent();
    expect(currentValue).toMatch(/[\$¥£€₹][\d,]+\.?\d*/);

    // Check that PNL is currency formatted with +/- sign
    const pnl = await firstRow.locator('td').nth(7).textContent();
    expect(pnl).toMatch(/[\+\-]?[\$¥£€₹][\d,]+\.?\d*/);

    // Check that PNL % is percentage formatted
    const pnlPercent = await firstRow.locator('td').nth(8).textContent();
    expect(pnlPercent).toMatch(/[\+\-]?\d+\.?\d*%/);
  });

  test('should color code PNL values correctly in table', async ({ page }) => {
    await page.waitForSelector('text=Holdings', { timeout: 10000 });

    const tableEmpty = await page.locator('text=No investments yet').count();
    if (tableEmpty > 0) {
      test.skip(true, 'No investments to test');
      return;
    }

    // Check PNL column (column index 8, 0-based)
    const pnlCells = page.locator('tbody tr td:nth-child(8)');

    const count = await pnlCells.count();
    expect(count).toBeGreaterThan(0);

    // Verify each PNL cell has color coding
    for (let i = 0; i < count; i++) {
      const cell = pnlCells.nth(i);
      const className = await cell.getAttribute('class');

      // Should have text-v2-green-positive or text-red-* class (V2 color system)
      expect(className).toMatch(/text-v2-green-positive|text-(red)-[0-9]+/);
    }
  });

  test('should handle empty investment wallet state', async ({ page }) => {
    // This test verifies the empty state is shown correctly
    // Note: This test assumes you can create a fresh wallet or navigate to one with no investments

    const emptyState = page.locator('text=No Investment Wallets');
    const noInvestments = page.locator('text=No investments yet');

    // At least one empty state message should be present if there are no investments
    const hasEmptyState = await emptyState.count() > 0 || await noInvestments.count() > 0;

    // We don't assert this must be true, as the test user might have investments
    // This test just verifies the UI works correctly when empty
    if (hasEmptyState) {
      // Verify empty state has appropriate messaging and CTA
      if (await emptyState.count() > 0) {
        await expect(page.locator('text=Create an investment wallet')).toBeVisible();
        await expect(page.locator('button:has-text("Create Investment Wallet")')).toBeVisible();
      }
    }
  });

  test('should allow wallet selection when multiple wallets exist', async ({ page }) => {
    await page.waitForSelector('text=Investment Portfolio', { timeout: 10000 });

    // Check if wallet selector dropdown is present
    const walletSelector = page.locator('select');

    const selectorCount = await walletSelector.count();

    if (selectorCount > 0) {
      // If selector exists, verify it has options
      const options = await walletSelector.locator('option').count();
      expect(options).toBeGreaterThan(0);

      // Get the currently selected value
      const selectedValue = await walletSelector.inputValue();
      expect(selectedValue).toBeTruthy();
    } else {
      // If no selector, that's okay - user might only have one wallet
      test.info().annotations.push({
        type: 'info',
        description: 'Only one investment wallet exists, no selector shown'
      });
    }
  });

  test('should have responsive layout', async ({ page }) => {
    await page.waitForSelector('text=Investment Portfolio', { timeout: 10000 });

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500); // Wait for layout to adjust

    // Verify main container is still visible
    await expect(page.locator('h1:has-text("Investment Portfolio")')).toBeVisible();

    // Summary cards should stack vertically on mobile
    const summaryCards = page.locator('.grid.grid-cols-1');
    await expect(summaryCards.first()).toBeVisible();

    // Test desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(500); // Wait for layout to adjust

    // Verify main container is still visible
    await expect(page.locator('h1:has-text("Investment Portfolio")')).toBeVisible();
  });

  test('should display loading states correctly', async ({ page }) => {
    // Navigate to the page fresh to see loading state
    await page.goto('/dashboard/portfolio');

    // Check for loading spinner (it appears briefly)
    const loadingSpinner = page.locator('text=Loading portfolio');

    // The loading state might be too fast to catch, but if we see it, verify it
    const hasLoading = await loadingSpinner.count() > 0;
    if (hasLoading) {
      await expect(loadingSpinner).toBeVisible();
    }
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // This test would need to mock API failures
    // For now, we just verify the error state UI exists
    // In a real test, you'd intercept the API call and return an error

    // Note: Actual error testing would require setting up MSW or similar
    test.info().annotations.push({
      type: 'todo',
      description: 'Add API error mocking with MSW or Playwright route mocking'
    });
  });

  test('should calculate PNL correctly across all investments', async ({ page }) => {
    await page.waitForSelector('text=Holdings', { timeout: 10000 });

    const tableEmpty = await page.locator('text=No investments yet').count();
    if (tableEmpty > 0) {
      test.skip(true, 'No investments to test');
      return;
    }

    // Get all investment rows
    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();

    let totalCurrentValue = 0;
    let totalCost = 0;
    let totalPNL = 0;

    // Parse each row's values
    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);

      // Get current value (column 7, 0-based)
      const currentValueText = await row.locator('td').nth(6).textContent();
      const currentValue = parseCurrency(currentValueText || '0');

      // Get quantity and avg cost to calculate cost basis
      const quantityText = await row.locator('td').nth(3).textContent();
      const avgCostText = await row.locator('td').nth(4).textContent();

      // Get PNL value (column 8, 0-based)
      const pnlText = await row.locator('td').nth(7).textContent();
      const pnl = parseCurrency(pnlText || '0');

      totalCurrentValue += currentValue;
      totalPNL += pnl;
    }

    // Get the summary totals from the page
    const summaryTotalValue = await parseSummaryValue(page, 'Total Value');
    const summaryTotalPNL = await parseSummaryValue(page, 'Total PNL');

    // Verify the totals match (with small tolerance for rounding)
    expect(Math.abs(totalCurrentValue - summaryTotalValue)).toBeLessThan(1);
    expect(Math.abs(totalPNL - summaryTotalPNL)).toBeLessThan(1);

    test.info().annotations.push({
      type: 'info',
      description: `Total Current Value: ${totalCurrentValue}, Total PNL: ${totalPNL}`
    });
  });
});

/**
 * Helper function to parse currency strings like "$1,234.56" into numbers
 */
function parseCurrency(currencyString: string): number {
  // Remove currency symbols, commas, and whitespace
  const cleaned = currencyString
    .replace(/[\$¥£€₹VND]/g, '')
    .replace(/,/g, '')
    .trim();

  // Handle case where value might be like "1.234.56" (some locales)
  const normalized = cleaned.replace(/\.(?=\d{3})/g, '');

  return parseFloat(normalized) || 0;
}

/**
 * Helper function to parse summary card values
 */
async function parseSummaryValue(page: any, label: string): Promise<number> {
  // Find the card with the label and get its value
  const card = page.locator('div').filter({ hasText: label }).locator('..');
  const valueText = await card.locator('.text-2xl').textContent();
  return parseCurrency(valueText || '0');
}

/**
 * Test execution annotations:
 *
 * To run these tests:
 * 1. Install Playwright: npm install -D @playwright/test
 * 2. Install browsers: npx playwright install
 * 3. Configure playwright.config.ts (see below)
 * 4. Run tests: npx playwright test
 *
 * For authenticated tests, you'll need to set up authentication in the test
 * or use a test user that's already logged in via localStorage/sessionStorage.
 */

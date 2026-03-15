# E2E Testing with Playwright

This directory contains end-to-end tests for the congdongvang.com application using Playwright.

## Setup

### 1. Install Dependencies

```bash
cd src/wj-client
npm install -D @playwright/test
```

### 2. Install Playwright Browsers

```bash
npx playwright install
```

### 3. Configure Environment Variables (Optional)

Create a `.env.test` file for test environment variables:

```env
# Base URL for testing (defaults to http://localhost:3000)
BASE_URL=http://localhost:3000

# Test user credentials (if needed)
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=testpassword123
```

## Running Tests

### Run All Tests

```bash
npx playwright test
```

### Run Tests in Specific File

```bash
npx playwright test tests/integration/portfolio-calculations.test.ts
```

### Run Tests in Specific Browser

```bash
npx playwright test --project=chromium
```

### Run Tests in UI Mode (Interactive)

```bash
npx playwright test --ui
```

### Run Tests with Debugging

```bash
npx playwright test --debug
```

### View Test Reports

After running tests, view the HTML report:

```bash
npx playwright show-report
```

## Test Structure

```
tests/
├── integration/
│   └── portfolio-calculations.test.ts  # Portfolio calculation tests
├── e2e/                                 # Full user flow tests (to be added)
└── README.md                            # This file
```

## Current Test Coverage

### Portfolio Calculations (`portfolio-calculations.test.ts`)

Tests verify:
- Portfolio page loads correctly
- Summary cards display (Total Value, Total Cost, Total PNL, Holdings)
- Monetary values are formatted correctly
- PNL values have proper color coding (green for positive, red for negative)
- Holdings table displays all columns
- Investment rows show formatted values
- PNL percentages are displayed
- Responsive layout works on mobile and desktop
- Loading states display correctly
- Calculations are consistent across the page

## Authentication Setup

The tests currently assume the user is already authenticated. To add authentication:

### Option 1: Use localStorage/sessionStorage

```typescript
test.beforeEach(async ({ page }) => {
  // Set authentication token in localStorage
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('token', 'test-token');
  });
});
```

### Option 2: Login via UI

```typescript
test.beforeEach(async ({ page }) => {
  await page.goto('/auth/login');
  await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!);
  await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!);
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard/home');
});
```

### Option 3: Use API for Authentication

```typescript
test.beforeEach(async ({ page }) => {
  // Login via API and get token
  const response = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: process.env.TEST_USER_EMAIL,
      password: process.env.TEST_USER_PASSWORD,
    }),
  });

  const { token } = await response.json();

  // Set token and navigate
  await page.goto('/');
  await page.evaluate((t) => {
    localStorage.setItem('token', t);
  }, token);
});
```

## Writing New Tests

### Test Template

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup before each test
    await page.goto('/some-page');
  });

  test('should do something', async ({ page }) => {
    // Test code here
    await expect(page.locator('some-selector')).toBeVisible();
  });
});
```

### Best Practices

1. **Use data-testid attributes** for reliable selectors:
   ```tsx
   <button data-testid="submit-button">Submit</button>
   ```
   ```typescript
   await page.click('[data-testid="submit-button"]');
   ```

2. **Wait for elements properly**:
   ```typescript
   // Good
   await page.waitForSelector('[data-testid="portfolio-summary"]');
   await expect(page.locator('text=Total Value')).toBeVisible();

   // Avoid
   await page.waitForTimeout(5000); // Too rigid
   ```

3. **Use assertions from Playwright**:
   ```typescript
   await expect(page).toHaveURL(/\/dashboard\/portfolio/);
   await expect(element).toBeVisible();
   await expect(element).toHaveText('Expected text');
   ```

4. **Keep tests isolated** - Each test should work independently

5. **Use page objects** for complex flows (to be implemented)

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npx playwright test
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

## Troubleshooting

### Tests Fail with "Token Not Found"

Make sure authentication is properly set up in the test's `beforeEach` hook.

### Tests Timeout Waiting for Elements

1. Check if the backend is running
2. Verify the selectors match the actual DOM
3. Increase timeout if needed: `await page.waitForSelector('selector', { timeout: 30000 })`

### Flaky Tests

1. Use `test.step()` to organize test logic
2. Wait for network idle: `await page.waitForLoadState('networkidle')`
3. Use more specific selectors
4. Check for race conditions

### Browser Not Installed

```bash
npx playwright install
```

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Authentication Guide](https://playwright.dev/docs/auth)

# Playwright Audit Dry-Run Validation

**Task traced:** Task 7 — Net Worth & PNL Display (from V2 Design Migration plan)
**Plan file:** `docs/plans/2026-03-08-v2-design-migration-plan.md`

## Step 1 — Pages affected

- `/dashboard/home` — adds Net Worth card and PNL summary section (new components displayed on the home dashboard)

## Step 2 — Matching spec files

Using the page → spec mapping from `implementer-prompt.md`:

| Route | Mapped Spec |
|---|---|
| `/dashboard/home` | **No existing spec** — `/dashboard/home` is not covered by any current E2E spec file |

**Action:** Create `src/wj-client/tests/e2e/home-dashboard-flow.spec.ts`

The existing spec files cover:
- `login-flow.spec.ts` → `/auth/login`, `/auth/register`
- `create-wallet-flow.spec.ts` → `/dashboard/wallets`
- `add-transaction-flow.spec.ts`, `filter-transactions.spec.ts` → `/dashboard/transaction`
- `view-portfolio-flow.spec.ts`, `portfolio-calculations.test.ts` → `/dashboard/portfolio`

None of these cover `/dashboard/home`.

## Step 3 — Existing tests to update

None — no existing spec file covers `/dashboard/home`. The new spec file starts from scratch.

## Step 4 — New tests to add

A new `tests/e2e/home-dashboard-flow.spec.ts` with the following test blocks:

1. **"displays Net Worth card"**
   - Mock `**/api/v1/wallets**` returning 2 wallets with balances
   - Mock `**/api/v1/auth/verify**` (always required)
   - Navigate to `/dashboard/home`
   - Assert the Net Worth card is visible with a formatted monetary value

2. **"displays PNL summary section"**
   - Mock `**/api/v1/wallets/{walletId}/portfolio-summary**` with realized/unrealized PNL data
   - Assert PNL section renders with positive/negative indicators

3. **"Net Worth card shows zero state when no wallets"**
   - Mock wallets endpoint returning empty array
   - Assert card shows "₫0" or equivalent zero value

Each test follows the established pattern:
```typescript
test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/auth/verify**", (route) => { /* mock auth */ });
  await page.route("**/api/v1/wallets**", (route) => { /* mock wallets */ });
  await page.goto("/auth/login");
  await page.evaluate(() => { localStorage.setItem("token", "mock-test-token"); });
});
```

## Step 5 — Mobile coverage needed?

**Yes.** The V2 design plan explicitly redesigns the mobile header and bottom nav (Tasks 5, 6), and the Net Worth / PNL sections have a responsive layout. A `Mobile Home Dashboard View` describe block with `test.use({ viewport: { width: 375, height: 667 } })` should verify:
- Net Worth card is not clipped on mobile
- PNL section stacks vertically (no horizontal scroll)
- Touch targets for any interactive elements are ≥ 44px

## Conclusion

The new audit protocol is clear and actionable for this task. The mapping table correctly identifies that `/dashboard/home` has no existing spec, and the protocol correctly prescribes creating `tests/e2e/home-dashboard-flow.spec.ts`. The mock pattern, selector guidance, and mobile block conventions are specific enough to write the tests without ambiguity. No issues found with the protocol itself.

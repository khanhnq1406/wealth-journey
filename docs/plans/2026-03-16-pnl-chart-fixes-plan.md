# PNL Chart & Portfolio History Fixes — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Fix 4 issues in the PNL chart: aggregated history not summing wallets, no backfill for past purchase dates, silent fallback to all-time PNL, and CASH investments showing -100% PNL.

**Spec:** `docs/specs/2026-03-16-pnl-chart-fixes-spec.md`

**Architecture:** All fixes are in existing backend services and one frontend component. Proto change adds one boolean field. No new endpoints, models, or components.

**Tech Stack:** Go 1.23, PostgreSQL, Protocol Buffers, React/TypeScript

## Security Implementation Notes

- No new endpoints — all changes are within existing authenticated paths
- No authorization changes — user ownership checks remain
- Input validation for `purchaseDate` already exists (cannot be future)
- Backfill snapshot uses existing `CreateSnapshotIfNotDuplicate` with 1-hour dedup

---

### Task 1: Fix SQL Aggregation in `GetAggregatedHistory`

**Files:**
- Modify: `src/go-backend/domain/repository/portfolio_history_repository_impl.go` (lines 54-71)

**Security notes:** Query is parameterized (userID), no injection risk.

**Changes:**

Replace the current `GetAggregatedHistory` implementation with a SQL query that groups by `date_trunc('hour', timestamp)` and sums `total_value`, `total_cost`, `total_pnl` across wallets:

```sql
SELECT 0 AS id, user_id, 0 AS wallet_id,
       SUM(total_value) AS total_value,
       SUM(total_cost) AS total_cost,
       SUM(total_pnl) AS total_pnl,
       MIN(currency) AS currency,
       date_trunc('hour', timestamp) AS timestamp,
       MIN(created_at) AS created_at,
       MIN(updated_at) AS updated_at,
       NULL AS deleted_at
FROM portfolio_history
WHERE user_id = ? AND timestamp >= ? AND timestamp <= ? AND deleted_at IS NULL
GROUP BY user_id, date_trunc('hour', timestamp)
ORDER BY timestamp ASC
```

Apply `LIMIT` if `limit > 0`.

**Commit:** `fix(portfolio): aggregate historical values by timestamp across wallets`

---

### Task 2: Set `CurrentPrice = AverageCost` for CASH/FOREIGN_CURRENCY

**Files:**
- Modify: `src/go-backend/domain/service/investment_service.go` (~line 209)

**Security notes:** No authorization change. Only affects the initial price seed for these two types.

**Changes:**

In `CreateInvestment()`, after the `if req.IsCustom` block that sets `currentPrice = 0`, add a special case for CASH and FOREIGN_CURRENCY:

```go
if req.IsCustom {
    currentPrice = 0
} else {
    currentPrice = averageCost
}

// CASH and FOREIGN_CURRENCY: seed with average cost even though custom
// so that CurrentValue = TotalCost and UnrealizedPNL = 0
if req.Type == investmentv1.InvestmentType_INVESTMENT_TYPE_CASH ||
    req.Type == investmentv1.InvestmentType_INVESTMENT_TYPE_FOREIGN_CURRENCY {
    currentPrice = averageCost
}
```

**Commit:** `fix(investment): seed CASH/FOREIGN_CURRENCY with average cost to avoid -100% PNL`

---

### Task 3: Add `periodPnlApproximate` to Proto and Backend

**Files:**
- Modify: `api/protobuf/v1/investment.proto` — add field 21 to `PortfolioSummary`
- Modify: `src/go-backend/domain/service/investment_service_period.go` — return approximate flag
- Modify: `src/go-backend/domain/service/investment_service.go` — wire the flag into response

**Security notes:** New boolean field is informational only, no sensitive data.

**Changes:**

**Step 1:** Add proto field:
```protobuf
bool period_pnl_approximate = 21; // true when period PNL falls back to all-time (no snapshot)
```

**Step 2:** Run `task proto:all` to regenerate Go + TS types.

**Step 3:** Change `computePeriodPnl` signature to return `(int64, float64, bool, error)` where the third return is `isApproximate`. Set to `true` when falling back (snapshot nil or error).

**Step 4:** Wire `isApproximate` into `PortfolioSummary.PeriodPnlApproximate` in `GetPortfolioSummary` and `GetAggregatedPortfolioSummary`.

**Commit:** `feat(portfolio): add periodPnlApproximate flag for missing snapshot fallback`

---

### Task 4: Backfill Snapshot on Investment Creation with Past Purchase Date

**Files:**
- Modify: `src/go-backend/domain/service/investment_service.go` — add snapshot creation after investment creation
- Modify: `src/go-backend/domain/service/interfaces.go` — may need to check if `PortfolioHistoryService` is already accessible from `InvestmentService`

**Security notes:** `purchaseDate` is already validated (not future). Snapshot uses existing dedup logic.

**Changes:**

After the investment is fully created (after lot creation, ~line 270), if `req.PurchaseDate > 0`:

1. Call `s.portfolioHistorySvc.CreateSnapshot(ctx, userID, walletID)` but with a custom timestamp override
2. Need to either:
   - Add a `CreateSnapshotAt(ctx, userID, walletID, timestamp)` method to `PortfolioHistoryService`, or
   - Create the snapshot directly in `CreateInvestment` using the existing `historyRepo`

**Preferred approach:** Add `CreateSnapshotAt` to `PortfolioHistoryService` interface and implementation. This method calls `GetPortfolioSummary` (which now reflects the newly created investment), but stamps the snapshot with the provided `purchaseDate` instead of `time.Now()`.

**Note:** This requires `InvestmentService` to have access to `PortfolioHistoryService`. Check if this creates a circular dependency (PortfolioHistoryService already depends on InvestmentService). If circular, create the snapshot directly in `CreateInvestment` using the repository.

**Resolution for circular dependency:** Since `PortfolioHistoryService` depends on `InvestmentService`, adding a reverse dependency creates a cycle. Instead, create the snapshot inline in `CreateInvestment` using the `portfolioHistoryRepo` (add it as a dependency of `investmentService`).

**Commit:** `feat(portfolio): backfill snapshot when creating investment with past purchase date`

---

### Task 5: Update Frontend PNLCard for Approximate Indicator

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/home/PNLCard.tsx`
- Modify: `src/wj-client/messages/en/investment.json` — add tooltip text
- Modify: `src/wj-client/messages/vi/investment.json` — add tooltip text

**Security notes:** Display-only change, no sensitive data.

**Changes:**

In PNLCard, read `summaryData?.data?.periodPnlApproximate`. When true, prefix the PNL amount with "≈" and add a subtle `text-[10px]` note below saying "Approximate — limited historical data".

Also in PNLCard, check if `NetWorthDisplay` on the homepage uses the same summary data — if so, apply the same indicator there.

**Commit:** `feat(ui): show approximate indicator when period PNL uses fallback data`

---

### Task 6: Update Implementation Report

**Files:**
- Modify: `docs/reports/2026-03-16-investment-form-enhancements-report.md` — append to Fix History

**Commit:** `docs: update report with PNL chart fixes`

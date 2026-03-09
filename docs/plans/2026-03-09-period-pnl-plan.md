# Period-Based PnL Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Add period-scoped PnL (1D/1W/1M/ALL) to portfolio summary API and sync it with the PNLCard and PortfolioSummaryEnhanced UI components.
**Spec:** `docs/specs/2026-03-09-period-pnl-spec.md`
**Architecture:** Extend `GetPortfolioSummary` and `GetAggregatedPortfolioSummary` with an optional `period` parameter; backend queries `portfolio_history` for the snapshot at `now - periodDays` and computes `periodPnl = currentTotalPnl - snapshotTotalPnl`. Frontend PNLCard becomes self-contained (manages its own API query), and PortfolioSummaryEnhanced gains a period pill selector.
**Tech Stack:** Go 1.23 (Gin, GORM), Protobuf, Next.js 15, React Query, TypeScript, Tailwind CSS

---

## Security Implementation Notes

- **Authentication**: JWT already enforced on both endpoints via existing middleware — no change needed.
- **Authorization**: `walletId` ownership validation already exists in service layer — no change needed.
- **Input validation**: `period` enum is an `int32` in Go. Handler must accept only values 0–4; anything outside this range defaults to `PERIOD_ALL`. Reject negative values and unknown values gracefully (no panic, no 500).
- **Data sanitization**: No user-supplied strings involved. Only numeric enum values.
- **Financial integrity**: `periodPnl` is computed from `int64` snapshot deltas — no float arithmetic. Division by zero guarded (`snapshotTotalValue > 0` before dividing).

---

## C4 Architecture Diagram Updates

Per the spec, no structural C4 changes are needed:
- `c4-component-backend.md` — No new components; same handler + service + repository. No update required.
- `c4-component-frontend.md` — PNLCard now self-manages API query; PortfolioSummaryEnhanced gains period state. Minor description update only — included in Task 0.

---

### Task 0: Update C4 and Flow Architecture Diagrams

**Files:**
- Modify: `docs/architecture/c4-component-frontend.md` (update PNLCard and PortfolioSummaryEnhanced descriptions)
- Modify: `docs/architecture/flow-investment.md` (add "Period PnL Calculation" sequence diagram)

**Security notes:** Documentation only — no security implications.

**Steps:**

**Step 1: Update c4-component-frontend.md**
Find the PNLCard and PortfolioSummaryEnhanced component entries and update their descriptions to reflect:
- PNLCard now self-manages `useQueryGetAggregatedPortfolioSummary` with period state
- PortfolioSummaryEnhanced now accepts a `period` prop and passes it to the portfolio summary query

**Step 2: Add Period PnL sequence diagram to flow-investment.md**
Add a new section titled "Period PnL Calculation" with a `sequenceDiagram` Mermaid block:

```
sequenceDiagram
    participant FE as Frontend (PNLCard)
    participant H as InvestmentHandler
    participant S as InvestmentService
    participant PHR as PortfolioHistoryRepo
    participant DB as PostgreSQL

    FE->>H: GET /api/v1/portfolio-summary/aggregated?period=2 (1W)
    H->>S: GetAggregatedPortfolioSummary(ctx, userID, req{period=1W})
    S->>S: computeCurrentTotalPnl() (existing logic)
    S->>PHR: GetAggregatedHistory(ctx, userID, from=now-7d, to=now, limit=1, order=ASC)
    PHR->>DB: SELECT * FROM portfolio_history WHERE user_id=? AND timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC LIMIT 1
    DB-->>PHR: oldest snapshot in period (or empty)
    PHR-->>S: []*PortfolioHistory (0 or 1 rows)
    alt snapshot found
        S->>S: periodPnl = currentTotalPnl - snapshot.TotalPnl
        S->>S: periodPnlPercent = periodPnl / snapshot.TotalValue * 100 (if TotalValue > 0)
    else no snapshot (new user or period > history)
        S->>S: periodPnl = totalPnl (fallback to all-time)
        S->>S: periodPnlPercent = totalPnlPercent
    end
    S-->>H: GetPortfolioSummaryResponse{..., periodPnl, periodPnlPercent, period}
    H-->>FE: 200 OK {data: {totalPnl, periodPnl, periodPnlPercent, period, ...}}
```

Key Invariants:
- `periodPnl` is always in `int64` (no float intermediaries for the snapshot delta)
- Fallback to all-time when no snapshot exists for the period

Error Paths:

| Condition | Response | Rollback |
|-----------|----------|----------|
| `period` out of range (< 0 or > 4) | Default to `PERIOD_ALL`, no error | N/A |
| `portfolio_history` query fails | Return error (existing error propagation) | N/A |
| `snapshotTotalValue = 0` | `periodPnlPercent = 0` (no division) | N/A |

**Step 3: Commit**
`docs: update C4 frontend descriptions and add period PnL flow diagram`

---

### Task 1: Add PnlPeriod Enum and New Fields to investment.proto

**Files:**
- Modify: `api/protobuf/v1/investment.proto`

**Security notes:** Enum validation — values 0–4 only. Field numbers 18–20 on `PortfolioSummary` (safe, no conflicts with existing fields 1–17). Field number 3 on `GetAggregatedPortfolioSummaryRequest` and 2 on `GetPortfolioSummaryRequest`.

**Step 1: Add PnlPeriod enum after the existing enums (before PortfolioSummary message)**
Insert after the existing enums (around line 89, before `// Portfolio summary for dashboard`):

```protobuf
// PnlPeriod defines the time window for period-scoped PnL calculation
enum PnlPeriod {
  PNL_PERIOD_UNSPECIFIED = 0;  // Same as ALL — returns existing all-time PnL
  PNL_PERIOD_1D = 1;
  PNL_PERIOD_1W = 2;
  PNL_PERIOD_1M = 3;
  PNL_PERIOD_ALL = 4;
}
```

**Step 2: Add fields 18–20 to PortfolioSummary message**
After field 17 (`worstPerformers`), add:

```protobuf
  int64  periodPnl        = 18 [json_name = "periodPnl"];        // PnL for the selected period window
  double periodPnlPercent = 19 [json_name = "periodPnlPercent"]; // PnL% for the selected period window
  PnlPeriod period        = 20 [json_name = "period"];           // The period used for this response
```

**Step 3: Add `period` field to GetAggregatedPortfolioSummaryRequest**
After field 2 (`typeFilter`), add:

```protobuf
  PnlPeriod period = 3 [json_name = "period"];  // Optional — default PERIOD_ALL
```

**Step 4: Add `period` field to GetPortfolioSummaryRequest**
After field 1 (`walletId`), add:

```protobuf
  PnlPeriod period = 2 [json_name = "period"];  // Optional — default PERIOD_ALL
```

**Step 5: Run proto generation and verify it compiles**
```bash
cd /Users/admin/Desktop/khanh/workspace/Personal_Financial_Management
task proto:all
```
Expected: No errors. Generated files updated in `src/go-backend/protobuf/v1/` and `src/wj-client/gen/protobuf/v1/` and `src/wj-client/utils/generated/hooks.ts`.

**Step 6: Verify Go build still compiles**
```bash
cd src/go-backend && go build ./...
```

**Step 7: Commit**
`feat(proto): add PnlPeriod enum and period fields to PortfolioSummary and requests`

---

### Task 2: Backend — Period PnL Calculation in InvestmentService

**Files:**
- Modify: `src/go-backend/domain/service/investment_service.go` (both `GetPortfolioSummary` and `GetAggregatedPortfolioSummary`)
- Modify: `src/go-backend/domain/service/interfaces.go` (update `GetPortfolioSummary` signature)
- Modify: `src/go-backend/domain/repository/portfolio_history_repository.go` (add `GetPeriodStartSnapshot` method)
- Modify: `src/go-backend/domain/repository/portfolio_history_repository_impl.go` (implement it)

**Security notes:**
- `period` enum value must be validated (only 0–4 accepted; treat unknown as 0/ALL)
- All arithmetic on `int64` — no float for delta computation
- Division by zero guard: only compute `periodPnlPercent` when `snapshotTotalValue > 0`
- No new DB writes; read-only operation on `portfolio_history`

**Step 1: Write failing service test** (add to `investment_service_test.go` or create `investment_service_period_test.go`)

```go
// Test: period=1W returns periodPnl = currentTotalPnl - snapshotTotalPnl
func TestGetAggregatedPortfolioSummary_PeriodPnl(t *testing.T) {
    // Setup: mock portfolioHistoryRepo.GetPeriodStartSnapshot to return a snapshot
    // with TotalPnl=500_000 and TotalValue=10_000_000
    // Setup: currentTotalPnl = 600_000
    // Expected: periodPnl = 100_000, periodPnlPercent = 1.0
}

// Test: no snapshot found → fallback to all-time
func TestGetAggregatedPortfolioSummary_PeriodPnl_NoSnapshot(t *testing.T) {
    // Setup: mock portfolioHistoryRepo.GetPeriodStartSnapshot to return nil
    // Expected: periodPnl = totalPnl, periodPnlPercent = totalPnlPercent
}

// Test: snapshotTotalValue = 0 → periodPnlPercent = 0
func TestGetAggregatedPortfolioSummary_PeriodPnl_ZeroValue(t *testing.T) {
    // Setup: snapshot.TotalValue = 0
    // Expected: periodPnlPercent = 0 (no division)
}

// Test: period=PERIOD_ALL → returns existing totalPnl, periodPnl mirrors totalPnl
func TestGetAggregatedPortfolioSummary_PeriodAll(t *testing.T) {
    // period=0 or period=4
    // Expected: periodPnl = totalPnl, periodPnlPercent = totalPnlPercent
}
```

**Step 2: Run tests to verify they fail**
```bash
cd src/go-backend && go test -run TestGetAggregatedPortfolioSummary_Period ./domain/service/... -v
```

**Step 3: Add `GetPeriodStartSnapshot` to PortfolioHistoryRepository interface**

In `domain/repository/portfolio_history_repository.go`, add to the interface:

```go
// GetPeriodStartSnapshot finds the oldest snapshot at or before `from` for the user.
// Returns nil, nil if no snapshot exists (caller handles fallback).
GetPeriodStartSnapshot(ctx context.Context, userID int32, from time.Time) (*models.PortfolioHistory, error)
```

**Step 4: Implement `GetPeriodStartSnapshot` in the impl**

In `domain/repository/portfolio_history_repository_impl.go`, add:

```go
// GetPeriodStartSnapshot retrieves the aggregated portfolio snapshot nearest to the period start.
// It sums TotalPnl and TotalValue across all wallets for the user at the given timestamp.
// Uses the oldest snapshot at or before `from` to represent the start-of-period state.
func (r *portfolioHistoryRepositoryImpl) GetPeriodStartSnapshot(ctx context.Context, userID int32, from time.Time) (*models.PortfolioHistory, error) {
    // Get all wallet snapshots nearest to the period start (one per wallet, most recent <= from)
    // Then aggregate them into a single synthetic PortfolioHistory representing total portfolio state.
    var snapshots []*models.PortfolioHistory

    // Subquery: for each wallet, get the most recent snapshot at or before `from`
    // Using a raw query for correctness, wrapped in GORM's raw execution
    err := r.db.WithContext(ctx).Raw(`
        SELECT DISTINCT ON (wallet_id) id, user_id, wallet_id, total_value, total_cost, total_pnl, currency, timestamp, created_at, updated_at, deleted_at
        FROM portfolio_history
        WHERE user_id = ? AND timestamp <= ? AND deleted_at IS NULL
        ORDER BY wallet_id, timestamp DESC
    `, userID, from).Scan(&snapshots).Error
    if err != nil {
        return nil, err
    }
    if len(snapshots) == 0 {
        return nil, nil
    }

    // Aggregate across wallets
    var totalPnl, totalValue int64
    for _, s := range snapshots {
        totalPnl += s.TotalPnl
        totalValue += s.TotalValue
    }

    return &models.PortfolioHistory{
        UserID:     userID,
        TotalPnl:   totalPnl,
        TotalValue: totalValue,
        Timestamp:  from,
    }, nil
}
```

**Step 5: Add period resolution helper in investment_service.go**

Add a private helper near the top of the service implementation (or in a new file `investment_service_period.go`):

```go
// periodToDuration converts a PnlPeriod to the lookback duration from now.
// Returns 0 for PERIOD_ALL or PERIOD_UNSPECIFIED.
func periodToDays(period investmentv1.PnlPeriod) int {
    switch period {
    case investmentv1.PnlPeriod_PNL_PERIOD_1D:
        return 1
    case investmentv1.PnlPeriod_PNL_PERIOD_1W:
        return 7
    case investmentv1.PnlPeriod_PNL_PERIOD_1M:
        return 30
    default: // PNL_PERIOD_ALL, PNL_PERIOD_UNSPECIFIED
        return 0
    }
}

// computePeriodPnl fetches the start-of-period snapshot and computes periodPnl delta.
// Falls back to (totalPnl, totalPnlPercent) when no snapshot is available.
func (s *investmentService) computePeriodPnl(
    ctx context.Context,
    userID int32,
    period investmentv1.PnlPeriod,
    currentTotalPnl int64,
    currentTotalPnlPercent float64,
) (periodPnl int64, periodPnlPercent float64, err error) {
    days := periodToDays(period)
    if days == 0 {
        // PERIOD_ALL — mirror all-time values
        return currentTotalPnl, currentTotalPnlPercent, nil
    }

    from := time.Now().AddDate(0, 0, -days)
    snapshot, err := s.portfolioHistoryRepo.GetPeriodStartSnapshot(ctx, userID, from)
    if err != nil {
        return 0, 0, err
    }
    if snapshot == nil {
        // No history for the period — fallback to all-time
        return currentTotalPnl, currentTotalPnlPercent, nil
    }

    periodPnl = currentTotalPnl - snapshot.TotalPnl
    if snapshot.TotalValue > 0 {
        periodPnlPercent = float64(periodPnl) / float64(snapshot.TotalValue) * 100
    }
    return periodPnl, periodPnlPercent, nil
}
```

**Step 6: Wire `portfolioHistoryRepo` into `investmentService`**

Check if `investmentService` already has access to `portfolioHistoryRepo`. Look at the struct definition. If not, add it:
- In the service struct, add: `portfolioHistoryRepo repository.PortfolioHistoryRepository`
- In the constructor `NewInvestmentService(...)`, add the parameter and assign it.
- In `providers.go` (or wherever `NewInvestmentService` is called), pass the `portfolioHistoryRepo` instance.

**Step 7: Call `computePeriodPnl` at the end of `GetAggregatedPortfolioSummary`**

After the existing `totalPNL` and `totalPNLPercent` are computed (around line 2126–2131), add:

```go
// Compute period-scoped PnL
periodPnl, periodPnlPercent, err := s.computePeriodPnl(ctx, userID, req.Period, totalPNL, totalPNLPercent)
if err != nil {
    log.Printf("Warning: failed to compute period PnL: %v", err)
    // Non-fatal — fall back to all-time
    periodPnl = totalPNL
    periodPnlPercent = totalPNLPercent
}
```

Then, when building the `PortfolioSummary` response, populate the new fields:

```go
summary.PeriodPnl = periodPnl
summary.PeriodPnlPercent = periodPnlPercent
summary.Period = req.Period
```

**Step 8: Call `computePeriodPnl` at the end of `GetPortfolioSummary`**

The `GetPortfolioSummary` method currently takes `(ctx, walletID, userID)` — no `req` parameter. Since the spec adds `period` to `GetPortfolioSummaryRequest`, update the service interface:

```go
// Before:
GetPortfolioSummary(ctx context.Context, walletID int32, userID int32) (*investmentv1.GetPortfolioSummaryResponse, error)

// After:
GetPortfolioSummary(ctx context.Context, walletID int32, userID int32, period investmentv1.PnlPeriod) (*investmentv1.GetPortfolioSummaryResponse, error)
```

Update the implementation to accept and use `period`, calling `computePeriodPnl` before building the response.

Also update the call in `GetAggregatedPortfolioSummary` where it delegates:
```go
// Before:
return s.GetPortfolioSummary(ctx, req.WalletId, userID)
// After:
return s.GetPortfolioSummary(ctx, req.WalletId, userID, req.Period)
```

**Step 9: Run tests to verify they pass**
```bash
cd src/go-backend && go test -run TestGetAggregatedPortfolioSummary_Period ./domain/service/... -v
```

**Step 10: Verify full Go build**
```bash
cd src/go-backend && go build ./...
```

**Step 11: Commit**
`feat(investment): add period PnL calculation using portfolio_history snapshots`

---

### Task 3: Backend — Handler Update (parse `period` query param)

**Files:**
- Modify: `src/go-backend/handlers/investment.go`

**Security notes:**
- Parse `period` as int32 from query string
- Validate: only accept 0–4. Anything else → default to 0 (PERIOD_ALL). No 400 error — graceful degradation.
- Do NOT leak internal error details if conversion fails.

**Step 1: Write failing handler test**

In `handlers/investment_test.go` (or create it), add:

```go
// Test: period=2 query param is parsed and passed to service
func TestGetAggregatedPortfolioSummary_PeriodParam(t *testing.T) {
    // GET /api/v1/portfolio-summary/aggregated?period=2
    // Expected: service called with req.Period = PNL_PERIOD_1W (2)
}

// Test: invalid period=-1 defaults to PERIOD_ALL (0)
func TestGetAggregatedPortfolioSummary_InvalidPeriod(t *testing.T) {
    // GET /api/v1/portfolio-summary/aggregated?period=-1
    // Expected: service called with req.Period = 0 (PNL_PERIOD_UNSPECIFIED)
}

// Test: period=99 (out of range) defaults to PERIOD_ALL (0)
func TestGetAggregatedPortfolioSummary_OutOfRangePeriod(t *testing.T) {
    // GET /api/v1/portfolio-summary/aggregated?period=99
    // Expected: service called with req.Period = 0
}
```

**Step 2: Run tests to verify they fail**
```bash
cd src/go-backend && go test -run TestGetAggregatedPortfolioSummary_Period ./handlers/... -v
```

**Step 3: Add period parsing to `GetAggregatedPortfolioSummary` handler**

In `handlers/investment.go`, in the `GetAggregatedPortfolioSummary` handler function, after the existing typeFilter parsing (around line 779), add:

```go
// Parse period parameter (support both snake_case and camelCase)
periodStr := c.Query("period")
if periodStr == "" {
    periodStr = c.Query("pnl_period")
}
if periodStr != "" {
    periodVal, err := strconv.ParseInt(periodStr, 10, 32)
    if err != nil || periodVal < 0 || periodVal > 4 {
        // Invalid period — default to PERIOD_ALL (0)
        req.Period = investmentv1.PnlPeriod_PNL_PERIOD_UNSPECIFIED
    } else {
        req.Period = investmentv1.PnlPeriod(int32(periodVal))
    }
}
```

**Step 4: Update `GetPortfolioSummary` handler** (line 551–574)

Find the handler and update the service call to pass `req.Period`:

```go
// Parse period param
var period investmentv1.PnlPeriod
periodStr := c.Query("period")
if periodStr != "" {
    periodVal, err := strconv.ParseInt(periodStr, 10, 32)
    if err == nil && periodVal >= 0 && periodVal <= 4 {
        period = investmentv1.PnlPeriod(int32(periodVal))
    }
}

result, err := h.investmentService.GetPortfolioSummary(c.Request.Context(), walletID, userID, period)
```

**Step 5: Run tests to verify they pass**
```bash
cd src/go-backend && go test -run TestGetAggregatedPortfolioSummary_Period ./handlers/... -v
```

**Step 6: Verify full build**
```bash
cd src/go-backend && go build ./...
```

**Step 7: Commit**
`feat(investment): parse period query param in portfolio summary handlers`

---

### Task 4: Frontend — PNLCard Refactor (self-contained with 4 tabs)

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/home/PNLCard.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/home/page.tsx` (simplify PNLCard usage — remove pre-computed PnL props)
- Modify: `src/wj-client/messages/en/ui.json` (add new i18n keys)
- Modify: `src/wj-client/messages/vi/ui.json` (add Vietnamese translations)

**Security notes:** Client-side only. The `period` value is derived from component state (tab selection), not user text input — no XSS risk. React Query cache key includes the period, so different selections use separate cache entries.

**Step 1: Add i18n keys to ui.json (en and vi)**

In `messages/en/ui.json`, under `dashboard.home`, add:

```json
"1day": "1D",
"1week": "1W",
"1month": "1M",
"allTime": "ALL",
"pnl1d": "P/L 1D",
"pnl1w": "P/L 1W",
"pnl1m": "P/L 1M",
"pnlAll": "P/L ALL"
```

In `messages/vi/ui.json`, under `dashboard.home`, add:

```json
"1day": "1N",
"1week": "1T",
"1month": "1Th",
"allTime": "Tất cả",
"pnl1d": "L/L 1N",
"pnl1w": "L/L 1T",
"pnl1m": "L/L 1Th",
"pnlAll": "L/L Tổng"
```

**Step 2: Write failing component test for PNLCard**

In `app/[locale]/dashboard/home/__tests__/PNLCard.test.tsx` (create if needed):

```typescript
// Test: renders 4 tabs — 1D, 1W, 1M, ALL
// Test: default active tab is 1M
// Test: clicking 1W tab changes selected period
// Test: displays periodPnl and periodPnlPercent from API response
// Test: shows loading state while fetching
```

**Step 3: Rewrite PNLCard.tsx**

Replace the current props-driven component with a self-contained version:

```typescript
"use client";

import { LineChart } from "@/components/charts/LineChart";
import {
  useQueryGetHistoricalPortfolioValues,
  useQueryGetAggregatedPortfolioSummary,
} from "@/utils/generated/hooks";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { PnlPeriod } from "@/gen/protobuf/v1/investment";
import { parseAmount } from "@/utils/currency-formatter";

interface PNLCardProps {
  currency: string;
}

// Map UI tab to API PnlPeriod enum value
const TAB_TO_PERIOD: Record<string, PnlPeriod> = {
  "1D": PnlPeriod.PNL_PERIOD_1D,    // 1
  "1W": PnlPeriod.PNL_PERIOD_1W,    // 2
  "1M": PnlPeriod.PNL_PERIOD_1M,    // 3
  "ALL": PnlPeriod.PNL_PERIOD_ALL,  // 4
};

const TAB_TO_CHART_DAYS: Record<string, { days: number; points: number }> = {
  "1D": { days: 1, points: 24 },
  "1W": { days: 7, points: 7 },
  "1M": { days: 30, points: 30 },
  "ALL": { days: 365, points: 50 },
};

export function PNLCard({ currency }: PNLCardProps) {
  const t = useTranslations("dashboard.home");
  const [selectedTab, setSelectedTab] = useState<"1D" | "1W" | "1M" | "ALL">("1M");

  const period = TAB_TO_PERIOD[selectedTab];
  const { days, points } = TAB_TO_CHART_DAYS[selectedTab];

  // Self-contained portfolio summary query with period
  const { data: summaryData, isLoading: summaryLoading } =
    useQueryGetAggregatedPortfolioSummary(
      { walletId: 0, typeFilter: 0, period },
      { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false }
    );

  // Historical chart data
  const { data: histData, isLoading: histLoading } =
    useQueryGetHistoricalPortfolioValues(
      { walletId: 0, typeFilter: 0, days, points },
      { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false }
    );

  // Extract period PnL from response
  const periodPnl = parseAmount(summaryData?.data?.periodPnl);
  const periodPnlPercent = Number(summaryData?.data?.periodPnlPercent ?? 0);

  const tabs = [
    { key: "1D" as const, label: t("1day") },
    { key: "1W" as const, label: t("1week") },
    { key: "1M" as const, label: t("1month") },
    { key: "ALL" as const, label: t("allTime") },
  ];

  const chartPoints = (histData?.data || []).map((point) => ({
    date: new Date(Number(point.timestamp) * 1000).toLocaleDateString("vi-VN", {
      month: "2-digit",
      day: "2-digit",
    }),
    value: Number(point.totalValue) / 100,
  }));

  const firstValue = chartPoints[0]?.value ?? 0;
  const lastValue = chartPoints[chartPoints.length - 1]?.value ?? 0;
  const chartColor = lastValue >= firstValue ? "#16A34A" : "#DC2626";

  const isPositive = periodPnl >= 0;

  const formatAmount = (amount: number) => {
    const value = Number(amount);
    const sign = value >= 0 ? "+" : "";
    return `${sign}${new Intl.NumberFormat("vi-VN").format(value)}`;
  };

  const formatPercent = (percent: number) => {
    const value = Number(percent);
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
  };

  const yFormatter = (value: number) =>
    `${(value / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}M`;

  return (
    <div className="bg-white rounded-[20px] border border-v2-border-light shadow-v2-card overflow-hidden">
      {/* Header */}
      <div className="p-5 pb-4">
        <div className="flex items-center justify-between">
          <h3 className="font-vietnam font-semibold text-[16px] text-v2-text-primary">
            {t("pnlTitle")}
          </h3>
          {/* Period tabs */}
          <div className="flex gap-1 bg-v2-bg-primary rounded-xl p-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSelectedTab(tab.key)}
                className={`px-3 py-1.5 rounded-[10px] text-[12px] font-vietnam font-medium transition-colors ${
                  selectedTab === tab.key
                    ? "bg-v2-red-primary text-white"
                    : "text-v2-text-secondary hover:text-v2-text-primary"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* PnL metric — period-scoped */}
        <div className="mt-4">
          {summaryLoading ? (
            <div className="h-10 w-32 bg-v2-bg-surface-tint rounded-lg animate-pulse" />
          ) : (
            <div>
              <p
                className={`font-jetbrains font-bold text-[20px] ${
                  isPositive ? "text-v2-green-positive" : "text-v2-red-negative"
                }`}
              >
                {formatPercent(periodPnlPercent)}
              </p>
              <p className="font-jetbrains font-medium text-[13px] text-v2-text-secondary mt-0.5">
                {formatAmount(periodPnl)} {currency}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="px-2 pb-5">
        {histLoading && (
          <div className="h-[200px] bg-v2-bg-surface-tint rounded-xl flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-v2-red-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!histLoading && chartPoints.length === 0 && (
          <div className="h-[200px] bg-v2-bg-surface-tint rounded-xl flex items-center justify-center">
            <p className="font-vietnam text-[13px] text-v2-text-tertiary">{t("comingSoon")}</p>
          </div>
        )}
        {!histLoading && chartPoints.length > 0 && (
          <LineChart
            data={chartPoints}
            series={[{ dataKey: "value", name: "Portfolio", color: chartColor, chartType: "area", showDots: false }]}
            xAxisKey="date"
            height={200}
            showGrid={true}
            showLegend={false}
            showTooltip={true}
            yAxisFormatter={yFormatter}
            animate={true}
            gridColor="#f3f4f6"
          />
        )}
      </div>
    </div>
  );
}
```

**Step 4: Simplify PNLCard usage in home/page.tsx**

In `page.tsx`, the PNLCard no longer needs PnL props. Update both mobile and desktop usages:

```typescript
// Mobile:
<PNLCard currency={currency} />

// Desktop:
<PNLCard currency={currency} />
```

Remove the now-unused variables `totalPnl` and `totalPnlPercent` from the home page (they may still be used by `NetWorthDisplay` — check before removing).

**Step 5: Run frontend build to verify no TypeScript errors**
```bash
cd src/wj-client && npx tsc --noEmit
```

**Step 6: Run tests**
```bash
cd src/wj-client && npm test -- --testPathPattern="PNLCard"
```

**Step 7: Commit**
`feat(home): refactor PNLCard to self-contained with 4 period tabs (1D/1W/1M/ALL)`

---

### Task 5: Frontend — PortfolioSummaryEnhanced Period Selector

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/portfolio/components/PortfolioSummaryEnhanced.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/portfolio/page.tsx` (pass period to portfolio summary query)
- Modify: `src/wj-client/messages/en/investment.json` (add period labels to investment namespace)
- Modify: `src/wj-client/messages/vi/investment.json` (add Vietnamese)

**Security notes:** Period is derived from component state, not user text input. No XSS risk. Loading state prevents stale data from showing during re-fetch.

**Step 1: Add period i18n keys to investment.json**

In `messages/en/investment.json`, under `investment.summary`:

```json
"period1D": "1D",
"period1W": "1W",
"period1M": "1M",
"periodAll": "ALL",
"periodLabel": "Period",
"periodPnl": "Period PnL"
```

In `messages/vi/investment.json`:

```json
"period1D": "1N",
"period1W": "1T",
"period1M": "1Th",
"periodAll": "Tất cả",
"periodLabel": "Kỳ",
"periodPnl": "L/L kỳ"
```

**Step 2: Write failing component test for PortfolioSummaryEnhanced**

```typescript
// Test: period selector renders with 4 options
// Test: default selected period is 1M
// Test: clicking 1W calls onPeriodChange callback
// Test: displays periodPnl when data has periodPnl
```

**Step 3: Update PortfolioSummaryData interface**

In `PortfolioSummaryEnhanced.tsx`, add to `PortfolioSummaryData`:

```typescript
periodPnl?: number;
periodPnlPercent?: number;
displayPeriodPnl?: { amount: number; currency: string };
```

**Step 4: Update PortfolioSummaryEnhancedProps**

Add a period-related prop:

```typescript
export interface PortfolioSummaryEnhancedProps {
  // ... existing props ...
  /** Currently selected period (controlled from parent) */
  selectedPeriod?: "1D" | "1W" | "1M" | "ALL";
  /** Called when user changes period */
  onPeriodChange?: (period: "1D" | "1W" | "1M" | "ALL") => void;
}
```

**Step 5: Add period pill selector UI in PortfolioSummaryEnhanced**

Inside the component, render a period selector above or near the PnL `StatCard`. The pills use the same visual pattern as PNLCard tabs (compact, mobile-friendly).

Insert before the `<div className="grid ...">` of StatCards:

```tsx
{/* Period Selector */}
<div className="flex items-center gap-2 mb-3">
  <span className="text-xs text-neutral-500">{t("summary.periodLabel")}</span>
  <div className="flex gap-1 bg-neutral-100 rounded-xl p-1">
    {(["1D", "1W", "1M", "ALL"] as const).map((p) => (
      <button
        key={p}
        onClick={() => onPeriodChange?.(p)}
        className={`px-2.5 py-1 rounded-[8px] text-[11px] font-medium transition-colors ${
          selectedPeriod === p
            ? "bg-white shadow-sm text-neutral-900"
            : "text-neutral-500 hover:text-neutral-700"
        }`}
      >
        {t(`summary.period${p === "ALL" ? "All" : p}` as any)}
      </button>
    ))}
  </div>
</div>
```

**Step 6: Update the PnL StatCard to show period-scoped PnL when available**

In the StatCard for `totalPnl`, conditionally use `periodPnl` if it differs from `totalPnl` and period is not ALL:

```typescript
const displayPnlValue = (portfolioSummary.periodPnl !== undefined && selectedPeriod !== "ALL")
  ? (portfolioSummary.displayPeriodPnl?.amount ?? portfolioSummary.periodPnl ?? 0)
  : displayPnl;

const displayPnlPercent = (portfolioSummary.periodPnlPercent !== undefined && selectedPeriod !== "ALL")
  ? portfolioSummary.periodPnlPercent
  : pnlPercent;
```

Use `displayPnlValue` and `displayPnlPercent` in the PnL StatCard.

**Step 7: Update portfolio/page.tsx**

Add period state and pass it to the portfolio summary query and PortfolioSummaryEnhanced:

```typescript
const [summaryPeriod, setSummaryPeriod] = useState<"1D" | "1W" | "1M" | "ALL">("1M");

const PERIOD_TO_ENUM: Record<string, number> = {
  "1D": 1, "1W": 2, "1M": 3, "ALL": 4
};

const { data: portfolioSummaryData, isLoading: summaryLoading } = useQueryGetAggregatedPortfolioSummary(
  { walletId: selectedWalletId, typeFilter: Number(typeFilter), period: PERIOD_TO_ENUM[summaryPeriod] },
  { staleTime: 5 * 60 * 1000 }
);
```

Pass to PortfolioSummaryEnhanced:

```tsx
<PortfolioSummaryEnhanced
  portfolioSummary={...}
  selectedPeriod={summaryPeriod}
  onPeriodChange={setSummaryPeriod}
  ...
/>
```

**Step 8: Run frontend build**
```bash
cd src/wj-client && npx tsc --noEmit
```

**Step 9: Run tests**
```bash
cd src/wj-client && npm test -- --testPathPattern="PortfolioSummaryEnhanced"
```

**Step 10: Commit**
`feat(portfolio): add period selector to PortfolioSummaryEnhanced (1D/1W/1M/ALL)`

---

### Task 6: End-to-End Smoke Test and Progress File Initialization

**Files:**
- Create: `docs/reports/2026-03-09-period-pnl-progress.md`

**Steps:**

**Step 1: Manual smoke test checklist**
```
[ ] backend: GET /api/v1/portfolio-summary/aggregated?period=2 returns periodPnl field
[ ] backend: period=0 returns periodPnl = totalPnl (all-time fallback)
[ ] backend: period=99 defaults gracefully (no 500 error)
[ ] frontend: home PNLCard shows 4 tabs (1D, 1W, 1M, ALL)
[ ] frontend: switching tabs updates the displayed PnL
[ ] frontend: portfolio PortfolioSummaryEnhanced shows period pills
[ ] frontend: switching period pills re-fetches and updates PnL values
[ ] frontend: loading state shown during re-fetch
```

**Step 2: Initialize progress file**
Create `docs/reports/2026-03-09-period-pnl-progress.md` using the progress file template from the skill.

**Step 3: Commit**
`chore: initialize period PnL progress file`

---

## Task Summary

| # | Task | Files Touched | Est. Effort |
|---|------|---------------|-------------|
| 0 | Update C4 + flow diagrams | 2 docs | Small |
| 1 | Proto: PnlPeriod enum + fields | 1 proto | Small |
| 2 | Backend service: period PnL calc | 4 Go files | Medium |
| 3 | Backend handler: parse period param | 1 Go file | Small |
| 4 | Frontend PNLCard refactor | 4 TS/JSON files | Medium |
| 5 | Frontend PortfolioSummaryEnhanced | 4 TS/JSON files | Medium |
| 6 | Smoke test + progress file | 1 doc | Small |

**Dependencies:**
- Task 1 (proto) must complete before Task 2 (backend service), Task 3 (handler), Task 4 (frontend)
- Task 2 must complete before Task 3 (handler calls updated service method)
- Tasks 4 and 5 are independent (can run in parallel once Task 1 is done)
- Task 6 comes last

**Parallel execution groups:**
1. Task 0 (docs) — can run any time
2. Task 1 (proto) — required first for all backend/frontend tasks
3. Task 2 + Task 3 — sequential (service before handler)
4. Task 4 + Task 5 — parallel after Task 1
5. Task 6 — last

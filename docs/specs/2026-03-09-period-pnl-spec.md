# Period-Based PnL Feature Specification

## Summary

Currently, the portfolio summary API always returns `totalPnl` as the all-time cumulative PnL (unrealized + realized from inception). The `PNLCard` on the home dashboard and the `PortfolioSummaryEnhanced` on the portfolio page both display this single number regardless of the selected time period. This feature adds period-based PnL calculation so that when the user selects "1D", "1W", "1M", or "ALL", the displayed PnL reflects gains/losses for that specific window.

The calculation strategy is **snapshot-based**: the `portfolio_history` table already captures hourly TotalPnl snapshots. Period PnL = `currentTotalPnl - snapshotTotalPnl at period start`. This is the cheapest approach — no new tables, no transaction re-processing.

The UI changes are:
1. **PNLCard tabs** expanded from `{7d, 30d}` to `{1D, 1W, 1M, ALL}`, with the active tab driving both the chart and the displayed PnL metric.
2. **PortfolioSummaryEnhanced** gains a period selector (same four options) that controls the displayed PnL values.

---

## User Stories

- As a user, I want to see my PnL for today so I know how much I gained or lost today.
- As a user, I want to see my PnL over the last 7 days so I can track short-term performance.
- As a user, I want to see my PnL over the last 30 days so I can monitor monthly performance.
- As a user, I want to see my all-time PnL so I know my total return since I started investing.
- As a user, I want the chart period and the PnL metric to be in sync — switching the tab updates both.

---

## Functional Requirements

### FR-1: Backend — Period PnL Calculation in Aggregated Portfolio Summary

The `GetAggregatedPortfolioSummary` (and `GetPortfolioSummary`) endpoints must accept an optional `period` parameter. When provided, the backend uses the `portfolio_history` table to find the oldest snapshot at or before the period start time, then computes:

```
periodPnl        = currentTotalPnl - snapshotTotalPnl
periodPnlPercent = periodPnl / snapshotTotalValue × 100  (if snapshotTotalValue > 0, else 0)
```

For period `ALL` (or when `period` is omitted), return the existing all-time `totalPnl` and `totalPnlPercent` unchanged.

If no snapshot exists for the requested period start (e.g., user only started 2 days ago and requests 1W), fall back to the oldest available snapshot.

**Acceptance criteria:**
- [ ] `GetAggregatedPortfolioSummaryRequest` has a new optional `period` field (enum: `PERIOD_1D`, `PERIOD_1W`, `PERIOD_1M`, `PERIOD_ALL`; default `PERIOD_ALL`)
- [ ] `GetPortfolioSummaryRequest` has the same new optional `period` field
- [ ] `PortfolioSummary` response includes `periodPnl` (int64), `periodPnlPercent` (double), `period` (enum) fields
- [ ] Backend queries `portfolio_history` for the snapshot at `now - periodDays` and computes the delta
- [ ] When `period = PERIOD_ALL` or unset, existing `totalPnl`/`totalPnlPercent` are returned; `periodPnl` mirrors `totalPnl`
- [ ] Response correctly handles the fallback when no snapshot exists at period start

### FR-2: Backend — Period enum in Protobuf

A new `PnlPeriod` enum is added to `investment.proto`:

```protobuf
enum PnlPeriod {
  PNL_PERIOD_UNSPECIFIED = 0;  // Same as ALL
  PNL_PERIOD_1D = 1;
  PNL_PERIOD_1W = 2;
  PNL_PERIOD_1M = 3;
  PNL_PERIOD_ALL = 4;
}
```

**Acceptance criteria:**
- [ ] Enum defined in `investment.proto`
- [ ] `task proto:all` generates updated Go + TypeScript types without errors

### FR-3: Frontend — PNLCard tabs expanded to 1D / 1W / 1M / ALL

The `PNLCard` currently has tabs `{7d, 30d}`. Expand to `{1D, 1W, 1M, ALL}`. The active tab drives:
- The chart period (days parameter to historical values query)
- The PnL metric displayed (pass the `period` to the API, display `periodPnl` / `periodPnlPercent`)

**Acceptance criteria:**
- [ ] PNLCard has 4 tabs: `1D`, `1W`, `1M`, `ALL`
- [ ] Default active tab is `1M`
- [ ] Switching tabs updates both the chart and the PnL percentage / amount shown
- [ ] The "ALL" tab shows all-time PnL and fetches the full historical chart (max 365 days)
- [ ] `home/page.tsx` passes `period` to the `GetAggregatedPortfolioSummary` query, or PNLCard manages its own portfolio summary query internally
- [ ] i18n keys added for new tab labels (`1day`, `1week`, `1month`, `allTime`)

### FR-4: Frontend — PortfolioSummaryEnhanced period selector

Add a period selector (same 4 options) to `PortfolioSummaryEnhanced`. The selected period is passed to the `GetAggregatedPortfolioSummary` query; the displayed `totalPnl`, `totalPnlPercent`, `realizedPnl`, `unrealizedPnl` all reflect the period-scoped values.

**Acceptance criteria:**
- [ ] Period selector UI (pill tabs) rendered near the PnL section of the portfolio summary card
- [ ] Default period is `1M`
- [ ] Switching period re-fetches the portfolio summary with the new period parameter
- [ ] Displayed PnL values (`displayTotalPnl`, percentage) update on period change
- [ ] Loading state shown while re-fetching

---

## Non-Functional Requirements

- **Performance**: Period PnL query must use the existing `idx_wallet_timestamp` index on `portfolio_history`. Single lookup per wallet, O(1) with index.
- **Backward compatibility**: `period` is optional with default `PERIOD_ALL` — existing callers get the same all-time PnL they receive today.
- **Accuracy**: PnL is computed from snapshot delta, same precision as existing `int64` monetary values.
- **Caching**: `staleTime: 5 * 60 * 1000` is sufficient; different period selections will naturally produce different React Query cache keys.

---

## Architecture Changes (C4)

### Diagrams to Update

- **`c4-component-backend.md`** — No structural change needed (same service, same handler, new parameter).
- **`c4-component-frontend.md`** — PNLCard and PortfolioSummaryEnhanced now have internal period state that drives API parameters; update component descriptions if present.

### New Diagrams

No new L4 code diagram needed — this is a parameter extension on existing service methods, not a new bounded context.

---

## Runtime Flow Diagrams

### Flow Diagrams to Update

**`flow-investment.md`** — Add a new sequence diagram: "Period PnL Calculation". The flow:
1. Frontend sends `GetAggregatedPortfolioSummary(period=1W)`
2. Handler calls `investmentService.GetAggregatedPortfolioSummary(ctx, userID, req)`
3. Service computes current `totalPnl` as today (existing logic)
4. Service calls `portfolioHistoryRepo.GetAggregatedHistory(ctx, userID, from=now-7d, to=now, limit=1)` to get start-of-period snapshot
5. Computes `periodPnl = currentTotalPnl - snapshotTotalPnl`
6. Returns `PortfolioSummary` with both `totalPnl` (all-time) and `periodPnl` (period-scoped) populated

---

## Data Model Changes

No new database tables or columns needed. The `portfolio_history` table already has `TotalPnl`, `TotalValue`, and `Timestamp` columns with appropriate indexes.

---

## API Changes

### New Protobuf enum

```protobuf
enum PnlPeriod {
  PNL_PERIOD_UNSPECIFIED = 0;
  PNL_PERIOD_1D = 1;
  PNL_PERIOD_1W = 2;
  PNL_PERIOD_1M = 3;
  PNL_PERIOD_ALL = 4;
}
```

### Modified: `PortfolioSummary` message

Add 3 fields (high field numbers to avoid breaking existing clients):

```protobuf
message PortfolioSummary {
  // ... existing fields 1-17 unchanged ...
  int64  periodPnl        = 18 [json_name = "periodPnl"];
  double periodPnlPercent = 19 [json_name = "periodPnlPercent"];
  PnlPeriod period        = 20 [json_name = "period"];
}
```

### Modified: `GetAggregatedPortfolioSummaryRequest`

```protobuf
message GetAggregatedPortfolioSummaryRequest {
  int32 walletId         = 1 [json_name = "walletId"];
  InvestmentType typeFilter = 2 [json_name = "typeFilter"];
  PnlPeriod period       = 3 [json_name = "period"];  // NEW — default PERIOD_ALL
}
```

### Modified: `GetPortfolioSummaryRequest`

```protobuf
message GetPortfolioSummaryRequest {
  int32 walletId = 1 [json_name = "walletId"];
  PnlPeriod period = 2 [json_name = "period"];  // NEW — default PERIOD_ALL
}
```

### HTTP — no URL changes

Both endpoints keep the same URLs; `period` is passed as a query parameter by gRPC-Gateway:
- `GET /api/v1/portfolio-summary?period=2` (1W = value 2)
- `GET /api/v1/wallets/{walletId}/portfolio-summary?period=2`

---

## UI/UX Changes

### PNLCard (`app/[locale]/dashboard/home/PNLCard.tsx`)

Current props:
```typescript
interface PNLCardProps {
  todayPnl?; todayPnlPercent?;
  weekPnl?; weekPnlPercent?;
  monthPnl?; monthPnlPercent?;
  currency: string;
}
```

New design — PNLCard becomes **self-contained** for period selection and data fetching:
```typescript
interface PNLCardProps {
  currency: string;
}
```
The component internally calls `useQueryGetAggregatedPortfolioSummary` with the selected period, removing the need for the parent page to pass pre-computed PnL values. The 4 tabs (`1D`, `1W`, `1M`, `ALL`) control both the API `period` parameter and the chart `days` parameter.

Tab → days for chart mapping:
| Tab | API period | Chart days | Chart points |
|-----|-----------|------------|--------------|
| 1D  | PERIOD_1D  | 1          | 24           |
| 1W  | PERIOD_1W  | 7          | 7            |
| 1M  | PERIOD_1M  | 30         | 30           |
| ALL | PERIOD_ALL | 365        | 50           |

### PortfolioSummaryEnhanced (`app/[locale]/dashboard/portfolio/components/PortfolioSummaryEnhanced.tsx`)

Add a period pill selector (same 4 options) near the PnL display section. The component passes the selected period to its portfolio summary query. Default: `1M`.

**Mobile-first note:** Period tabs must work on small screens — use compact labels (`1D`, `1W`, `1M`, `ALL`) with the existing `v2-*` color system. Follow `sm:` 800px breakpoint from `tailwind.config.ts`.

---

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Browser | `period` enum value (0-4) | Yes: Internet → App | Backend handler | User-supplied query param |
| 2 | Backend | `portfolio_history` rows | No (internal DB) | Investment service | DB read, no user-supplied SQL |
| 3 | Backend | Computed `periodPnl` int64 | Yes: App → Browser | JSON response | Read-only financial data |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App | period query param | JWT auth (existing) + enum validation |
| App → DB | portfolio_history queries | Parameterized GORM queries (existing) |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | Internet → App | Tampering | Attacker sends `period=-1` or `period=99` to cause unexpected behavior | Low | Enum validation in handler: accept only 0-4, default to `PERIOD_ALL` for unknown values |
| T-2 | 1 | Internet → App | Info Disclosure | User queries another user's portfolio summary by guessing walletId | High | Already mitigated — existing auth middleware verifies walletId ownership (no change needed) |
| T-3 | 3 | App → Browser | Info Disclosure | `periodPnl` reveals financial performance | Low | Acceptable — user's own data, already authenticated |

### Authorization Rules

- No change to authorization. JWT auth is already enforced on both endpoints. WalletId ownership is already validated in the service layer.
- The new `period` parameter is read-only and does not affect authorization decisions.

### Input Validation Rules

| Field | Rule | Layer |
|-------|------|-------|
| `period` | Must be in range 0-4 (valid PnlPeriod enum). Unknown values → default to `PERIOD_ALL` | Handler (Go) |
| `walletId` | Existing validation unchanged | Service (Go) |

### External Dependency Risks

None. This feature reads only from the existing `portfolio_history` table — no new external APIs or packages.

### Sensitive Data Handling

`periodPnl` reveals financial performance data. This is the user's own data and is already protected by JWT authentication. No new sensitive data exposure paths are introduced.

### Issues & Risks Summary

1. **No historical data for new users**: Users who just started may have no `portfolio_history` rows. Fallback: if no snapshot found, `periodPnl = totalPnl` (treat as all-time). Show a tooltip noting limited history.
2. **Hourly snapshot granularity**: "1D" period may not be fully accurate if the market moved significantly within the last hour since the last snapshot. This is a known limitation of the snapshot-based approach and is acceptable.
3. **PNLCard API query duplication**: Making PNLCard self-contained means it calls `GetAggregatedPortfolioSummary` separately from `home/page.tsx`. This doubles the API call on the home page. Mitigate: use React Query's shared cache — both callers with the same parameters will share the cached result.

---

## Edge Cases & Error Handling

| Case | Handling |
|------|---------|
| No portfolio_history rows for user | `periodPnl = totalPnl`, `periodPnlPercent = totalPnlPercent` (fallback to all-time) |
| `period = PERIOD_ALL` or `period = 0` (unspecified) | Return existing `totalPnl`/`totalPnlPercent`; set `periodPnl = totalPnl`, `periodPnlPercent = totalPnlPercent` |
| Portfolio value was zero at period start | `periodPnlPercent = 0` (avoid division by zero) |
| User selects 1D but has no snapshot from >1h ago | Return latest available snapshot delta, or zero if only one snapshot |
| Portfolio summary query fails | Frontend shows existing loading/error state; no new error paths |

---

## Dependencies & Assumptions

- `portfolio_history` table exists and is populated by the `portfolio_snapshot_job` (hourly). This is already running in production.
- `GetAggregatedHistory` repository method is already implemented and queries by `from`/`to` time range with a limit.
- `task proto:all` can be run to regenerate Go and TypeScript code.
- i18n translation files exist at `src/wj-client/messages/` — new keys will be added there.

---

## Out of Scope

- Custom date range picker (e.g., pick any start/end date).
- Per-investment period PnL breakdown.
- Portfolio history backfill for existing users (data is captured going forward from when the feature was deployed).
- Push notifications for period PnL thresholds.

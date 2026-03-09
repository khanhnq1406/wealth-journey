# Period-Based PnL — Implementation Report

## Summary

Added period-scoped PnL (1D / 1W / 1M / ALL) to the investment portfolio API and frontend. Users can now see how their portfolio performed over a specific time window, not just all-time. The feature is surfaced in two places:

1. **PNLCard (Home Dashboard)** — Self-contained card with 4 period tabs that fetches period-specific PnL directly.
2. **PortfolioSummaryEnhanced (Portfolio Page)** — Period pill selector above the stats grid; the PnL card switches to period-scoped values when a non-ALL period is selected.

## Spec Reference

`docs/specs/2026-03-09-period-pnl-spec.md`

## Plan Reference

`docs/plans/2026-03-09-period-pnl-plan.md`

## Tasks Completed

| # | Task | Status | Files Changed | TDD |
|---|------|--------|---------------|-----|
| 0 | Update C4 and Flow Architecture Diagrams | Done | c4-component-frontend.md, flow-investment.md | N/A |
| 1 | Add PnlPeriod Enum and Fields to investment.proto | Done | investment.proto → task proto:all | Yes (build verify) |
| 2 | Backend Service — Period PnL Calculation | Done | portfolio_history_repository, investment_service, investment_service_period.go, services.go | Yes (build verify) |
| 3 | Backend Handler — Parse period query param | Done | handlers/investment.go | Yes (build verify) |
| 4 | Frontend PNLCard Refactor | Done | PNLCard.tsx, home/page.tsx, en/ui.json, vi/ui.json | Yes (tsc verify) |
| 5 | Frontend PortfolioSummaryEnhanced Period Selector | Done | PortfolioSummaryEnhanced.tsx, portfolio/page.tsx, en/investment.json, vi/investment.json | Yes (tsc verify) |
| 6 | Implementation Report | Done | This file, progress.md | N/A |

## Security Implementation Summary

| Concern | Implementation | Verified |
|---------|---------------|----------|
| Input validation | `period` param range-checked 0–4 in both handlers; out-of-range silently defaults to 0 | Yes |
| Authorization | No new auth surface — period is a filter on existing data the user owns | Yes |
| Financial data integrity | All delta calculations use int64 arithmetic; float only for percentage display | Yes |
| Graceful degradation | Missing snapshot → falls back to all-time PnL (non-fatal, logged) | Yes |

## Architecture Changes

### Backend
- `PortfolioHistoryRepository` interface: added `GetPeriodStartSnapshot(ctx, userID, from) (*PortfolioHistory, error)`
- Implementation: `DISTINCT ON (wallet_id)` query gets per-wallet snapshot closest to `from` date; results aggregated in memory
- `InvestmentService` struct: added `portfolioHistoryRepo` dependency (injected via constructor)
- New file `investment_service_period.go`: `periodToDays()` + `computePeriodPnl()` helpers
- `GetPortfolioSummary` + `GetAggregatedPortfolioSummary` now populate `PeriodPnl`, `PeriodPnlPercent`, `Period` in response
- Both REST handlers parse `?period=` (and alias `?pnl_period=` for aggregated) with 0–4 guard

### Frontend
- `PNLCard` is now fully self-contained: only takes `currency` prop, manages period state internally, calls API with the correct `PnlPeriod` enum value
- `PortfolioSummaryEnhanced`: new optional props `selectedPeriod` / `onPeriodChange`; renders period pill selector when `onPeriodChange` is provided
- `portfolio/page.tsx`: manages `summaryPeriod` state, converts to `PnlPeriod` enum, passes to query + component

## Commits

| Hash | Task | Description |
|------|------|-------------|
| 2c0dd54 | 0 | docs: update C4 frontend descriptions and add period PnL flow diagram |
| 6793fac | 1 | feat(proto): add PnlPeriod enum and period fields to PortfolioSummary and requests |
| 1b6db69 | 2+3 | feat(investment): add period PnL calculation and parse period query param in handlers |
| b2fe98a | 4+5 | feat(investment): add period PnL tabs to PNLCard and portfolio summary |

## Known Issues / Technical Debt

- `NetWorthDisplay` on the home page still shows static all-time PnL props (todayPnl/weekPnl/monthPnl all point to same all-time value) — pre-existing limitation, out of scope for this feature
- Pre-existing TypeScript errors in test files (`portfolio.test.tsx`, `FormSelect.test.tsx`, etc.) are unrelated to this feature
- Portfolio snapshots are written by the hourly scheduler job; users with no snapshot history will see all-time PnL as fallback

## Files Changed

### Backend
- `api/protobuf/v1/investment.proto`
- `src/go-backend/domain/repository/portfolio_history_repository.go`
- `src/go-backend/domain/repository/portfolio_history_repository_impl.go`
- `src/go-backend/domain/service/investment_service.go`
- `src/go-backend/domain/service/investment_service_period.go` (new)
- `src/go-backend/domain/service/interfaces.go`
- `src/go-backend/domain/service/services.go`
- `src/go-backend/domain/service/portfolio_history_service.go`
- `src/go-backend/handlers/investment.go`

### Frontend
- `src/wj-client/app/[locale]/dashboard/home/PNLCard.tsx`
- `src/wj-client/app/[locale]/dashboard/home/page.tsx`
- `src/wj-client/app/[locale]/dashboard/portfolio/page.tsx`
- `src/wj-client/app/[locale]/dashboard/portfolio/components/PortfolioSummaryEnhanced.tsx`
- `src/wj-client/messages/en/ui.json`
- `src/wj-client/messages/vi/ui.json`
- `src/wj-client/messages/en/investment.json`
- `src/wj-client/messages/vi/investment.json`

### Docs
- `docs/architecture/c4-component-frontend.md`
- `docs/architecture/flow-investment.md`
- `docs/reports/2026-03-09-period-pnl-progress.md`
- `docs/reports/2026-03-09-period-pnl-report.md` (this file)

## How to Test

### Backend
1. Ensure the portfolio snapshot scheduler has run at least once (or manually call `POST /api/v1/portfolio/snapshot`)
2. `GET /api/v1/investments/portfolio-summary?walletId=0&period=1` → response should have `periodPnl`, `periodPnlPercent`, `period: 1`
3. `GET /api/v1/investments/portfolio-summary?walletId=0&period=0` → `periodPnl` and `totalPnl` should match (all-time fallback)
4. `GET /api/v1/investments/portfolio-summary?walletId=0&period=99` → handler defaults to 0 (no 400)

### Frontend
1. Navigate to `/dashboard/home` → PNLCard should show 4 tabs (1D / 1W / 1M / ALL)
2. Click each tab → PnL value and percentage should update
3. Navigate to `/dashboard/portfolio` → period pill selector appears above Summary cards
4. Click "1M" → PnL StatCard label changes to "Period PNL", value shows 1-month delta
5. Click "ALL" → label reverts to "Total PNL"

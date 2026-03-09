# Period-Based PnL — Implementation Progress

## Metadata
- **Feature:** Period-Based PnL (1D/1W/1M/ALL)
- **Plan file:** docs/plans/2026-03-09-period-pnl-plan.md
- **Spec file:** docs/specs/2026-03-09-period-pnl-spec.md
- **Started:** 2026-03-09T00:00:00Z
- **Last updated:** 2026-03-09T00:00:00Z
- **Current state:** in_progress
- **Current task:** 0

## Task Progress

| # | Task Name | Status | Commit | Summary |
|---|-----------|--------|--------|---------|
| 0 | Update C4 and Flow Architecture Diagrams | in_progress | — | — |
| 1 | Add PnlPeriod Enum and Fields to investment.proto | pending | — | — |
| 2 | Backend Service — Period PnL Calculation | pending | — | — |
| 3 | Backend Handler — Parse period query param | pending | — | — |
| 4 | Frontend PNLCard Refactor | pending | — | — |
| 5 | Frontend PortfolioSummaryEnhanced Period Selector | pending | — | — |
| 6 | Smoke Test + Progress File Initialization | pending | — | — |

**Status values:** `pending` | `in_progress` | `done` | `skipped`

## Resume Instructions

To resume this implementation in a new session:
1. Read this progress file
2. Read the plan file referenced above
3. Check `git log --oneline -10` to verify last commit matches the last `done` task
4. Check `git status` for any uncommitted work
5. Continue from the next `pending` task using the same checkpoint protocol

## Notes

- investmentService struct does NOT currently have portfolioHistoryRepo — must add it
- NewInvestmentService called in services.go line 44, must add portfolioHistoryRepo param
- GetPortfolioSummary service signature needs period param added
- GetAggregatedHistory exists in repo impl; need to add GetPeriodStartSnapshot
- totalPNL computed at line 2126 in GetAggregatedPortfolioSummary, line 1489 in GetPortfolioSummary

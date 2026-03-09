# Period-Based PnL — Implementation Progress

## Metadata
- **Feature:** Period-Based PnL (1D/1W/1M/ALL)
- **Plan file:** docs/plans/2026-03-09-period-pnl-plan.md
- **Spec file:** docs/specs/2026-03-09-period-pnl-spec.md
- **Started:** 2026-03-09T00:00:00Z
- **Last updated:** 2026-03-09T12:00:00Z
- **Current state:** in_progress
- **Current task:** 6

## Task Progress

| # | Task Name | Status | Commit | Summary |
|---|-----------|--------|--------|---------|
| 0 | Update C4 and Flow Architecture Diagrams | done | 2c0dd54 | Updated c4-component-frontend.md and flow-investment.md with period PnL flow |
| 1 | Add PnlPeriod Enum and Fields to investment.proto | done | 6793fac | PnlPeriod enum + periodPnl/periodPnlPercent/period fields in PortfolioSummary |
| 2 | Backend Service — Period PnL Calculation | done | 1b6db69 | GetPeriodStartSnapshot repo method + computePeriodPnl service logic |
| 3 | Backend Handler — Parse period query param | done | 1b6db69 | Both handlers parse ?period= with 0-4 range validation |
| 4 | Frontend PNLCard Refactor | done | — | Self-contained PNLCard with 4 period tabs, fetches own data |
| 5 | Frontend PortfolioSummaryEnhanced Period Selector | done | — | Period pill selector in PortfolioSummaryEnhanced; portfolio page passes period enum |
| 6 | Smoke Test + Progress File Finalization | in_progress | — | — |

**Status values:** `pending` | `in_progress` | `done` | `skipped`

## Resume Instructions

To resume this implementation in a new session:
1. Read this progress file
2. Read the plan file referenced above
3. Check `git log --oneline -10` to verify last commit matches the last `done` task
4. Check `git status` for any uncommitted work
5. Continue from the next `pending` task using the same checkpoint protocol

## Notes

- Tasks 2 and 3 committed together (handler fix required for clean build)
- Pre-existing TS errors in test files (portfolio.test.tsx, FormSelect.test.tsx, etc.) are unrelated to this feature
- `home/page.tsx` still fetches portfolio summary for net worth calculation (totalPortfolioValue) and NetWorthDisplay PnL props — period=0 (all-time)
- PNLCard is now self-contained: only takes `currency` prop, manages its own period state + API calls
- PortfolioSummaryEnhanced: period pill selector only renders when `onPeriodChange` is provided

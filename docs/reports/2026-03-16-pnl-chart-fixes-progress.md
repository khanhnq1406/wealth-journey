# PNL Chart & Portfolio History Fixes — Implementation Progress

## Metadata
- **Feature:** PNL Chart & Portfolio History Fixes
- **Plan file:** docs/plans/2026-03-16-pnl-chart-fixes-plan.md
- **Spec file:** docs/specs/2026-03-16-pnl-chart-fixes-spec.md
- **Started:** 2026-03-16T22:00:00+07:00
- **Last updated:** 2026-03-16T23:30:00+07:00
- **Current state:** completed
- **Current task:** done

## Task Progress

| # | Task Name | Status | Commit | Summary |
|---|-----------|--------|--------|---------|
| 1 | Fix SQL aggregation in GetAggregatedHistory | done | `5aa22bb` | SQL GROUP BY + SUM replaces raw per-wallet rows |
| 2 | Set CurrentPrice = AverageCost for CASH/FOREIGN_CURRENCY | done | `685eee0` | Seed currentPrice so UnrealizedPNL=0 |
| 3 | Add periodPnlApproximate to proto and backend | done | `e679e00` | New bool field 21, computePeriodPnl returns isApproximate |
| 4 | Backfill snapshot on investment creation with past purchase date | done | `17eedbd` | Snapshot at purchaseDate for period PNL accuracy |
| 5 | Update frontend PNLCard for approximate indicator | done | `1629eec` | ≈ prefix + note text when approximate |
| 6 | Update implementation report with fix history | done | — | Appended 4 fixes to report |

## Notes

- `investmentService` already has `portfolioHistoryRepo` — no circular dependency for Task 4
- Proto PortfolioSummary field 21 used for `periodPnlApproximate`
- Tasks 1 and 2 ran in parallel (independent files)

# Real Chart Data (Gold, Silver, PNL) — Implementation Progress

## Metadata
- **Feature:** Real Chart Data (Gold, Silver, PNL)
- **Plan file:** docs/plans/2026-03-09-real-chart-data-plan.md
- **Spec file:** docs/specs/2026-03-09-real-chart-data-spec.md
- **Started:** 2026-03-09T00:00:00+07:00
- **Last updated:** 2026-03-09T00:00:00+07:00
- **Current state:** in_progress
- **Current task:** 0

## Task Progress

| # | Task Name | Status | Commit | Summary |
|---|-----------|--------|--------|---------|
| 0 | Add Protobuf Types and Generate Code | pending | — | — |
| 1 | Implement Gold Chart Backend Handler | pending | — | — |
| 2 | Implement Silver Chart Backend Handler | pending | — | — |
| 3 | Add i18n Translation Keys for Chart UI | pending | — | — |
| 4 | Implement Gold Price Chart Frontend | pending | — | — |
| 5 | Implement Silver Price Chart Frontend | pending | — | — |
| 6 | Implement PNL Chart Frontend | pending | — | — |
| 7 | Update C4 Architecture Diagrams | pending | — | — |
| 8 | Create Runtime Flow Diagram | pending | — | — |

**Status values:** `pending` | `in_progress` | `done` | `skipped`

## Resume Instructions

To resume this implementation in a new session:
1. Read this progress file
2. Read the plan file referenced above
3. Check `git log --oneline -10` to verify last commit matches the last `done` task
4. Check `git status` for any uncommitted work
5. Continue from the next `pending` task using the same checkpoint protocol

## Notes

- Frontend chart path is `src/wj-client/app/[locale]/dashboard/home/` (locale-based routing)
- Handlers go in `src/go-backend/handlers/` (NOT `api/handlers/`)
- Hooks use `gin.H{}` responses — access fields at top level (no `data` unwrapping)
- LineChart component at `src/wj-client/components/charts/LineChart.tsx` supports area series
- Yahoo Finance global throttler available via `yahoo.GetGlobalThrottler().Wait(ctx)`

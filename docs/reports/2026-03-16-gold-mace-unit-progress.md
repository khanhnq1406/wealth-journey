# Gold Mace (Chỉ) Unit Conversion — Implementation Progress

## Metadata
- **Feature:** Gold mace (chỉ) unit conversion
- **Plan file:** docs/plans/2026-03-16-gold-mace-unit-plan.md
- **Spec file:** docs/specs/2026-03-16-gold-mace-unit-spec.md
- **Started:** 2026-03-16T00:00:00Z
- **Last updated:** 2026-03-16T00:00:00Z
- **Current state:** in_progress
- **Current task:** 4

## Task Progress

| # | Task Name | Status | Commit | Summary |
|---|-----------|--------|--------|---------|
| 0 | Update C4 Architecture Diagrams & Flow Diagrams | done | (batch) | Updated tael→mace/lượng in c4-code-investment.md and flow-investment.md |
| 1 | Backend — Replace tael with mace in pkg/gold/types.go | done | (batch) | Replaced UnitTael→UnitMace, GramsPerTael→GramsPerMace, added gramsPerLuong, updated registry |
| 2 | Backend — Update pkg/gold/converter.go and tests | done | (batch) | Updated all conversion functions, ProcessMarketPrice uses gramsPerLuong, all 27 tests pass |
| 3 | Backend — Update handlers and services | done | (batch) | Updated getDisplayUnitForType, convertPriceForDisplay, database backfill, integration test |
| 4 | Update protobuf comments | pending | — | — |
| 5 | Frontend — Update gold-calculator.ts and tests | pending | — | — |
| 6 | Frontend — Update portfolio helpers.tsx | pending | — | — |
| 7 | Frontend — Update forms | pending | — | — |
| 8 | Frontend — Update i18n files | pending | — | — |
| 9 | Frontend — Update LandingInvestmentFeatures.tsx | pending | — | — |
| 10 | Verify full build and run all tests | pending | — | — |

**Status values:** `pending` | `in_progress` | `done` | `skipped`

## Resume Instructions

To resume this implementation in a new session:
1. Read this progress file
2. Read the plan file referenced above
3. Check `git log --oneline -10` to verify last commit matches the last `done` task
4. Check `git status` for any uncommitted work
5. Continue from the next `pending` task using the same checkpoint protocol

## Notes

- Tasks 0, 1, 4, 5, 8 are independent and can start in parallel
- Tasks 2, 3 depend on Task 1
- Tasks 6, 7 depend on Task 5
- Task 9 depends on Task 8
- Task 10 depends on all others

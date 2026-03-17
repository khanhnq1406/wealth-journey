# Gold Mace (Chỉ) Unit Conversion — Implementation Progress

## Metadata
- **Feature:** Gold mace (chỉ) unit conversion
- **Plan file:** docs/plans/2026-03-16-gold-mace-unit-plan.md
- **Spec file:** docs/specs/2026-03-16-gold-mace-unit-spec.md
- **Started:** 2026-03-16T00:00:00Z
- **Last updated:** 2026-03-16T12:00:00Z
- **Current state:** completed
- **Current task:** done

## Task Progress

| # | Task Name | Status | Commit | Summary |
|---|-----------|--------|--------|---------|
| 0 | Update C4 Architecture Diagrams & Flow Diagrams | done | 37d8f33 | Updated tael→mace/lượng in c4-code-investment.md and flow-investment.md |
| 1 | Backend — Replace tael with mace in pkg/gold/types.go | done | 37d8f33 | Replaced UnitTael→UnitMace, GramsPerTael→GramsPerMace, added gramsPerLuong, updated registry |
| 2 | Backend — Update pkg/gold/converter.go and tests | done | 37d8f33 | Updated all conversion functions, ProcessMarketPrice uses gramsPerLuong, all 27 tests pass |
| 3 | Backend — Update handlers and services | done | 37d8f33 | Updated getDisplayUnitForType, convertPriceForDisplay, database backfill, integration test |
| 4 | Update protobuf comments | done | (this commit) | Updated 4 comment locations in investment.proto, regenerated proto |
| 5 | Frontend — Update gold-calculator.ts and tests | done | (this commit) | Replaced tael→mace in types, constants, conversions, labels, options; all 31 tests pass |
| 6 | Frontend — Update portfolio helpers.tsx | done | (this commit) | Updated formatGoldPrice multiplier 37.5→3.75, unit type, added mace case to getInvestmentUnitLabelFull |
| 7 | Frontend — Update forms | done | (this commit) | Updated AddInvestmentForm (goldQuantityUnit, placeholder, label) and AddInvestmentTransactionForm (goldDisplayUnit, comments, placeholder/step) |
| 8 | Frontend — Update i18n files | done | (this commit) | Added maceUnit/maceUnitLong keys in en/vi, updated nav.json taelGramOunce→maceGramOunce |
| 9 | Frontend — Update LandingInvestmentFeatures.tsx | done | (this commit) | Updated i18n key reference to maceGramOunce |
| 10 | Verify full build and run all tests | done | (this commit) | Backend builds, 27 gold tests pass, 31 frontend tests pass, TS check clean |

**Status values:** `pending` | `in_progress` | `done` | `skipped`

## Resume Instructions

Implementation is complete. No further tasks remaining.

## Notes

- Tasks 0, 1, 4, 5, 8 are independent and can start in parallel
- Tasks 2, 3 depend on Task 1
- Tasks 6, 7 depend on Task 5
- Task 9 depends on Task 8
- Task 10 depends on all others
- Silver package keeps UnitTael unchanged (out of scope)
- Dual constant design: GramsPerMace=3.75 (public, display) and gramsPerLuong=37.5 (private, market price normalization)
- Floating point fix in test: `.toBeCloseTo(1000, 4)` instead of `.toBe(1000)` for mace→mace identity conversion

# Gold Mace (Chỉ) Unit Conversion — Implementation Report

## Summary

Replaced tael (lượng, 37.5g) with mace (chỉ, 3.75g) as the display unit for Vietnamese gold (GOLD_VND) investments across the entire stack — backend, frontend, proto comments, i18n, and documentation. Internal storage format remains unchanged (grams × 10000). Silver investments remain unaffected.

## Spec Reference
`docs/specs/2026-03-16-gold-mace-unit-spec.md`

## Plan Reference
`docs/plans/2026-03-16-gold-mace-unit-plan.md`

## Tasks Completed

| # | Task | Status | Files Changed | Tests | TDD |
|---|------|--------|---------------|-------|-----|
| 0 | Update C4 Architecture Diagrams & Flow Diagrams | Done | 2 | N/A | N/A |
| 1 | Backend — Replace tael with mace in pkg/gold/types.go | Done | 1 | 27 pass | Yes |
| 2 | Backend — Update pkg/gold/converter.go and tests | Done | 2 | 27 pass | Yes |
| 3 | Backend — Update handlers and services | Done | 4 | 27 pass | Yes |
| 4 | Update protobuf comments | Done | 1 + generated | N/A | N/A |
| 5 | Frontend — Update gold-calculator.ts and tests | Done | 2 | 31 pass | Yes |
| 6 | Frontend — Update portfolio helpers.tsx | Done | 1 | N/A | N/A |
| 7 | Frontend — Update forms | Done | 2 | N/A | N/A |
| 8 | Frontend — Update i18n files | Done | 4 | N/A | N/A |
| 9 | Frontend — Update LandingInvestmentFeatures.tsx | Done | 1 | N/A | N/A |
| 10 | Verify full build and run all tests | Done | 0 | All pass | N/A |

## Test Coverage Summary

| Layer | Test File | Tests | Pass | Coverage Area |
|-------|-----------|-------|------|---------------|
| Backend Gold | `pkg/gold/converter_test.go` | 27 | 27/27 | Unit conversions, price conversions, storage, display, ProcessMarketPrice |
| Frontend Gold | `features/investment/utils/gold-calculator.test.ts` | 31 | 31/31 | Unit conversions, price conversions, storage, display, options, types |

## Key Design Decisions

### Dual Constant Design
- `GramsPerMace = 3.75` (public) — used for display-level conversions
- `gramsPerLuong = 37.5` (private) — used only in `ProcessMarketPrice()` for vang.today API normalization
- This decouples the display unit change from the market price normalization logic

### ProcessMarketPrice Rewrite
- Previously called `GetPriceUnitForMarketData()` which now returns `UnitMace`
- Rewritten to directly use `gramsPerLuong` constant to avoid incorrect price division
- Market prices from vang.today are per lượng (37.5g), not per mace (3.75g)

### Floating Point Handling
- `convertGoldPricePerUnit(1000, 'mace', 'mace')` returns `1000.0000000000001` due to `1000 / 3.75 * 3.75`
- Test uses `.toBeCloseTo(1000, 4)` instead of `.toBe(1000)`

## Files Changed

### Backend (commit 37d8f33)
- `docs/architecture/c4-code-investment.md` — Updated market price unit description
- `docs/architecture/flow-investment.md` — Updated storage examples and flowchart
- `src/go-backend/pkg/gold/types.go` — Constants, unit enum, registry entries
- `src/go-backend/pkg/gold/converter.go` — All conversion functions, ProcessMarketPrice
- `src/go-backend/pkg/gold/converter_test.go` — All test values and names
- `src/go-backend/handlers/investment.go` — getDisplayUnitForType, convertPriceForDisplay
- `src/go-backend/pkg/database/database.go` — Backfill SQL
- `src/go-backend/domain/service/market_data_service.go` — Comment update
- `src/go-backend/domain/service/gold_investment_integration_test.go` — Test values

### Frontend + Proto (commit 5ecb0d2)
- `api/protobuf/v1/investment.proto` — 4 comment updates
- `src/wj-client/features/investment/utils/gold-calculator.ts` — Types, constants, functions, labels
- `src/wj-client/features/investment/utils/gold-calculator.test.ts` — All 31 tests
- `src/wj-client/app/[locale]/dashboard/portfolio/helpers.tsx` — formatGoldPrice, getInvestmentUnitLabelFull
- `src/wj-client/features/investment/forms/AddInvestmentForm.tsx` — goldQuantityUnit, placeholder, label
- `src/wj-client/features/investment/forms/AddInvestmentTransactionForm.tsx` — goldDisplayUnit, comments
- `src/wj-client/messages/en/investment.json` — Added maceUnit, maceUnitLong
- `src/wj-client/messages/vi/investment.json` — Added maceUnit, maceUnitLong
- `src/wj-client/messages/en/nav.json` — maceGramOunce, descriptions, testimonial
- `src/wj-client/messages/vi/nav.json` — maceGramOunce
- `src/wj-client/components/landing/LandingInvestmentFeatures.tsx` — i18n key
- `src/go-backend/protobuf/v1/investment.pb.go` — Generated
- `src/wj-client/gen/protobuf/v1/investment.ts` — Generated
- `src/wj-client/utils/generated/api.ts` — Generated
- `src/wj-client/utils/generated/hooks.ts` — Generated

### Unchanged (by design)
- Silver calculator and silver form references (`tael` remains for silver)
- Market prices page (displays per-lượng, out of scope)
- Database schema (no migration needed)
- API contract (comment-only proto changes)

## How to Test

1. **Backend**: `cd src/go-backend && go test ./pkg/gold/... -v`
2. **Frontend**: `cd src/wj-client && npx jest features/investment/utils/gold-calculator.test.ts`
3. **Build**: `cd src/go-backend && go build ./...`
4. **TypeScript**: `cd src/wj-client && npx tsc --noEmit`
5. **Manual**: Create a VND gold investment — quantity should be in chỉ, prices per chỉ

## Fix History

| Date | Fix | Severity | File |
|------|-----|----------|------|
| 2026-03-17 | Gold unit info line displayed raw internal value "mace" instead of localized label "Chỉ" (VI) / "Mace (chỉ)" (EN). Fixed by mapping `selectedGoldType.unit` through i18n keys in `AddInvestmentForm.tsx:691`. | Minor | `src/wj-client/features/investment/forms/AddInvestmentForm.tsx` |

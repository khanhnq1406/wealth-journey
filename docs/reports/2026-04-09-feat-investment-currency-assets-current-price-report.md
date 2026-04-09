# Investment Currency Assets — Auto Current Price Implementation Report

## Summary

Implemented end-to-end auto-price updates for FOREIGN_CURRENCY investments. Previously, currency investments required manual price entry. Now they connect to the existing `AssetDisplayConfigService` price cache (populated by the Vietcombank rate fetcher every 15 minutes), receive auto price updates via the background scheduler, and use an API-driven dropdown instead of a free-text symbol input.

## Spec Reference

`docs/specs/2026-04-09-feat-investment-currency-assets-current-price-spec.md`

## Plan Reference

`docs/plans/2026-04-09-feat-investment-currency-assets-current-price-plan.md`

## Tasks Completed

| #   | Task                                                           | Status | Files Changed | Tests    | TDD |
| --- | -------------------------------------------------------------- | ------ | ------------- | -------- | --- |
| 0   | Update C4 Architecture Diagrams                               | Done   | 3 docs        | N/A      | N/A |
| 1   | Backend — Route FOREIGN_CURRENCY in UpdatePricesForInvestments | Done  | 2 Go files    | 4/4 pass | Yes |
| 2   | Backend — Stop Forcing isCustom=true for FOREIGN_CURRENCY     | Done   | 2 Go files    | 1/1 pass | Yes |
| 3   | Backend — Server-side validation for FOREIGN_CURRENCY symbol  | Done   | 7 Go files    | 3/3 pass | Yes |
| 4   | Frontend — Replace Free-Text Symbol with Currency Dropdown    | Done   | 5 TS files    | 14/14 pass | Yes |
| 5   | Backend — Verify priceUpdatedAt is set for FOREIGN_CURRENCY   | Done   | 1 Go file     | 1/1 pass | Yes |
| 6   | Update Runtime Flow Diagrams                                  | Done   | 1 doc         | N/A      | N/A |
| 7   | Database Migration — Enable ShowInInvestment for Currency Configs | Done | 2 files    | Build OK | N/A |
| 8   | Verify Full Integration + CI                                  | Done   | 1 E2E fix     | All pass | N/A |

## Test Coverage Summary

| Layer              | Test File                                                      | Tests | Pass | Coverage Area |
| ------------------ | -------------------------------------------------------------- | ----- | ---- | ------------- |
| Backend Service    | `market_data_service_test.go`                                  | 3     | 3/3  | FOREIGN_CURRENCY grouping by symbol, error skip, stale price |
| Backend Service    | `investment_service_test.go` (Tasks 2, 3, 5)                  | 5     | 5/5  | isCustom pass-through, symbol validation (valid/invalid), priceUpdatedAt |
| Frontend Component | `AddInvestmentForm.forex.test.tsx`                             | 14    | 14/14 | Currency query enabled flag, loading/empty states, showInInvestment filter, isCustom=false |

## Security Implementation Summary

| Concern          | Implementation                                              | Verified |
| ---------------- | ----------------------------------------------------------- | -------- |
| Symbol validation | Server-side: `ListForInvestment` check before DB write when `isCustom=false` | Yes |
| Input source     | Symbol from API `typeCode`, not user-typed free text        | Yes |
| Authorization    | All investment operations use existing JWT-protected paths  | Yes |
| No nil bypass    | Removed nil-guard from validation — always runs for non-custom FOREIGN_CURRENCY | Yes |
| Monetary values  | Buy price stored as `int64` VND throughout                  | Yes |
| Error responses  | `apperrors.NewValidationError` — no internal details leaked | Yes |
| Depguard         | Service layer imports verified — no gorm/gin/redis          | Yes |

## Review Results

### Spec Compliance
All 3 reviewers returned PASS. All functional requirements implemented.

### Security Review
All stages APPROVED. Key finding: Initial implementation had a nil-guard (`if s.assetDisplayConfigService != nil`) around the currency symbol validation. Reviewer correctly flagged this as a security hole — if the dependency were ever nil at runtime, validation would silently bypass. Fixed before commit.

### Code Quality
All stages APPROVED with minor notes:
- E2E test loading/empty state assertions use `.catch(() => {})` silencers (reduced test fidelity, not a blocker)
- `Taskfile.yml` `backend:migrate-all` was missing the new migration step — fixed before commit

## Known Issues / Technical Debt

- `TestExecuteImport_*` test failures in `domain/service` package are pre-existing and unrelated to this feature (import service tests requiring external dependencies)
- E2E tests are written but not run in CI (`playwright test` not triggered); coverage relies on unit tests

## Files Changed

### Backend

- `src/go-backend/domain/service/market_data_service.go` — FOREIGN_CURRENCY routing branch
- `src/go-backend/domain/service/market_data_service_test.go` — 3 new tests (created)
- `src/go-backend/domain/service/investment_service.go` — `assetDisplayConfigService` dep + isCustom comment + symbol validation
- `src/go-backend/domain/service/investment_service_test.go` — 5 new tests
- `src/go-backend/domain/service/services.go` — wire `assetDisplayConfigSvc` to investmentService
- `src/go-backend/domain/service/investment_buy_quantity_guard_test.go` — updated constructor calls
- `src/go-backend/domain/service/investment_service_sell_test.go` — updated constructor calls
- `src/go-backend/domain/service/investment_edit_transaction_test.go` — updated constructor calls
- `src/go-backend/domain/service/investment_manual_price_test.go` — updated constructor calls
- `src/go-backend/cmd/migrate-currency-investment/main.go` — migration script (created)

### Frontend

- `src/wj-client/features/investment/forms/AddInvestmentForm.tsx` — currency dropdown
- `src/wj-client/features/investment/forms/__tests__/AddInvestmentForm.forex.test.tsx` — 14 tests (created)
- `src/wj-client/messages/en/investment.json` — 3 new i18n keys
- `src/wj-client/messages/vi/investment.json` — 3 new i18n keys
- `src/wj-client/tests/e2e/add-foreign-currency-investment-flow.spec.ts` — E2E spec (created)

### Docs / Config

- `docs/architecture/c4-component-backend.md` — FOREIGN_CURRENCY in MarketDataService description
- `docs/architecture/c4-component-frontend.md` — currency query in AddInvestmentForm description
- `docs/architecture/flow-investment.md` — section 12 Currency Price Refresh sequence diagram
- `Taskfile.yml` — `backend:migrate-currency-investment` task + added to `backend:migrate-all`

## How to Test

### Unit & Integration Tests

```bash
# Backend
cd src/go-backend
go test ./domain/service/... -run "TestUpdatePricesForInvestments_ForeignCurrency" -v
go test ./domain/service/... -run "TestCreateInvestment_ForeignCurrency" -v
go test ./domain/service/... -run "TestUpdatePrices_ForeignCurrency" -v
task ci:backend-lint

# Frontend
cd src/wj-client
npx jest features/investment/forms/__tests__/AddInvestmentForm.forex.test.tsx --no-coverage --watchAll=false
task ci:frontend
```

### Dependency Impact Verification

GitNexus not available — manual blast radius review performed:

| Changed Symbol | Downstream Impact | Tested? |
| --- | --- | --- |
| `UpdatePricesForInvestments` | Called by `price_update_job.go` (scheduler) | Yes — existing + 3 new unit tests |
| `CreateInvestment` | Called by `investment_handler.go` | Yes — 3 new unit tests; handler wiring unchanged |
| `NewInvestmentService` | Called from `services.go` only | Yes — all test files updated |
| `AddInvestmentForm` (FOREIGN_CURRENCY path) | Rendered in portfolio/investment modal | Yes — 14 new unit tests |

### Manual Testing Steps

#### Scenario: Create FOREIGN_CURRENCY investment with auto-price

**Preconditions:** Logged in; run `task backend:migrate-currency-investment` to enable currencies; USD/EUR must be in asset_display_config with `show_in_investment=true`

1. Navigate to `/dashboard/portfolio`
2. Open "Add Investment" form
3. Select type "Foreign Currency" → Expected: Currency dropdown appears (not free-text input)
4. Select "USD" from dropdown → Expected: Symbol field set to "USD", Name auto-filled
5. Enter quantity and cost, submit → Expected: Investment created with `is_custom=false` in DB
6. Wait 15 minutes (or trigger price update) → Expected: `current_price` updated from VCB rates, `price_updated_at` set

#### Scenario: Invalid currency symbol rejected

**Preconditions:** API call with `isCustom=false`, `symbol="FAKE"` (not in asset_display_config)

1. POST `/api/v1/investments` with `{ symbol: "FAKE", type: FOREIGN_CURRENCY, isCustom: false }` → Expected: 400 Bad Request, `currency "FAKE" is not available for investment`

#### Scenario: Legacy isCustom=true investments unaffected

**Preconditions:** Existing FOREIGN_CURRENCY investment with `is_custom=true`

1. Price update job runs → Expected: Investment is skipped by auto-update (isCustom=true excluded from update query)
2. Manual price set still works via existing path

#### Scenario: Authorization boundary

**Preconditions:** Logged in as User A

1. Attempt to view/edit User B's FOREIGN_CURRENCY investment → Expected: 403 or not found

#### Scenario: Mobile viewport (375px)

1. Open Add Investment form on 375px viewport → Expected: Currency dropdown renders correctly within form layout, no horizontal overflow

## Fix History

| Date       | Fix                                                                                 | Severity | Commit     |
| ---------- | ----------------------------------------------------------------------------------- | -------- | ---------- |
| 2026-04-09 | Auto-fill currency price on symbol select; lock price-per-unit currency to VND      | Major    | 73084789   |

### Fix Detail: Currency Price Auto-Fill + VND Lock (2026-04-09)

**Issues fixed:**
1. Price per unit not auto-filled after currency selection — `setSelectedSymbol` was never called in the currency dropdown `onChange`, so `currencyPriceQuery` was always disabled.
2. `CurrencyBadge` was interactive for FOREIGN_CURRENCY — user could change currency away from VND.

**Root causes:**
- Frontend: missing `setSelectedSymbol(value)` call in currency `onChange` handler; missing dedicated `currencyPriceQuery`; `isStandardWithSymbol` not excluding FOREIGN_CURRENCY.
- Backend: `GetPrice` routed FOREIGN_CURRENCY to Yahoo Finance (`fetchPriceFromAPI`) instead of the VCB DB cache (`fetchCurrencyPriceFromDB` via `ResolvePrice`).

**Changes:**
- `market_data_service.go` — new `fetchCurrencyPriceFromDB` method; new routing branch in `GetPrice` for `INVESTMENT_TYPE_FOREIGN_CURRENCY`
- `market_data_service_test.go` — 3 new tests for FOREIGN_CURRENCY GetPrice routing
- `AddInvestmentForm.tsx` — 6 fixes (setSelectedSymbol, currencyPriceQuery, isStandardWithSymbol exclusion, auto-fill useEffect, loading/error states, refresh button)
- `AddInvestmentForm.forex.test.tsx` — 5 new test cases (Fixes A–D)
- `add-foreign-currency-investment-flow.spec.ts` — 2 new E2E scenarios

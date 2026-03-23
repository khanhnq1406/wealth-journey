# Investment Currency Lock — Implementation Report

## Summary

Implemented currency lock for the Add Investment form and backend validation to prevent currency mismatch on duplicate symbol detection. Frontend locks the CurrencyBadge when a symbol is selected via autocomplete; backend rejects duplicate symbols with mismatched currencies.

## Spec Reference

`docs/specs/2026-03-23-investment-currency-lock-spec.md`

## Plan Reference

`docs/plans/2026-03-23-investment-currency-lock-plan.md`

## Tasks Completed

| #   | Task | Status | Files Changed | Tests    | TDD |
| --- | ---- | ------ | ------------- | -------- | --- |
| 0   | Backend currency mismatch validation | Done | `investment_service.go`, `investment_service_test.go` | 2/2 pass | Yes |
| 1   | Frontend currency lock | Done | `AddInvestmentForm.tsx` | N/A (UI change) | N/A |
| 2   | i18n keys | Skipped | — | — | — |
| 3   | Flow diagram update | Done | `flow-investment.md` | N/A (docs) | N/A |

## Test Coverage Summary

| Layer              | Test File     | Tests | Pass | Coverage Area               |
| ------------------ | ------------- | ----- | ---- | --------------------------- |
| Backend Service    | `investment_service_test.go` | 2     | 2/2  | Currency mismatch rejection, same-currency regression |

## Security Implementation Summary

| Concern          | Implementation                        | Verified |
| ---------------- | ------------------------------------- | -------- |
| Input validation | Server-side currency mismatch check in `CreateInvestment` | Yes |
| Authorization    | Existing `GetByUserAndSymbol` scoped by userID | Yes |
| Frontend lock bypass | Backend rejects mismatch regardless of frontend state | Yes |
| Error message safety | Shows user's own data only (symbol + currency) | Yes |

## Review Results

### Spec Compliance

All 9 acceptance criteria verified against actual code. PASS.

### Security Review

APPROVED. Server-side validation is authoritative. Frontend lock is UX convenience only. No new injection vectors, no data exposure to other users.

### Code Quality

APPROVED. Minimal changes (136 insertions, 1 deletion across 3 files). Follows existing patterns. No over-engineering.

## Known Issues / Technical Debt

None introduced. Existing race condition on duplicate check (two concurrent requests) is a pre-existing concern documented in the spec.

## Files Changed

- `src/go-backend/domain/service/investment_service.go` — +7 lines (currency check in duplicate block)
- `src/go-backend/domain/service/investment_service_test.go` — +126 lines (2 test functions)
- `src/wj-client/features/investment/forms/AddInvestmentForm.tsx` — +6/-1 lines (isSymbolSelected state + CurrencyBadge disabled)
- `docs/architecture/flow-investment.md` — Updated Create Investment flow with currency validation node

## How to Test

### Unit & Integration Tests

```bash
cd src/go-backend && go test -run "TestCreateInvestment_DuplicateSymbol_Currency" ./domain/service/... -v
```

### Dependency Impact Verification (GitNexus)

GitNexus not available — manual blast radius review performed.

### Manual Testing Steps

1. Open Add Investment form
2. Search for a symbol (e.g., "AAPL") via autocomplete
3. Verify currency badge shows "USD" and is disabled (cannot click)
4. Clear the symbol field — verify currency badge becomes clickable again
5. Toggle "Custom Investment" on — verify currency dropdown appears and is editable
6. Toggle "Custom Investment" off — verify currency badge reappears
7. Select gold type — verify currency still locks to VND/USD (no regression)
8. API test: Send POST /api/v1/investments with a duplicate symbol but different currency — expect 400 error

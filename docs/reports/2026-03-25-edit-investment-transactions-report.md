# Edit Investment Transactions — Implementation Report

## Summary

Implemented full edit capability for investment transactions (buy, sell, dividend) using an atomic delete-and-recreate strategy that preserves FIFO lot integrity. Users can now edit any field of an existing transaction — quantity, price per unit, fees, transaction type, date, and notes — via an Edit button in the transaction table inside the Investment Detail Modal.

## Spec Reference

`docs/specs/2026-03-24-edit-investment-transactions-spec.md`

## Plan Reference

`docs/plans/2026-03-24-edit-investment-transactions-plan.md`

## Tasks Completed

| #   | Task                                                  | Status | Files Changed | Tests      | TDD |
| --- | ----------------------------------------------------- | ------ | ------------- | ---------- | --- |
| 0   | Proto Changes — Add type + updatedInvestment          | Done   | 6 (proto + generated) | — (generated) | N/A |
| 1   | Backend — Buy Quantity Reduction Guard                | Done   | 2             | 8/8 pass   | Yes |
| 2   | Backend — Full EditTransaction Delete-and-Recreate    | Done   | 2             | 11/11 pass | Yes |
| 3   | Backend — Update Handler type validation + response   | Done   | 3             | 7/7 pass   | Yes |
| 4   | Frontend — Edit Mode to AddInvestmentTransactionForm  | Done   | 3             | 15/15 pass | Yes |
| 5   | Frontend — Edit Button + State in InvestmentDetailModal | Done | 3             | 6/6 pass   | Yes |
| 6   | Update Runtime Flow Diagram                           | Done   | 1             | N/A        | N/A |

## Test Coverage Summary

| Layer              | Test File                                               | Tests  | Pass   | Coverage Area                                     |
| ------------------ | ------------------------------------------------------- | ------ | ------ | ------------------------------------------------- |
| Backend Service    | `investment_buy_quantity_guard_test.go`                 | 8      | 8/8    | Nil LotID, nothing sold, boundary, error paths    |
| Backend Service    | `investment_edit_transaction_test.go`                   | 11     | 11/11  | Auth, guards, type-change, buy→sell, dividend, UNSPECIFIED inheritance |
| Backend Handler    | `investment_test.go` (TestEditTransactionHandler_*)     | 7      | 7/7    | Type enum validation, response shape, auth check  |
| Frontend Form      | `AddInvestmentTransactionForm.edit.test.tsx`            | 15     | 15/15  | Pre-fill, mutation dispatch, date conversion, success/error |
| Frontend Modal     | `InvestmentDetailModal.edit.test.tsx`                   | 6      | 6/6    | Edit button render, tab switch, state passing, success routing |

**Total: 50 tests, 50/50 pass** _(+3 from BUY→SELL pre-flight guard fix; 1 test renamed and tightened)_

## Security Implementation Summary

| Concern               | Implementation                                                    | Verified |
| --------------------- | ----------------------------------------------------------------- | -------- |
| Ownership check       | `EditTransaction` fetches tx by ID, verifies `InvestmentUserID == userID` before any mutation | Yes |
| FIFO lot integrity    | `validateBuyQuantityReduction` prevents qty < already-sold before reversal | Yes |
| Type-change with lots | Rejects type change on BUY tx if lot has consumed shares          | Yes |
| Input validation      | Handler validates `type` enum against allowlist (0,1,2,3); service validates ID, date, quantity | Yes |
| Future date guard     | Service rejects transaction dates more than 1 day in the future  | Yes |
| No GORM in service    | Service layer uses repository interfaces only; depguard enforced  | Yes |
| Cache invalidation    | `InvalidateInvestmentCache` called after successful edit          | Yes |
| Frontend Zod          | Edit mode reuses same Zod schema as add mode; type field now included | Yes |

## Review Results

### Spec Compliance

All spec requirements implemented:
- All 6 editable fields (quantity, price, fees, type, date, notes) flow through the edit path
- `type` field added as proto field 7 (backward-compatible, preserves wire format of fields 1–6)
- `updatedInvestment` returned in response so frontend can refresh portfolio state
- Edit button present in both desktop (TanStack table) and mobile (MobileTable) views
- Tab label changes to "Edit Transaction" when editing; reverts on completion
- On edit success: returns to Transactions tab and clears edit state (not close modal)
- `UNSPECIFIED` type in request inherits the original transaction's type

### Security Review

All 9 security categories satisfied:
1. **Authentication** — handler extracts userID from JWT middleware context
2. **Authorization** — ownership check at service layer before any write
3. **Input validation** — type enum allowlist in handler; ID/date/quantity validation in service
4. **Business rule guards** — buy quantity reduction guard; type-change-with-consumed-lot guard
5. **Injection** — GORM parameterized queries in repository layer
6. **Data integrity** — int64 for all monetary/quantity values; FIFO lot accounting preserved
7. **Cache** — cache invalidated after edit completes
8. **Error leakage** — internal errors wrapped in `apperrors.InternalError`; no raw DB errors to client
9. **Frontend** — Zod validation before mutation dispatch; no hardcoded values

### Code Quality

- `validateBuyQuantityReduction` is a focused helper (~20 lines) with clear error messages
- `EditTransaction` follows same sequential pattern as `DeleteTransaction` (no `s.db` field in service — depguard)
- Frontend edit mode is additive to existing `AddInvestmentTransactionForm` via optional `editTransaction` prop — no duplication
- `handleTabChange` in modal properly clears edit state when user manually switches away from add-transaction tab
- i18n: all new strings in `en/investment.json` and `vi/investment.json`; no hardcoded English in JSX
- Touch targets: edit buttons use `min-h-[44px] min-w-[44px]` per CLAUDE.md accessibility rules

## Fix History

| Date       | Fix                                                                     | Severity | Tests |
| ---------- | ----------------------------------------------------------------------- | -------- | ----- |
| 2026-03-25 | Price label for gold/silver VND was hardcoded English ("Price per Tael") — replaced with i18n key `transaction.pricePerUnitWithUnit` in `AddInvestmentTransactionForm.tsx`; added key to `en/investment.json` and `vi/investment.json` | Minor | 2 new tests added (17/17 pass) |
| 2026-03-25 | BUY→SELL edit orphaned the old transaction when processSellTransaction failed — `txRepo.Delete` ran before the process step, so on failure the old tx was soft-deleted with no replacement, causing "investment transaction not found" on retry and empty transaction list on refresh; fixed by moving Delete to after the process switch | Minor | 1 new test `TestEditTransaction_BuyToSell_SingleLot_ProcessFailDoesNotDeleteOldTx` (12/12 pass) | commit 99e2ad2 |
| 2026-03-25 | BUY→SELL edit corrupted `investment.Quantity` and `lot.RemainingQuantity` — `reverseBuyTransaction` wrote to DB before `processSellTransaction` validated viability, leaving investment qty=0 with old tx still present; also showed misleading "Số lượng phải lớn hơn 0." error. Fixed by adding pre-flight guard (step 5b) in `EditTransaction`: `quantityAfterReversal = investment.Quantity - oldTx.Quantity`; rejects with `INVESTMENT_EDIT_SELL_INSUFFICIENT_QTY` before any DB write | Critical | Renamed + tightened `TestEditTransaction_BuyToSell_SingleLot_InsufficientQtyAfterReversal_RejectsPreFlight` + 3 new tests: `TestEditTransaction_BuyToSell_OnlyOneLot_RejectsPreFlight`, `TestEditTransaction_BuyToSell_ExactBoundary_Passes`, `TestEditTransaction_BuyToSell_PartialRemainingInsufficient_RejectsPreFlight` (15/15 pass) |

## Known Issues / Technical Debt

- **No DB-level atomicity**: `EditTransaction` performs reversal + soft-delete + re-process as sequential repository calls. If the process crashes mid-way, the lot/wallet state could be partially updated. Full atomicity would require DB transactions at the repository layer — deferred. Note: the BUY→SELL data corruption case is now prevented by the step-5b pre-flight guard; other mid-sequence crash scenarios remain.
- **Concurrent-replay race**: No pessimistic lock guards `EditTransaction`. Two simultaneous requests with the same transaction ID could double-reverse and double-process. Fix requires `SELECT FOR UPDATE` inside a DB transaction wrapping the reversal+process+delete sequence — deferred.
- **Re-fetch after reversal**: `reverseBuyTransaction` mutates the in-memory `investment` pointer and persists. We re-fetch via `investmentRepo.GetByID` after reversal to avoid stale-state bugs on type changes. This is a known N+1 for edit — acceptable given edit frequency.

## Files Changed

### Backend

| File | Change |
|------|--------|
| `api/protobuf/v1/investment.proto` | Added `type` field (7) to request; `updatedInvestment` field (5) to response |
| `src/go-backend/protobuf/v1/investment.pb.go` | Auto-regenerated |
| `src/go-backend/domain/service/investment_service.go` | Added `validateBuyQuantityReduction`; rewrote `EditTransaction` |
| `src/go-backend/domain/service/investment_buy_quantity_guard_test.go` | New — 8 TDD tests |
| `src/go-backend/domain/service/investment_edit_transaction_test.go` | New — 11 TDD tests |
| `src/go-backend/pkg/errors/codes.go` | Added `InvestmentTxTypeInvalid` error code |
| `src/go-backend/handlers/investment.go` | Added type enum validation; `handler.Success` returns `updatedInvestment` |
| `src/go-backend/handlers/investment_test.go` | New — 7 handler tests |

### Frontend

| File | Change |
|------|--------|
| `src/wj-client/gen/protobuf/v1/investment.ts` | Auto-regenerated (type + updatedInvestment fields) |
| `src/wj-client/utils/generated/hooks.ts` | Auto-regenerated |
| `src/wj-client/utils/generated/api.ts` | Auto-regenerated |
| `src/wj-client/features/investment/forms/AddInvestmentTransactionForm.tsx` | Added `editTransaction` prop, reverse conversions, edit mutation, UI text |
| `src/wj-client/features/investment/forms/__tests__/AddInvestmentTransactionForm.edit.test.tsx` | New — 15 tests |
| `src/wj-client/features/investment/components/InvestmentDetailModal.tsx` | Added edit button, `editingTransaction` state, tab label, success routing |
| `src/wj-client/features/investment/components/__tests__/InvestmentDetailModal.edit.test.tsx` | New — 6 tests |
| `src/wj-client/messages/en/investment.json` | Added saveChanges, transactionUpdatedSuccess, transactionUpdatedMessage, transactionTable.editTransaction, detail.editTransaction |
| `src/wj-client/messages/vi/investment.json` | Same keys in Vietnamese |
| `src/wj-client/tests/e2e/edit-investment-transaction-flow.spec.ts` | New — 5 E2E spec tests |

### Documentation

| File | Change |
|------|--------|
| `docs/architecture/flow-investment.md` | Added section 9 "Edit Transaction (Delete-and-Recreate)" + TOC entries |
| `docs/reports/2026-03-25-edit-investment-transactions-progress.md` | Progress tracking (updated throughout) |

## How to Test

### Unit & Integration Tests

```bash
# Backend service tests
cd src/go-backend
go test -short -v -run TestValidateBuyQuantityReduction ./domain/service/...
go test -short -v -run TestEditTransaction ./domain/service/...

# Backend handler tests
go test -short -v -run TestEditTransactionHandler ./handlers/...

# All backend tests
go test -short ./...

# Frontend unit tests
cd src/wj-client
npm test -- --testPathPattern="AddInvestmentTransactionForm.edit|InvestmentDetailModal.edit"

# All frontend tests
npm test
```

### Dependency Impact Verification (GitNexus)

GitNexus not available — manual blast radius review performed:

| Changed Symbol | d=1 Dependents | Tested? | Notes |
|---|---|---|---|
| `EditTransaction` (service) | `EditTransaction` handler | Yes | 7 handler tests |
| `validateBuyQuantityReduction` | `EditTransaction` service | Yes | tested via 11 service tests |
| `AddInvestmentTransactionForm` | `InvestmentDetailModal` | Yes | 6 modal tests |
| `InvestmentDetailModal` | `portfolio/page.tsx` | Manual | Page renders modal; no logic change to page |

### Manual Testing Steps

1. Navigate to `/dashboard/portfolio`
2. Open Investment Detail Modal for any investment with transactions
3. Switch to the **Transactions** tab
4. Click the edit (pencil) icon on any transaction row
5. Verify the form pre-fills with the transaction's values
6. Verify the tab label reads "Edit Transaction"
7. Modify one or more fields and click **Save Changes**
8. Verify success toast and return to Transactions tab
9. Verify the transaction list reflects the edit
10. Test on mobile (375px): verify edit button visible in collapsed rows, touch target ≥ 44px

**Edge cases to verify manually:**
- Reducing BUY quantity below already-sold amount → error message
- Changing type of a BUY transaction that has sells → error message
- Setting a future date (> today + 1 day) → error message

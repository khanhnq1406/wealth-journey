# Auto-Add Transaction for Existing Investments — Report

## Summary

When a user submits the Add Investment form with a symbol that already exists in their wallet, the backend now automatically adds a BUY transaction to the existing investment instead of returning a conflict error. The user sees a success message and their holding is updated with the new quantity, cost, and FIFO lot.

## Spec Reference

`docs/specs/2026-03-16-auto-add-transaction-spec.md`

## Plan Reference

`docs/plans/2026-03-16-auto-add-transaction-plan.md`

## Changes

### Backend — `investment_service.go` (already committed in `e679e00`)

**Before:** `CreateInvestment` returned `409 ConflictError` when `GetByWalletAndSymbol` found an existing investment.

**After:** The duplicate check branch now:

1. Computes `perUnitPrice` via `units.CalculateAverageCost(initialCost, initialQuantity, req.Type)`
2. Resolves `txTimestamp` from `req.PurchaseDate` or `time.Now().Unix()`
3. Constructs an `AddTransactionRequest` with `InvestmentId = existing.ID`, `Type = BUY`, converted quantity/price, and notes "Additional purchase"
4. Delegates to `s.AddTransaction(ctx, userID, addReq)` — reuses the full BUY flow including FIFO lot creation/merging, average cost recalculation, and quantity update
5. Returns `CreateInvestmentResponse` with `Message: "Transaction added to existing investment"` and the updated investment data

**Key design decisions:**
- **No proto changes** — `CreateInvestmentResponse` already has the needed fields
- **No frontend changes** — the form's `onSuccess` handler fires on any 2xx response; the Success component displays regardless of which message the backend returns
- **Reuses existing `AddTransaction`** — no duplicate business logic; FIFO lots, same-day merging, cache invalidation all handled by the existing method

### Frontend — i18n (uncommitted)

| File | Key | EN | VI |
|------|-----|----|----|
| `messages/en/investment.json` | `errors.addedToExisting` | Purchase added to your existing holding | — |
| `messages/vi/investment.json` | `errors.addedToExisting` | — | Đã thêm giao dịch mua vào khoản đầu tư hiện có |

## Security

| Concern | Status |
|---------|--------|
| Authorization | No change — wallet ownership validated via `GetByIDForUser` before the duplicate check |
| Input validation | No change — all validation (quantity, cost, currency, purchase date) runs before the duplicate branch |
| Financial integrity | Delegated to existing `AddTransaction` BUY flow which handles FIFO lots, average cost, and quantity atomically |
| Data exposure | No additional data exposed — response contains the same Investment proto as before |

## Data Flow

```
User submits Add Investment form (symbol "AAPL", 10 shares, $150/share)
  → Frontend calls POST /api/v1/investments (CreateInvestmentRequest)
  → Backend: validate inputs, convert decimals, verify wallet ownership
  → Backend: GetByWalletAndSymbol("AAPL") → finds existing investment (ID=42)
  → Backend: construct AddTransactionRequest(investmentId=42, BUY, qty=10, price=$150)
  → Backend: AddTransaction → processBuyTransaction → create/merge lot, update investment
  → Backend: return CreateInvestmentResponse { success: true, message: "Transaction added..." }
  → Frontend: onSuccess fires → Success component shown → portfolio data refreshed
```

## How to Test

1. **New investment**: Add Investment → enter a symbol not in your portfolio → submit → creates new investment as before
2. **Duplicate symbol**: Add Investment → enter a symbol that already exists → submit → should succeed with "Transaction added to existing investment" message
3. **Verify quantity update**: After step 2, check the existing investment — quantity and total cost should be updated
4. **Verify FIFO lot**: In investment detail → Transactions tab, the new BUY transaction should appear with notes "Additional purchase"
5. **Purchase date**: Submit a duplicate with a past purchase date → verify the transaction uses that date, not today
6. **Gold/Silver**: Add Investment → select a gold type already in portfolio → submit → should add transaction to existing gold holding

## Files Changed

| File | Change | Status |
|------|--------|--------|
| `src/go-backend/domain/service/investment_service.go` | Replace ConflictError with AddTransaction delegation | Committed (`e679e00`) |
| `src/wj-client/messages/en/investment.json` | Add `addedToExisting` i18n key | Uncommitted |
| `src/wj-client/messages/vi/investment.json` | Add `addedToExisting` i18n key | Uncommitted |
| `docs/specs/2026-03-16-auto-add-transaction-spec.md` | Feature specification | Uncommitted |
| `docs/plans/2026-03-16-auto-add-transaction-plan.md` | Implementation plan | Uncommitted |
| `docs/reports/2026-03-16-auto-add-transaction-report.md` | This report | Uncommitted |

## Known Issues / Technical Debt

- The `errors.duplicateSymbol` i18n key is now unreachable from the Add Investment flow (the backend no longer returns that error). Kept for backwards compatibility in case other code paths reference it.
- The frontend error handler in `AddInvestmentForm.tsx` still has duplicate-detection logic (lines 170-173) that will never trigger. Can be cleaned up in a future refactor.

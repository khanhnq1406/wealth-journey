# Auto-Add Transaction for Existing Investments — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** When a user submits Add Investment with an existing symbol, auto-add as a BUY transaction instead of returning a conflict error.
**Spec:** `docs/specs/2026-03-16-auto-add-transaction-spec.md`
**Architecture:** Backend-only change in `investment_service.go`. Replace the ConflictError branch with a call to the existing `AddTransaction` method. Add i18n keys for the new success message. Update flow diagram.

## Security Implementation Notes

- Authentication: No change — JWT middleware already validates user
- Authorization: No change — `GetByIDForUser` on wallet already runs before duplicate check
- Input validation: No change — all validation runs before the duplicate check
- Data integrity: `AddTransaction` BUY flow handles FIFO lots, average cost recalculation

---

### Task 1: Modify CreateInvestment to auto-add transaction on duplicate

**Files:**
- Modify: `src/go-backend/domain/service/investment_service.go` (lines 162-166)

**Security notes:** The existing investment is fetched via `GetByWalletAndSymbol` which scopes to the already-validated wallet. No additional auth check needed.

**Steps:**

1. In `CreateInvestment`, replace the ConflictError block (lines 162-166) with logic that:
   - Uses the already-fetched `existing` investment
   - Constructs an `AddTransactionRequest` from the CreateInvestment fields
   - Calls `s.AddTransaction(ctx, userID, addReq)`
   - Returns a `CreateInvestmentResponse` with the updated investment and a different message

2. The field mapping:
   ```go
   addReq := &v1.AddTransactionRequest{
       InvestmentId:    existing.ID,
       Type:            v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_BUY,
       Quantity:        initialQuantity,       // already converted above
       Price:           averageCost,           // per-unit price already calculated
       Fees:            0,
       TransactionDate: purchaseDate,          // Unix timestamp or time.Now()
       Notes:           "Additional purchase",
   }
   ```

3. Handle the `purchaseDate` computation — move the `txDate` calculation (currently at line 214) before the duplicate check, or compute the Unix timestamp for the AddTransactionRequest.

4. Return success with different message: `"Transaction added to existing investment"`

**Commit:** `fix(investment): auto-add transaction when symbol already exists in wallet`

---

### Task 2: Add i18n key for "added to existing" success message

**Files:**
- Modify: `src/wj-client/messages/en/investment.json`
- Modify: `src/wj-client/messages/vi/investment.json`

**Steps:**

1. Add key under `errors` (matching existing pattern):
   - EN: `"addedToExisting": "Purchase added to your existing holding"`
   - VI: `"addedToExisting": "Đã thêm giao dịch mua vào khoản đầu tư hiện có"`

2. Update the frontend error handler in `AddInvestmentForm.tsx` to detect "added to existing" or "Transaction added" in the response and show success instead of error. Actually — since the backend now returns success (not error), the `onSuccess` handler fires, not `onError`. The frontend shows the Success component. No frontend code change needed for the happy path.

**Commit:** `feat(i18n): add success message for auto-add transaction`

---

### Task 3: Update flow diagram

**Files:**
- Modify: `docs/architecture/flow-investment.md`

**Steps:**

1. Update the "Create Investment" sequence diagram to show the branching:
   - If symbol exists → construct AddTransactionRequest → call AddTransaction → return success
   - If symbol doesn't exist → create new investment (existing flow)

**Commit:** `docs(architecture): update create investment flow with auto-add branch`

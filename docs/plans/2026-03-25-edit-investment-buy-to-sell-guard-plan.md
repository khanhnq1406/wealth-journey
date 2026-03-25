# Fix: BUY→SELL Edit Pre-Flight Guard — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Add a pre-flight viability check to `EditTransaction` that fires before any DB mutation when the user changes a BUY to a SELL — preventing data corruption and returning a clear error message.

**Spec:** `docs/specs/2026-03-25-edit-investment-buy-to-sell-guard-spec.md`

**Architecture:** No new components. The fix is a single guard block inserted into `EditTransaction` in `investment_service.go`, a new error code in `pkg/errors/codes.go`, and i18n keys in both locale files. Pure pre-computation — uses already-loaded `investment.Quantity` and `oldTx.Quantity`.

**Tech Stack:** Go 1.25 (backend service + tests), JSON (i18n)

## Security Implementation Notes

- **Authorization:** Unchanged — `GetByIDForUser` (JOIN-based ownership check) runs at step 2, before any guard.
- **Input validation:** The new guard uses server-side values only (`investment.Quantity`, `oldTx.Quantity`). `req.Quantity` is user-supplied but already validated positive by the handler.
- **Error leakage:** The error message includes `remaining` and `requested` quantities. Both are already visible to the user in the UI (they own the investment). No internal DB details leaked.
- **No new endpoints or proto changes** — surface area unchanged.

## Component Reuse Inventory

Backend-only fix. No frontend components involved.

## C4 Architecture Diagram Updates

No C4 diagram changes — no new services, handlers, or repositories.

---

## Task 1: Add `InvestmentEditSellInsufficientQty` Error Code

**Files:**
- Modify: `src/go-backend/pkg/errors/codes.go`

**Security notes:** Error code is a string constant — no security implications.

**Step 1: Write the failing test**

No test for this task — error code constants are verified by compilation and by usage in Task 2's tests. Proceed directly to implementation.

**Step 2: Add the field to the `ErrorCodes` struct and assign the value**

In `src/go-backend/pkg/errors/codes.go`, find the `InvestmentTxTypeInvalid` field (added in the original feature) and add the new field immediately after it:

```go
// In struct definition — after InvestmentTxTypeInvalid:
InvestmentEditSellInsufficientQty string

// In the Codes assignment — after InvestmentTxTypeInvalid:
InvestmentEditSellInsufficientQty: "INVESTMENT_EDIT_SELL_INSUFFICIENT_QTY",
```

**Step 3: Verify compilation**

```bash
cd src/go-backend && go build ./...
```

Expected: no errors.

**Step 4: Commit**

```
fix(investment): add INVESTMENT_EDIT_SELL_INSUFFICIENT_QTY error code
```

---

## Task 2: Pre-Flight Guard in `EditTransaction` (TDD)

**Files:**
- Modify: `src/go-backend/domain/service/investment_service.go` (insert guard at step 5, ~line 1044)
- Modify: `src/go-backend/domain/service/investment_edit_transaction_test.go` (update 1 test + add 3 new tests)

**Security notes:** Guard uses server-side data only. Fires before any mutation. Returns `ValidationError` — no internal state leakage beyond qty numbers the user already sees.

**Step 1: Write the failing tests FIRST**

Add to `investment_edit_transaction_test.go`:

```go
// --------------------------------------------------------------------------
// TestEditTransaction_BuyToSell_InsufficientQtyAfterReversal (3 sub-cases)
// --------------------------------------------------------------------------

// TestEditTransaction_BuyToSell_OnlyOneLot_RejectsPreFlight verifies that
// when the investment has only one BUY transaction (qty=10000) and the user
// tries to change it to SELL qty=5000, the pre-flight guard fires before any
// DB mutation: investment.Quantity(10000) - oldTx.Quantity(10000) = 0 < 5000.
// No UpdateLot, no Update(investment), no Delete, no Create should be called.
func TestEditTransaction_BuyToSell_OnlyOneLot_RejectsPreFlight(t *testing.T) {
	d := newEditTestService(t)
	ctx := context.Background()

	lotID := int32(10)
	oldTx := &models.InvestmentTransaction{
		ID:           1,
		InvestmentID: 5,
		UserID:       1,
		Type:         int32(v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_BUY),
		Quantity:     10000,
		Price:        15000000,
		Cost:         150000000,
		LotID:        &lotID,
	}
	investment := createTestInvestment(5, 1, "AAPL", 10000, 15000000, 150000000)

	lot := &models.InvestmentLot{
		ID:                lotID,
		InvestmentID:      5,
		Quantity:          10000,
		RemainingQuantity: 10000, // nothing sold — passes existing alreadySold guard
		TotalCost:         150000000,
		AverageCost:       15000000,
	}

	d.txRepo.On("GetByIDForUser", ctx, int32(1), int32(1)).Return(oldTx, nil)
	d.invRepo.On("GetByID", ctx, int32(5)).Return(investment, nil)
	d.txRepo.On("GetLotByID", ctx, lotID).Return(lot, nil)
	// NOTE: No UpdateLot, Update, Delete, or Create mocks — none should be called

	_, err := d.svc.EditTransaction(ctx, 1, 1, &v1.EditInvestmentTransactionRequest{
		Type:            v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_SELL,
		Quantity:        5000,
		Price:           18000000,
		TransactionDate: pastDate(),
	})

	assert.Error(t, err)
	var ve apperrors.ValidationError
	assert.True(t, errors.As(err, &ve), "expected ValidationError, got %T: %v", err, err)
	assert.Contains(t, err.Error(), "INVESTMENT_EDIT_SELL_INSUFFICIENT_QTY")
	// Critical: no DB mutations
	d.txRepo.AssertNotCalled(t, "UpdateLot")
	d.invRepo.AssertNotCalled(t, "Update")
	d.txRepo.AssertNotCalled(t, "Delete")
	d.txRepo.AssertNotCalled(t, "Create")
	d.txRepo.AssertExpectations(t)
	d.invRepo.AssertExpectations(t)
}

// TestEditTransaction_BuyToSell_ExactBoundary_Passes verifies that when
// quantityAfterReversal == req.Quantity (exact match), the guard passes.
// Scenario: investment.Quantity=20000, oldTx.Quantity=10000 → after reversal=10000.
// req.Quantity=10000 → 10000 >= 10000 → allowed.
func TestEditTransaction_BuyToSell_ExactBoundary_Passes(t *testing.T) {
	d := newEditTestService(t)
	ctx := context.Background()

	lotID := int32(10)
	oldTx := &models.InvestmentTransaction{
		ID:           1,
		InvestmentID: 5,
		UserID:       1,
		Type:         int32(v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_BUY),
		Quantity:     10000,
		Price:        15000000,
		Cost:         150000000,
		LotID:        &lotID,
	}
	investment := createTestInvestment(5, 1, "AAPL", 20000, 15000000, 300000000)

	lot := &models.InvestmentLot{
		ID:                lotID,
		InvestmentID:      5,
		Quantity:          10000,
		RemainingQuantity: 10000,
		TotalCost:         150000000,
		AverageCost:       15000000,
	}
	freshInvestment := createTestInvestment(5, 1, "AAPL", 10000, 15000000, 150000000)
	newTxID := int32(2)
	newSellTx := &models.InvestmentTransaction{
		ID: newTxID, InvestmentID: 5, Type: int32(v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_SELL),
		Quantity: 10000,
	}
	openLot := &models.InvestmentLot{
		ID: 13, InvestmentID: 5, Quantity: 10000, RemainingQuantity: 10000, AverageCost: 15000000,
	}

	d.txRepo.On("GetByIDForUser", ctx, int32(1), int32(1)).Return(oldTx, nil)
	d.invRepo.On("GetByID", ctx, int32(5)).Return(investment, nil).Once()
	d.txRepo.On("GetLotByID", ctx, lotID).Return(lot, nil)
	d.txRepo.On("UpdateLot", ctx, mock.AnythingOfType("*models.InvestmentLot")).Return(nil)
	d.invRepo.On("Update", ctx, mock.AnythingOfType("*models.Investment")).Return(nil)
	d.txRepo.On("Delete", ctx, int32(1)).Return(nil)
	d.invRepo.On("GetByID", ctx, int32(5)).Return(freshInvestment, nil).Once()
	d.txRepo.On("GetOpenLots", ctx, int32(5)).Return([]*models.InvestmentLot{openLot}, nil)
	d.txRepo.On("Create", ctx, mock.AnythingOfType("*models.InvestmentTransaction")).Return(nil).Run(
		func(args mock.Arguments) { args.Get(1).(*models.InvestmentTransaction).ID = newTxID },
	)
	d.txRepo.On("ListByInvestmentID", ctx, int32(5), (*v1.InvestmentTransactionType)(nil), repository.ListOptions{
		Limit: 1, OrderBy: "created_at", Order: "desc",
	}).Return([]*models.InvestmentTransaction{newSellTx}, 1, nil)
	d.setupEnrichMocks(ctx, 1)

	resp, err := d.svc.EditTransaction(ctx, 1, 1, &v1.EditInvestmentTransactionRequest{
		Type:            v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_SELL,
		Quantity:        10000, // exact match — should pass
		Price:           18000000,
		TransactionDate: pastDate(),
	})

	assert.NoError(t, err)
	assert.NotNil(t, resp)
	assert.True(t, resp.Success)
	d.txRepo.AssertExpectations(t)
	d.invRepo.AssertExpectations(t)
}

// TestEditTransaction_BuyToSell_PartialRemainingInsufficient_RejectsPreFlight
// verifies guard fires when: investment.Quantity=13000, oldTx.Quantity=10000
// → after reversal=3000 < req.Quantity=5000.
func TestEditTransaction_BuyToSell_PartialRemainingInsufficient_RejectsPreFlight(t *testing.T) {
	d := newEditTestService(t)
	ctx := context.Background()

	lotID := int32(10)
	oldTx := &models.InvestmentTransaction{
		ID:           1,
		InvestmentID: 5,
		UserID:       1,
		Type:         int32(v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_BUY),
		Quantity:     10000,
		Price:        15000000,
		Cost:         150000000,
		LotID:        &lotID,
	}
	investment := createTestInvestment(5, 1, "AAPL", 13000, 15000000, 195000000)

	lot := &models.InvestmentLot{
		ID:                lotID,
		Quantity:          10000,
		RemainingQuantity: 10000, // nothing sold from this lot
	}

	d.txRepo.On("GetByIDForUser", ctx, int32(1), int32(1)).Return(oldTx, nil)
	d.invRepo.On("GetByID", ctx, int32(5)).Return(investment, nil)
	d.txRepo.On("GetLotByID", ctx, lotID).Return(lot, nil)

	_, err := d.svc.EditTransaction(ctx, 1, 1, &v1.EditInvestmentTransactionRequest{
		Type:            v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_SELL,
		Quantity:        5000, // 13000 - 10000 = 3000 remaining < 5000 requested
		Price:           18000000,
		TransactionDate: pastDate(),
	})

	assert.Error(t, err)
	var ve apperrors.ValidationError
	assert.True(t, errors.As(err, &ve))
	assert.Contains(t, err.Error(), "INVESTMENT_EDIT_SELL_INSUFFICIENT_QTY")
	d.txRepo.AssertNotCalled(t, "UpdateLot")
	d.invRepo.AssertNotCalled(t, "Update")
	d.txRepo.AssertNotCalled(t, "Delete")
	d.txRepo.AssertNotCalled(t, "Create")
	d.txRepo.AssertExpectations(t)
	d.invRepo.AssertExpectations(t)
}
```

Also **update** `TestEditTransaction_BuyToSell_SingleLot_ProcessFailDoesNotDeleteOldTx`:
- Rename to `TestEditTransaction_BuyToSell_SingleLot_InsufficientQtyAfterReversal_RejectsPreFlight`
- Remove `UpdateLot` and `Update(investment)` mock setup (guard fires before reversal now)
- Remove second `GetByID` (re-fetch after reversal) mock setup (never reached)
- Add assertions: `AssertNotCalled(t, "UpdateLot")` and `invRepo.AssertNotCalled(t, "Update")`

**Step 2: Run tests to verify they FAIL**

```bash
cd src/go-backend && go test -short -v -run "TestEditTransaction_BuyToSell_OnlyOneLot_RejectsPreFlight|TestEditTransaction_BuyToSell_ExactBoundary_Passes|TestEditTransaction_BuyToSell_PartialRemainingInsufficient_RejectsPreFlight|TestEditTransaction_BuyToSell_SingleLot_InsufficientQtyAfterReversal" ./domain/service/...
```

Expected: FAIL (guard not yet implemented).

**Step 3: Implement the guard in `investment_service.go`**

In `EditTransaction`, after the existing step 5 block (the `if oldType == BUY && oldTx.LotID != nil` block, currently ending around line 1044), add the new guard block as step 5b:

```go
// 5b. Pre-flight viability check for BUY→SELL type change.
// If the user is changing a BUY to a SELL, the reversal will remove
// oldTx.Quantity from investment.Quantity. The resulting quantity must be
// >= req.Quantity for the SELL to succeed. We check this BEFORE any DB
// mutation to prevent partial data corruption.
if oldType == v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_BUY &&
	newType == v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_SELL {
	quantityAfterReversal := investment.Quantity - oldTx.Quantity
	if quantityAfterReversal < req.Quantity {
		return nil, apperrors.NewValidationErrorWithCode(
			apperrors.Codes.InvestmentEditSellInsufficientQty,
			fmt.Sprintf("INVESTMENT_EDIT_SELL_INSUFFICIENT_QTY: chỉ còn %d đơn vị sau khi đảo ngược giao dịch mua, nhưng yêu cầu bán %d",
				quantityAfterReversal, req.Quantity),
		)
	}
}
```

Place this block immediately **after** the closing `}` of the existing step 5 block (after line ~1044) and **before** step 6 (date validation, ~line 1047).

**Step 4: Run tests to verify they PASS**

```bash
cd src/go-backend && go test -short -v -run "TestEditTransaction" ./domain/service/...
```

Expected: all `TestEditTransaction_*` pass.

**Step 5: Run full backend test suite to check for regressions**

```bash
cd src/go-backend && go test -short ./...
```

Expected: all pass.

**Step 6: Commit**

```
fix(investment): add pre-flight BUY→SELL guard to prevent data corruption in EditTransaction

When editing a BUY transaction to SELL, reverseBuyTransaction previously committed
investment.Quantity and lot.RemainingQuantity to DB before processSellTransaction
could check viability. If the sell failed (e.g. only one BUY exists), investment
quantity was left at 0 with the old transaction still present — corrupted state.

Added pre-flight check at step 5b: if investment.Quantity - oldTx.Quantity < req.Quantity
after reversal, return INVESTMENT_EDIT_SELL_INSUFFICIENT_QTY before any DB write.
```

---

## Task 3: i18n Error Messages

**Files:**
- Modify: `src/wj-client/messages/en/errors.json`
- Modify: `src/wj-client/messages/vi/errors.json`

**Security notes:** Static string constants — no security implications.

**Step 1: Add the new key to `en/errors.json`**

After the `INVESTMENT_NOT_FOUND` entry:

```json
"INVESTMENT_EDIT_SELL_INSUFFICIENT_QTY": "Cannot change to sell: not enough units remain after reversing the buy transaction.",
```

**Step 2: Add the new key to `vi/errors.json`**

After the `INVESTMENT_NOT_FOUND` entry:

```json
"INVESTMENT_EDIT_SELL_INSUFFICIENT_QTY": "Không thể đổi thành bán: không còn đủ đơn vị sau khi đảo ngược giao dịch mua.",
```

**Step 3: Verify frontend lint**

```bash
cd src/wj-client && npm run lint
```

Expected: no errors.

**Step 4: Commit**

```
fix(investment): add i18n error message for INVESTMENT_EDIT_SELL_INSUFFICIENT_QTY
```

---

## Task 4: Update Runtime Flow Diagram

**Files:**
- Modify: `docs/architecture/flow-investment.md` (Section 9: Edit Transaction)

**Step 1: Read current Section 9 to understand what needs updating**

```bash
Read: docs/architecture/flow-investment.md (find Section 9)
```

**Step 2: Insert the new pre-flight guard step into the sequence diagram**

After the existing "Type-change guard (alreadySold)" alt block, add a new alt block:

```
alt BUY→SELL type change
    Note over Service: Pre-flight: quantityAfterReversal = investment.Quantity - oldTx.Quantity
    alt quantityAfterReversal < req.Quantity
        Service-->>Handler: ValidationError INVESTMENT_EDIT_SELL_INSUFFICIENT_QTY
        Handler-->>Client: 400 Bad Request (no DB writes)
    end
end
```

**Step 3: Update the Error Paths table** in Section 9 to add the new error path.

**Step 4: Commit**

```
docs(investment): update flow diagram for pre-flight BUY→SELL guard
```

---

## Task 5: Append Fix History to Implementation Report

**Files:**
- Modify: `docs/reports/2026-03-25-edit-investment-transactions-report.md`

**Step 1: Append the fix entry to the Fix History table**

```markdown
| 2026-03-25 | BUY→SELL edit corrupted investment.Quantity (set to 0) and lot.RemainingQuantity when processSellTransaction failed after reverseBuyTransaction committed — fixed by adding pre-flight viability check (step 5b) in EditTransaction before any DB mutation; also adds clear INVESTMENT_EDIT_SELL_INSUFFICIENT_QTY error code replacing the misleading INVESTMENT_QUANTITY_POSITIVE | Critical | [commit hash] |
```

**Step 2: Update Known Issues** — Remove or mark the "No DB-level atomicity" note as partially addressed for the BUY→SELL case (the pre-flight guard prevents the specific corruption case, though full atomicity remains deferred).

**Step 3: Update test counts** — Total tests increases from 47 to 50 (3 new + 1 renamed/tightened).

---

## Task Execution Order

```
Task 1 (error code) → Task 2 (guard + tests) → Task 3 (i18n) → Task 4 (diagram) → Task 5 (report)
```

Tasks 3, 4, 5 can run in parallel after Task 2 is complete.

## Success Criteria

- [ ] `go test -short ./...` passes (all 50 tests)
- [ ] `npm run lint` passes
- [ ] `go build ./...` passes
- [ ] Existing `TestEditTransaction_BuyToSell_LotIntact_HappyPath` still passes (2-lot case unaffected)
- [ ] New guard fires before any `UpdateLot` or `Update(investment)` call
- [ ] Error code `INVESTMENT_EDIT_SELL_INSUFFICIENT_QTY` returned (not `INVESTMENT_QUANTITY_POSITIVE`)
- [ ] Fix history appended to report

# Edit Investment Transactions — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Enable full editing of investment transactions (quantity, price, fees, type, date, notes) using an atomic delete-and-recreate strategy that preserves FIFO lot integrity.

**Spec:** `docs/specs/2026-03-24-edit-investment-transactions-spec.md`

**Architecture:** The backend `EditTransaction` service method currently only edits notes. We upgrade it to perform an atomic reverse-old + create-new within a single DB transaction, reusing the battle-tested `reverseBuyTransaction`/`reverseSellTransaction`/`reverseDividendTransaction` and `processBuyTransaction`/`processSellTransaction`/`processDividendTransaction` methods. The frontend reuses `AddInvestmentTransactionForm` in edit mode (prop-driven, not a new component). Proto changes add `type` to the request and `updatedInvestment` to the response.

**Tech Stack:** Go 1.23 (Gin, GORM), PostgreSQL, Redis, Protocol Buffers, Next.js 15, React 19, TypeScript, React Query, React Hook Form, Zod

## Security Implementation Notes

- **Authentication:** JWT middleware on `PUT /api/v1/investment-transactions/{id}` (already registered)
- **Authorization:** `GetByIDForUser(txID, userID)` — JOIN-based ownership check (existing)
- **Input validation:** Server-side: quantity > 0, price > 0, fees >= 0, type ∈ {1,2,3}, date not in future, notes ≤ 500 chars. Buy qty reduction guard checks lot consumption before allowing edit.
- **Data sanitization:** All values are int64/int32/enum — no string injection vectors except `notes` (stored as plain text, no HTML rendering)
- **Atomicity:** All lot/investment mutations wrapped in `db.Transaction()` with rollback on any error
- **Audit trail:** Soft-deleted original transaction preserved in DB; new transaction gets fresh ID and timestamps

## Component Reuse Inventory (Frontend Tasks)

**Existing components to reuse:**

| Component | Location | Usage in This Feature |
|-----------|----------|-----------------------|
| AddInvestmentTransactionForm | `features/investment/forms/AddInvestmentTransactionForm.tsx` | Reuse in edit mode with `editTransaction` prop |
| InvestmentDetailModal | `features/investment/components/InvestmentDetailModal.tsx` | Add edit button to transaction rows, manage edit state |
| EditIcon | `components/icons/actions.tsx` | Edit button icon on transaction rows |
| Button | `components/Button.tsx` | Edit icon button (variant="ghost", iconOnly) |
| SuccessAnimation | `components/success/SuccessAnimation.tsx` | Success state after edit |
| FormNumberInput | `components/forms/FormNumberInput.tsx` | Quantity, price, fees inputs |
| FormSelect | `components/forms/FormSelect.tsx` | Transaction type dropdown |
| useMutationEditInvestmentTransaction | `utils/generated/hooks.ts` | Auto-generated mutation hook |
| addTransactionSchema | `features/investment/utils/investment-schema.ts` | Zod validation (same schema) |
| gold-calculator / silver-calculator | `lib/utils/gold-calculator.ts`, `lib/utils/silver-calculator.ts` | Unit conversions for pre-fill and submit |

**New components needed (with justification):**

| Component | Location | Justification |
|-----------|----------|---------------|
| None | — | All existing components are sufficient; edit mode is a prop flag on AddInvestmentTransactionForm |

## C4 Architecture Diagram Updates

No structural diagram changes needed per the spec:
- `c4-code-investment.md` — `EditTransaction` method already in interface; implementation changes only
- `c4-component-backend.md` — Handler and service already exist
- `c4-component-frontend.md` — Reusing existing form component with prop flag

## Runtime Flow Diagram Updates

Add "Edit Transaction (Delete-and-Recreate)" sequence diagram to `docs/architecture/flow-investment.md`.

---

### Task 0: Proto Changes — Add `type` to Request, Add `updatedInvestment` to Response

**Files:**

- Modify: `api/protobuf/v1/investment.proto` (lines ~593-607)
- Regenerate: `src/go-backend/protobuf/v1/`, `src/wj-client/gen/`, `src/wj-client/utils/generated/hooks.ts`

**Security notes:** Backward-compatible proto changes (adding fields only). The `type` field must be validated server-side as enum {1,2,3}.

**Step 1: Modify proto definitions**

In `investment.proto`, update `EditInvestmentTransactionRequest` to add `type` field:
```protobuf
message EditInvestmentTransactionRequest {
  int32 id = 1 [json_name = "id"];
  InvestmentTransactionType type = 2 [json_name = "type"];  // NEW — allow type change
  int64 quantity = 3 [json_name = "quantity"];               // RENUMBER from 2→3
  int64 price = 4 [json_name = "price"];                     // RENUMBER from 3→4
  int64 fees = 5 [json_name = "fees"];                       // RENUMBER from 4→5
  int64 transactionDate = 6 [json_name = "transactionDate"]; // RENUMBER from 5→6
  string notes = 7 [json_name = "notes"];                    // RENUMBER from 6→7
}
```

**IMPORTANT:** Since the existing proto field numbers are `quantity=2, price=3, fees=4, transactionDate=5, notes=6`, we CANNOT simply insert `type=2` and shift everything — that would break backward compatibility. Instead, add `type` as a NEW field number (e.g., field 7 or 8) to preserve wire format:

```protobuf
message EditInvestmentTransactionRequest {
  int32 id = 1 [json_name = "id"];
  int64 quantity = 2 [json_name = "quantity"];
  int64 price = 3 [json_name = "price"];
  int64 fees = 4 [json_name = "fees"];
  int64 transactionDate = 5 [json_name = "transactionDate"];
  string notes = 6 [json_name = "notes"];
  InvestmentTransactionType type = 7 [json_name = "type"];  // NEW field
}
```

Update `EditInvestmentTransactionResponse` to include `updatedInvestment`:
```protobuf
message EditInvestmentTransactionResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  InvestmentTransaction data = 3 [json_name = "data"];
  string timestamp = 4 [json_name = "timestamp"];
  Investment updatedInvestment = 5 [json_name = "updatedInvestment"];  // NEW field
}
```

**Step 2: Generate code**
```bash
task proto:all
```

**Step 3: Verify generated code compiles**
```bash
cd src/go-backend && go build ./...
cd src/wj-client && npx tsc --noEmit
```

**Step 4: Commit**
```
feat(proto): add type field to EditInvestmentTransactionRequest and updatedInvestment to response
```

---

### Task 1: Backend — Implement Buy Quantity Reduction Guard

**Files:**

- Modify: `src/go-backend/domain/service/investment_service.go` (new helper method)

**Security notes:** This is a critical validation that prevents data corruption. If a user bought 100 shares and sold 30, they cannot reduce the buy quantity below 30 (the already-consumed amount). Without this guard, lot math would go negative.

**Step 1: Write the validation helper**

Add a `validateBuyQuantityReduction` method to `investmentService`:

```go
// validateBuyQuantityReduction checks if reducing a buy transaction's quantity
// would conflict with lots already consumed by sells.
// Returns error if new quantity < (original quantity - remaining quantity on lot).
func (s *investmentService) validateBuyQuantityReduction(ctx context.Context, tx *models.InvestmentTransaction, newQuantity int64) error {
    if tx.LotID == nil {
        return nil // No lot tracking, nothing to validate
    }

    lot, err := s.txRepo.GetLotByID(ctx, *tx.LotID)
    if err != nil {
        return apperrors.NewInternalErrorWithCause("failed to get lot for validation", err)
    }

    // Amount already sold from this lot = original lot quantity - remaining
    alreadySold := lot.Quantity - lot.RemainingQuantity
    if alreadySold > 0 && newQuantity < alreadySold {
        return apperrors.NewValidationError(
            fmt.Sprintf("Cannot reduce quantity below %d units (%d already sold from this lot)", alreadySold, alreadySold),
        )
    }

    return nil
}
```

**Step 2: Verify it compiles**
```bash
cd src/go-backend && go build ./...
```

**Step 3: Commit**
```
feat(investment): add buy quantity reduction guard for edit transaction
```

---

### Task 2: Backend — Implement Full EditTransaction with Delete-and-Recreate

**Files:**

- Modify: `src/go-backend/domain/service/investment_service.go` (rewrite `EditTransaction` method, lines ~987-1026)

**Security notes:**
- Entire operation wrapped in `db.Transaction()` — rollback on any error
- Ownership verified via `GetByIDForUser` before any mutation
- Buy qty reduction guard called before reversal
- Cache invalidation after commit
- All existing validations from `processXxxTransaction` apply to the new values

**Step 1: Rewrite EditTransaction method**

Replace the current notes-only implementation with the full delete-and-recreate logic:

```go
func (s *investmentService) EditTransaction(ctx context.Context, transactionID int32, userID int32, req *v1.EditInvestmentTransactionRequest) (*v1.EditInvestmentTransactionResponse, error) {
    if err := validator.ID(transactionID); err != nil {
        return nil, err
    }
    if err := validator.ID(userID); err != nil {
        return nil, err
    }

    // 1. Get transaction and verify ownership
    oldTx, err := s.txRepo.GetByIDForUser(ctx, transactionID, userID)
    if err != nil {
        return nil, err
    }

    // 2. Get parent investment
    investment, err := s.investmentRepo.GetByID(ctx, oldTx.InvestmentID)
    if err != nil {
        return nil, apperrors.NewInternalErrorWithCause("failed to get parent investment", err)
    }

    // 3. Determine new type (use existing type if not specified)
    newType := v1.InvestmentTransactionType(oldTx.Type)
    if req.Type != v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_UNSPECIFIED {
        newType = req.Type
    }

    // 4. Buy quantity reduction guard (only for buy→buy edits where lot exists)
    oldType := v1.InvestmentTransactionType(oldTx.Type)
    if oldType == v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_BUY && oldTx.LotID != nil {
        if newType == v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_BUY {
            // Reducing a buy: check if new qty < already sold
            if err := s.validateBuyQuantityReduction(ctx, oldTx, req.Quantity); err != nil {
                return nil, err
            }
        } else {
            // Changing buy → sell/dividend: lot has been consumed, check if ANY was sold
            lot, lotErr := s.txRepo.GetLotByID(ctx, *oldTx.LotID)
            if lotErr != nil {
                return nil, apperrors.NewInternalErrorWithCause("failed to get lot", lotErr)
            }
            alreadySold := lot.Quantity - lot.RemainingQuantity
            if alreadySold > 0 {
                return nil, apperrors.NewValidationError(
                    fmt.Sprintf("Cannot change type from buy: %d units already sold from this lot", alreadySold),
                )
            }
        }
    }

    // 5. Validate transaction date (not in future)
    if req.TransactionDate > 0 {
        txTime := time.Unix(req.TransactionDate, 0)
        if txTime.After(time.Now()) {
            return nil, apperrors.NewValidationError("transaction date cannot be in the future")
        }
    }

    // 6. Atomic delete-and-recreate within a DB transaction
    var newTx *models.InvestmentTransaction
    err = s.db.Transaction(func(dbTx *gorm.DB) error {
        // 6a. Reverse old transaction (same logic as DeleteTransaction)
        switch oldType {
        case v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_BUY:
            if err := s.reverseBuyTransaction(ctx, investment, oldTx); err != nil {
                return fmt.Errorf("failed to reverse buy: %w", err)
            }
        case v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_SELL:
            if err := s.reverseSellTransaction(ctx, investment, oldTx); err != nil {
                return fmt.Errorf("failed to reverse sell: %w", err)
            }
        case v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_DIVIDEND:
            if err := s.reverseDividendTransaction(ctx, investment, oldTx); err != nil {
                return fmt.Errorf("failed to reverse dividend: %w", err)
            }
        default:
            return apperrors.NewValidationError("unsupported transaction type")
        }

        // 6b. Soft-delete old transaction
        if err := s.txRepo.Delete(ctx, oldTx.ID); err != nil {
            return fmt.Errorf("failed to delete old transaction: %w", err)
        }

        // 6c. Build AddTransactionRequest for the new transaction
        addReq := &v1.AddTransactionRequest{
            InvestmentId:    oldTx.InvestmentID,
            Type:            newType,
            Quantity:        req.Quantity,
            Price:           req.Price,
            Fees:            req.Fees,
            TransactionDate: req.TransactionDate,
            Notes:           req.Notes,
        }

        // 6d. Process new transaction (same logic as AddTransaction)
        var processErr error
        switch newType {
        case v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_BUY:
            newTx, processErr = s.processBuyTransaction(ctx, investment, addReq, userID)
        case v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_SELL:
            newTx, processErr = s.processSellTransaction(ctx, investment, addReq, userID)
        case v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_DIVIDEND:
            newTx, processErr = s.processDividendTransaction(ctx, investment, addReq, userID)
        default:
            return apperrors.NewValidationError("unsupported new transaction type")
        }
        if processErr != nil {
            return processErr
        }

        return nil
    })

    if err != nil {
        return nil, err
    }

    // 7. Cache invalidation
    s.invalidateCurrencyCache(investment.Currency)
    if investment.WalletID != nil {
        s.invalidateWalletInvestmentValueCache(*investment.WalletID)
    }

    // 8. Build response
    txProto := s.mapper.TransactionToProto(newTx)
    s.enrichTransactionProto(ctx, userID, txProto, investment.Currency)
    investmentProto := s.mapper.InvestmentToProto(investment)

    return &v1.EditInvestmentTransactionResponse{
        Success:           true,
        Message:           "Transaction updated successfully",
        Data:              txProto,
        UpdatedInvestment: investmentProto,
        Timestamp:         time.Now().Format(time.RFC3339),
    }, nil
}
```

**Key considerations:**
- The `db.Transaction()` wrapper must be verified — check if the service already has `s.db` or uses a different transaction mechanism. Read the existing `DeleteTransaction` and `AddTransaction` implementations to match the pattern.
- The `reverseBuyTransaction`, `reverseSellTransaction`, `reverseDividendTransaction` methods must work within the same DB transaction context. Verify they use `ctx` properly or if a `*gorm.DB` needs to be passed.
- The `processBuyTransaction`, `processSellTransaction`, `processDividendTransaction` methods create new records — verify they return the created transaction.

**Step 2: Verify it compiles**
```bash
cd src/go-backend && go build ./...
```

**Step 3: Commit**
```
feat(investment): implement full edit transaction with delete-and-recreate strategy
```

---

### Task 3: Backend — Update Handler to Pass `type` and Return `updatedInvestment`

**Files:**

- Modify: `src/go-backend/handlers/investment.go` (EditTransaction handler, lines ~430-500)

**Security notes:** Validate `type` is a valid enum value {1,2,3} or 0 (unspecified = keep existing). Handler already validates quantity, price, fees.

**Step 1: Update handler**

Add type validation to the handler and update the response mapping:

```go
// In EditTransaction handler, after binding request:

// Validate type if provided
if req.Type != 0 {
    switch req.Type {
    case investmentv1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_BUY,
         investmentv1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_SELL,
         investmentv1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_DIVIDEND:
        // Valid
    default:
        handler.BadRequest(c, apperrors.NewValidationError("invalid transaction type"))
        return
    }
}
```

Update the response to use `gin.H{}` that includes `updatedInvestment`:

```go
handler.Success(c, gin.H{
    "success":           result.Success,
    "message":           result.Message,
    "data":              result.Data,
    "updatedInvestment": result.UpdatedInvestment,
    "timestamp":         result.Timestamp,
})
```

**Note:** Verify if the current handler already returns `result` directly or wraps in `gin.H{}`. Match the existing pattern.

**Step 2: Verify it compiles**
```bash
cd src/go-backend && go build ./...
```

**Step 3: Commit**
```
feat(investment): update edit handler with type validation and updatedInvestment response
```

---

### Task 4: Frontend — Add Edit Mode to AddInvestmentTransactionForm

**Files:**

- Modify: `src/wj-client/features/investment/forms/AddInvestmentTransactionForm.tsx`

**Security notes:** Client-side validation only (defense in depth — server validates too). Pre-filled values must be converted from storage format back to display units for gold/silver.

**Step 0: Component inventory check**

Components to reuse:
- `AddInvestmentTransactionForm` (this file — adding edit mode props)
- `useMutationEditInvestmentTransaction` from `@/utils/generated/hooks`
- Gold/silver calculators from `@/lib/utils/gold-calculator` and `@/lib/utils/silver-calculator`
- `SuccessAnimation` from `@/components/success/SuccessAnimation`

No new components needed.

**Step 1: Add edit mode props**

Extend the props interface:
```typescript
interface AddInvestmentTransactionFormProps {
  investmentId: number;
  investmentType: InvestmentType;
  investmentCurrency?: string;
  purchaseUnit?: string;
  symbol?: string;
  onSuccess?: () => void;
  // NEW: Edit mode
  editTransaction?: InvestmentTransaction; // If provided, form is in edit mode
}
```

**Step 2: Add reverse conversion helpers for pre-fill**

When in edit mode, convert storage values back to display values:
- **Standard investments:** `storageToQuantity(storedQty)` and `smallestUnitToAmount(price, currency)`
- **Gold VND:** Convert grams (stored) → mace (display) using `convertGoldQuantity(grams, "gram", "mace")`
- **Gold USD:** Convert ounces (stored, ×10000) → ounces (display) — just divide by 10000
- **Silver VND:** Convert grams (stored) → tael (display) using `convertSilverQuantity(grams, "gram", "tael")`
- **Silver USD:** Similar to gold USD

**Step 3: Set form defaults from editTransaction**

```typescript
const defaultValues = editTransaction
  ? {
      type: editTransaction.type,
      quantity: reverseQuantityConversion(editTransaction.quantity, investmentType, purchaseUnit),
      price: reversePriceConversion(editTransaction.price, investmentType, investmentCurrency, purchaseUnit),
      fees: smallestUnitToAmount(editTransaction.fees, investmentCurrency),
      transactionDate: formatDateForInput(editTransaction.transactionDate),
    }
  : {
      type: InvestmentTransactionType.INVESTMENT_TRANSACTION_TYPE_BUY,
      quantity: undefined,
      price: undefined,
      fees: 0,
      transactionDate: new Date().toISOString().split("T")[0],
    };
```

**Step 4: Add edit mutation alongside add mutation**

```typescript
const editMutation = useMutationEditInvestmentTransaction({
  onSuccess: (data) => {
    // Invalidate same queries as add
    queryClient.invalidateQueries({ predicate: (q) => /* Investment queries */ });
    queryClient.invalidateQueries({ predicate: (q) => /* Wallet queries */ });
    setShowSuccess(true);
  },
  onError: (error: any) => {
    setError(error.message || "Failed to update transaction");
  },
});
```

**Step 5: Update submit handler**

```typescript
const onSubmit = (data) => {
  // ... existing conversion logic ...

  if (editTransaction) {
    editMutation.mutate({
      id: editTransaction.id,
      type: data.type,
      quantity: quantityInStorage,
      price: amountToSmallestUnit(priceInStorage, investmentCurrency),
      fees: amountToSmallestUnit(data.fees, investmentCurrency),
      transactionDate: Math.floor(new Date(data.transactionDate).getTime() / 1000),
      notes: data.notes || "",
    });
  } else {
    addTransactionMutation.mutate(request);
  }
};
```

**Step 6: Update UI text**

```typescript
// Title
const title = editTransaction ? "Edit Transaction" : "Add Transaction";

// Submit button
const submitText = editTransaction ? "Save Changes" : "Add Transaction";

// Success message
const successMessage = editTransaction ? "Transaction Updated!" : "Transaction Added!";

// Loading state
const isPending = editTransaction ? editMutation.isPending : addTransactionMutation.isPending;
```

**Step 7: Commit**
```
feat(investment): add edit mode to AddInvestmentTransactionForm
```

---

### Task 5: Frontend — Add Edit Button and State to InvestmentDetailModal

**Files:**

- Modify: `src/wj-client/features/investment/components/InvestmentDetailModal.tsx`

**Security notes:** No new security concerns — edit button only sets local state. The actual mutation is handled by the form component.

**Step 0: Component inventory check**

Reusing:
- `EditIcon` from `@/components/icons/actions`
- `Button` from `@/components/Button` (variant="ghost", iconOnly)
- Existing tab navigation logic

**Step 1: Add edit state**

```typescript
const [editingTransaction, setEditingTransaction] = useState<InvestmentTransaction | null>(null);
```

**Step 2: Add edit button to transaction rows**

In both desktop table and mobile table, add an edit button beside the existing delete button:

```typescript
// Desktop table action column
<button
  onClick={() => {
    setEditingTransaction(transaction);
    setActiveTab("add-transaction"); // Switch to form tab
  }}
  className="..." // Match existing delete button styling
>
  <EditIcon size={16} />
</button>
```

**Step 3: Pass editTransaction to AddInvestmentTransactionForm**

When rendering the "add-transaction" tab:
```typescript
{activeTab === "add-transaction" && (
  <AddInvestmentTransactionForm
    investmentId={investment.id}
    investmentType={investment.type}
    investmentCurrency={investment.currency}
    purchaseUnit={investment.purchaseUnit}
    symbol={investment.symbol}
    editTransaction={editingTransaction}
    onSuccess={() => {
      setEditingTransaction(null); // Clear edit state
      setActiveTab("transactions"); // Return to list
      // Refresh data
    }}
  />
)}
```

**Step 4: Update tab title when in edit mode**

```typescript
// Tab label or form title should show "Edit Transaction" when editingTransaction is set
```

**Step 5: Clear edit state when switching tabs manually**

```typescript
const handleTabChange = (tab: TabType) => {
  if (tab !== "add-transaction") {
    setEditingTransaction(null); // Clear edit state when leaving form tab
  }
  setActiveTab(tab);
};
```

**Step 6: Commit**
```
feat(investment): add edit button to transaction rows in InvestmentDetailModal
```

---

### Task 6: Update Runtime Flow Diagram

**Files:**

- Modify: `docs/architecture/flow-investment.md`

**Steps:**

1. Read the current flow-investment.md to understand existing diagram patterns
2. Add a new section "## 7. Edit Transaction (Delete-and-Recreate)" with a Mermaid sequenceDiagram showing:
   - User → Handler: PUT /api/v1/investment-transactions/{id}
   - Handler → Service: EditTransaction(userID, txID, request)
   - Service → Repository: GetByIDForUser (ownership check)
   - Service → Service: validateBuyQuantityReduction (if buy→buy)
   - Service → DB: BEGIN TRANSACTION
   - Service → Service: reverseXxxTransaction (undo old)
   - Service → Repository: Delete old transaction (soft delete)
   - Service → Service: processXxxTransaction (create new)
   - Service → DB: COMMIT
   - Service → Cache: Invalidate
   - Handler → User: Updated transaction + investment
3. Add Key Invariants section
4. Add Error Paths table
5. Update table of contents

**Step 1: Commit**
```
docs(architecture): add edit transaction flow diagram to flow-investment.md
```

---

## Task Dependency Graph

```
Task 0 (Proto) ──→ Task 1 (Buy Guard) ──→ Task 2 (Service) ──→ Task 3 (Handler)
                                                                       │
                                                                       ▼
Task 0 (Proto) ──→ Task 4 (Frontend Form) ──→ Task 5 (Modal Integration)
                                                                       │
                                                                       ▼
                                                              Task 6 (Flow Diagram)
```

- **Task 0** must be first (proto generates types for everything)
- **Tasks 1-3** are sequential (guard → service → handler)
- **Task 4** depends on Task 0 (needs generated types) but is independent of Tasks 1-3
- **Task 5** depends on Task 4
- **Task 6** can be done after Task 2 (service is implemented) or at the end

**Parallelizable after Task 0:** Tasks 1-3 (backend) and Task 4 (frontend) can be done in parallel since they modify different codebases.

## Verification Checklist

After all tasks are complete, verify:

- [ ] `task proto:all` succeeds
- [ ] `cd src/go-backend && go build ./...` succeeds
- [ ] `cd src/wj-client && npx tsc --noEmit` succeeds
- [ ] Edit a buy transaction — verify lot/investment totals are correct
- [ ] Edit a sell transaction — verify FIFO lots and realized PNL recalculate
- [ ] Edit a dividend transaction — verify totalDividends recalculates
- [ ] Edit buy to reduce quantity below sold amount — verify error message
- [ ] Change buy → sell — verify lot reversal + new sell consumption
- [ ] Change sell → buy — verify lot restoration + new buy lot
- [ ] Edit gold VND transaction — verify mace ↔ gram conversions round-trip
- [ ] Edit silver VND transaction — verify tael ↔ gram conversions round-trip
- [ ] Concurrent edit attempt — verify no data corruption
- [ ] Edit non-owned transaction — verify 403/404
- [ ] Frontend form pre-fills correctly for all investment types

# Delete Investment and Investment Transaction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement UI and improve backend logic for deleting investment holdings and investment transactions, ensuring proper FIFO recalculation and cascade behavior.

**Architecture:** The implementation adds delete buttons to the existing InvestmentDetailModal component with confirmation dialogs. Backend improvements include proper recalculation of parent investment stats when transactions are deleted and cascade soft-delete of related transactions/lots when an investment is deleted.

**Tech Stack:** React 19, TypeScript 5, TanStack Query, Go 1.23, Gin, GORM

---

## Current State Analysis

### Backend Issues Found:

1. **DeleteInvestment** - Only allows deletion when quantity=0, soft deletes the investment but does NOT cascade delete related transactions/lots (they become orphaned)
2. **DeleteTransaction** - Soft deletes the transaction but does NOT:
   - Recalculate parent investment's quantity, costs, or PNL
   - Update related InvestmentLot's remaining_quantity
   - Handle FIFO accounting properly (has TODO comment)

### Frontend Missing:

1. No delete button for investment holdings
2. No delete button for individual transactions in the transactions table
3. No confirmation dialogs for destructive actions

---

## Task 1: Add Delete Transaction Functionality to Frontend

**Files:**

- Modify: [InvestmentDetailModal.tsx](src/wj-client/components/modals/InvestmentDetailModal.tsx)

### Step 1: Add delete mutation hook import

In `InvestmentDetailModal.tsx`, add the import for the delete mutation:

```typescript
import {
  useQueryGetInvestment,
  useQueryListInvestmentTransactions,
  useMutationUpdatePrices,
  useMutationDeleteInvestmentTransaction,
  EVENT_InvestmentGetInvestment,
  EVENT_InvestmentListInvestments,
  EVENT_InvestmentGetPortfolioSummary,
} from "@/utils/generated/hooks";
```

### Step 2: Add state for delete confirmation

Add state variables for tracking the transaction being deleted:

```typescript
const [deletingTransactionId, setDeletingTransactionId] = useState<
  number | null
>(null);
const [deleteError, setDeleteError] = useState<string | null>(null);
```

### Step 3: Add delete mutation hook

Add the mutation hook after the existing `updatePricesMutation`:

```typescript
const deleteTransactionMutation = useMutationDeleteInvestmentTransaction({
  onSuccess: () => {
    // Invalidate queries to refetch fresh data
    queryClient.invalidateQueries({
      queryKey: [EVENT_InvestmentGetInvestment],
    });
    queryClient.invalidateQueries({
      queryKey: [EVENT_InvestmentListInvestments],
    });
    queryClient.invalidateQueries({
      queryKey: [EVENT_InvestmentGetPortfolioSummary],
    });

    // Refetch data
    getInvestment.refetch();
    getListInvestmentTransactions.refetch();

    // Clear state
    setDeletingTransactionId(null);
    setDeleteError(null);
  },
  onError: (error: any) => {
    setDeleteError(error.message || "Failed to delete transaction");
  },
});
```

### Step 4: Add delete handler function

Add the handler function:

```typescript
const handleDeleteTransaction = (transactionId: number) => {
  setDeleteError(null);
  deleteTransactionMutation.mutate({ id: transactionId });
};
```

### Step 5: Add actions column to desktop table

Update the `columns` array to add an actions column at the end:

```typescript
{
  id: "actions",
  header: "",
  cell: ({ row }) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        setDeletingTransactionId(row.original.id);
      }}
      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
      title="Delete transaction"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  ),
},
```

### Step 6: Add actions column to mobile table

Update the `mobileColumns` array or add `renderActions` prop to MobileTable:

```typescript
<MobileTable
  data={transactions}
  columns={mobileColumns}
  getKey={(transaction) => transaction.id}
  isLoading={...}
  emptyMessage="No transactions yet."
  emptyDescription=""
  maxHeight="45vh"
  showScrollIndicator={transactions.length > 1}
  className="m-1"
  renderActions={(transaction) => (
    <button
      onClick={() => setDeletingTransactionId(transaction.id)}
      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
      title="Delete transaction"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  )}
/>
```

### Step 7: Add ConfirmationDialog for delete

Add the ConfirmationDialog import and render it at the end of the modal (before closing `</BaseModal>`):

```typescript
import { ConfirmationDialog } from "@/components/modals/ConfirmationDialog";
```

Then add the dialog:

```typescript
{deletingTransactionId !== null && (
  <ConfirmationDialog
    title="Delete Transaction"
    message={
      <div>
        <p>Are you sure you want to delete this transaction?</p>
        <p className="text-sm text-gray-500 mt-2">
          This will recalculate your investment&apos;s quantity and cost basis.
        </p>
        {deleteError && (
          <p className="text-sm text-red-600 mt-2">{deleteError}</p>
        )}
      </div>
    }
    confirmText="Delete"
    cancelText="Cancel"
    onConfirm={() => handleDeleteTransaction(deletingTransactionId)}
    onCancel={() => {
      setDeletingTransactionId(null);
      setDeleteError(null);
    }}
    isLoading={deleteTransactionMutation.isPending}
    variant="danger"
  />
)}
```

### Step 8: Run frontend to verify it compiles

Run: `cd src/wj-client && npm run build`
Expected: Build succeeds (backend calls will fail until implemented)

---

## Task 2: Add Delete Investment Functionality to Frontend

**Files:**

- Modify: [InvestmentDetailModal.tsx](src/wj-client/components/modals/InvestmentDetailModal.tsx)

### Step 1: Add delete investment mutation hook import

Add to the existing imports:

```typescript
import {
  useQueryGetInvestment,
  useQueryListInvestmentTransactions,
  useMutationUpdatePrices,
  useMutationDeleteInvestmentTransaction,
  useMutationDeleteInvestment,
  EVENT_InvestmentGetInvestment,
  EVENT_InvestmentListInvestments,
  EVENT_InvestmentGetPortfolioSummary,
} from "@/utils/generated/hooks";
```

### Step 2: Add state for delete investment confirmation

Add state variable:

```typescript
const [showDeleteInvestment, setShowDeleteInvestment] = useState(false);
const [deleteInvestmentError, setDeleteInvestmentError] = useState<
  string | null
>(null);
```

### Step 3: Add delete investment mutation hook

Add the mutation hook:

```typescript
const deleteInvestmentMutation = useMutationDeleteInvestment({
  onSuccess: () => {
    // Invalidate queries to refetch fresh data
    queryClient.invalidateQueries({
      queryKey: [EVENT_InvestmentListInvestments],
    });
    queryClient.invalidateQueries({
      queryKey: [EVENT_InvestmentGetPortfolioSummary],
    });

    // Call success callback and close modal
    onSuccess?.();
    onClose();
  },
  onError: (error: any) => {
    setDeleteInvestmentError(error.message || "Failed to delete investment");
  },
});
```

### Step 4: Add delete investment handler

Add the handler function:

```typescript
const handleDeleteInvestment = () => {
  setDeleteInvestmentError(null);
  deleteInvestmentMutation.mutate({ id: investmentId });
};
```

### Step 5: Add Delete Investment button to overview tab

In the overview tab section, add a delete button at the bottom (inside the `{activeTab === "overview" && (` block, after the PNL section):

```typescript
{/* Delete Investment Section */}
<div className="border-t pt-4 mt-4">
  <Button
    type={ButtonType.SECONDARY}
    onClick={() => setShowDeleteInvestment(true)}
    className="w-full bg-red-50 text-red-600 hover:bg-red-100 border-red-200"
  >
    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
    Delete Investment
  </Button>
</div>
```

### Step 6: Add ConfirmationDialog for delete investment

Add after the transaction delete dialog:

```typescript
{showDeleteInvestment && (
  <ConfirmationDialog
    title="Delete Investment"
    message={
      <div>
        <p>Are you sure you want to delete <strong>{investment?.symbol}</strong>?</p>
        {(investment?.quantity || 0) > 0 ? (
          <p className="text-sm text-red-600 mt-2">
            Warning: You still have {formatQuantity(investment?.quantity || 0, investment?.type || 0)} units.
            All holdings and transaction history will be permanently deleted.
          </p>
        ) : (
          <p className="text-sm text-gray-500 mt-2">
            All transaction history for this investment will be deleted.
          </p>
        )}
        {deleteInvestmentError && (
          <p className="text-sm text-red-600 mt-2">{deleteInvestmentError}</p>
        )}
      </div>
    }
    confirmText="Delete Investment"
    cancelText="Cancel"
    onConfirm={handleDeleteInvestment}
    onCancel={() => {
      setShowDeleteInvestment(false);
      setDeleteInvestmentError(null);
    }}
    isLoading={deleteInvestmentMutation.isPending}
    variant="danger"
  />
)}
```

### Step 7: Run frontend to verify it compiles

Run: `cd src/wj-client && npm run build`
Expected: Build succeeds

---

## Task 3: Backend - Implement DeleteTransaction with Investment Recalculation

**Files:**

- Modify: [investment_service.go](src/go-backend/domain/service/investment_service.go)

### Step 1: Update DeleteTransaction to get transaction details

Replace the existing `DeleteTransaction` method with proper recalculation:

```go
// DeleteTransaction deletes a transaction and recalculates the parent investment.
func (s *investmentService) DeleteTransaction(ctx context.Context, transactionID int32, userID int32) (*investmentv1.DeleteInvestmentTransactionResponse, error) {
	if err := validator.ID(transactionID); err != nil {
		return nil, err
	}
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	// Get transaction and verify ownership
	tx, err := s.txRepo.GetByIDForUser(ctx, transactionID, userID)
	if err != nil {
		return nil, err
	}

	// Get the parent investment
	investment, err := s.investmentRepo.GetByID(ctx, tx.InvestmentID)
	if err != nil {
		return nil, apperrors.NewInternalErrorWithCause("failed to get parent investment", err)
	}

	// Handle based on transaction type
	switch tx.Type {
	case investmentv1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_BUY:
		if err := s.reverseBuyTransaction(ctx, investment, tx); err != nil {
			return nil, err
		}
	case investmentv1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_SELL:
		if err := s.reverseSellTransaction(ctx, investment, tx); err != nil {
			return nil, err
		}
	default:
		// For dividend/split, just delete the transaction
	}

	// Delete transaction
	if err := s.txRepo.Delete(ctx, transactionID); err != nil {
		return nil, err
	}

	// Invalidate currency cache
	if err := s.invalidateInvestmentCache(ctx, userID, tx.InvestmentID); err != nil {
		fmt.Printf("Warning: failed to invalidate currency cache for investment %d: %v\n", tx.InvestmentID, err)
	}

	return &investmentv1.DeleteInvestmentTransactionResponse{
		Success:   true,
		Message:   "Transaction deleted successfully",
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}
```

### Step 2: Add reverseBuyTransaction helper method

Add this helper method:

```go
// reverseBuyTransaction reverses a buy transaction by updating the lot and investment.
func (s *investmentService) reverseBuyTransaction(ctx context.Context, investment *models.Investment, tx *models.InvestmentTransaction) error {
	// If transaction has a LotID, update that specific lot
	if tx.LotID != nil {
		lot, err := s.txRepo.GetLotByID(ctx, *tx.LotID)
		if err != nil {
			return apperrors.NewInternalErrorWithCause("failed to get lot", err)
		}

		// Reduce lot quantity
		lot.Quantity -= tx.Quantity
		lot.RemainingQuantity -= tx.Quantity
		if lot.RemainingQuantity < 0 {
			lot.RemainingQuantity = 0
		}
		lot.TotalCost -= tx.Cost + tx.Fees

		// Recalculate average cost if still has quantity
		if lot.Quantity > 0 {
			lot.AverageCost = units.CalculateAverageCost(lot.TotalCost, lot.Quantity, investment.Type)
		}

		if err := s.txRepo.UpdateLot(ctx, lot); err != nil {
			return apperrors.NewInternalErrorWithCause("failed to update lot", err)
		}
	}

	// Update investment totals
	investment.Quantity -= tx.Quantity
	investment.TotalCost -= tx.Cost + tx.Fees

	// Recalculate average cost if still has quantity
	if investment.Quantity > 0 {
		investment.AverageCost = units.CalculateAverageCost(investment.TotalCost, investment.Quantity, investment.Type)
	} else {
		investment.AverageCost = 0
		investment.TotalCost = 0
	}

	if err := s.investmentRepo.Update(ctx, investment); err != nil {
		return apperrors.NewInternalErrorWithCause("failed to update investment", err)
	}

	return nil
}
```

### Step 3: Add reverseSellTransaction helper method

Add this helper method:

```go
// reverseSellTransaction reverses a sell transaction by restoring the lot and investment.
func (s *investmentService) reverseSellTransaction(ctx context.Context, investment *models.Investment, tx *models.InvestmentTransaction) error {
	// If transaction has a LotID, restore quantity to that lot
	if tx.LotID != nil {
		lot, err := s.txRepo.GetLotByID(ctx, *tx.LotID)
		if err != nil {
			return apperrors.NewInternalErrorWithCause("failed to get lot", err)
		}

		// Restore lot quantity
		lot.RemainingQuantity += tx.Quantity

		if err := s.txRepo.UpdateLot(ctx, lot); err != nil {
			return apperrors.NewInternalErrorWithCause("failed to update lot", err)
		}
	}

	// Update investment - add back the sold quantity
	investment.Quantity += tx.Quantity

	// Reverse realized PNL - this is complex because we need to recalculate
	// For simplicity, we'll just reverse the PNL that was recorded
	// The exact PNL was: sell_value - cost_basis
	// We don't store cost_basis on the transaction, so we approximate
	// by reducing realized PNL proportionally
	if tx.RealizedPNL != 0 {
		investment.RealizedPNL -= tx.RealizedPNL
	}

	if err := s.investmentRepo.Update(ctx, investment); err != nil {
		return apperrors.NewInternalErrorWithCause("failed to update investment", err)
	}

	return nil
}
```

### Step 4: Verify RealizedPNL field exists on transaction model

Check if `RealizedPNL` exists on `InvestmentTransaction`. If not, we'll need to track it when creating sell transactions.

Run: `grep -n "RealizedPNL" src/go-backend/domain/models/investment_transaction.go`

If it doesn't exist, add it to the model and update `processSellTransaction` to populate it.

### Step 5: Run backend tests

Run: `cd src/go-backend && go build ./...`
Expected: Build succeeds

---

## Task 4: Backend - Implement DeleteInvestment with Cascade Behavior

**Files:**

- Modify: [investment_service.go](src/go-backend/domain/service/investment_service.go)
- Modify: [investment_repository.go](src/go-backend/domain/repository/investment_repository.go)
- Modify: [investment_repository_impl.go](src/go-backend/domain/repository/investment_repository_impl.go)

### Step 1: Update DeleteInvestment to cascade delete transactions and lots

Replace the existing `DeleteInvestment` method:

```go
// DeleteInvestment deletes an investment and all related transactions/lots.
func (s *investmentService) DeleteInvestment(ctx context.Context, investmentID int32, userID int32) (*investmentv1.DeleteInvestmentResponse, error) {
	if err := validator.ID(investmentID); err != nil {
		return nil, err
	}
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	// Get investment and verify ownership
	investment, err := s.investmentRepo.GetByIDForUser(ctx, investmentID, userID)
	if err != nil {
		return nil, err
	}

	// Delete all related transactions first
	if err := s.txRepo.DeleteByInvestmentID(ctx, investmentID); err != nil {
		return nil, apperrors.NewInternalErrorWithCause("failed to delete transactions", err)
	}

	// Delete all related lots
	if err := s.txRepo.DeleteLotsByInvestmentID(ctx, investmentID); err != nil {
		return nil, apperrors.NewInternalErrorWithCause("failed to delete lots", err)
	}

	// Delete investment
	if err := s.investmentRepo.Delete(ctx, investmentID); err != nil {
		return nil, err
	}

	// Invalidate currency cache
	if err := s.invalidateInvestmentCache(ctx, userID, investmentID); err != nil {
		fmt.Printf("Warning: failed to invalidate currency cache for investment %d: %v\n", investmentID, err)
	}

	return &investmentv1.DeleteInvestmentResponse{
		Success:   true,
		Message:   fmt.Sprintf("Investment %s deleted successfully with all related data", investment.Symbol),
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}
```

### Step 2: Add DeleteByInvestmentID to InvestmentTransactionRepository interface

In `investment_transaction_repository.go`, add:

```go
// DeleteByInvestmentID soft deletes all transactions for an investment.
DeleteByInvestmentID(ctx context.Context, investmentID int32) error

// DeleteLotsByInvestmentID soft deletes all lots for an investment.
DeleteLotsByInvestmentID(ctx context.Context, investmentID int32) error
```

### Step 3: Implement DeleteByInvestmentID in repository

In `investment_transaction_repository_impl.go`, add:

```go
// DeleteByInvestmentID soft deletes all transactions for an investment.
func (r *investmentTransactionRepository) DeleteByInvestmentID(ctx context.Context, investmentID int32) error {
	return r.db.WithContext(ctx).
		Where("investment_id = ?", investmentID).
		Delete(&models.InvestmentTransaction{}).Error
}

// DeleteLotsByInvestmentID soft deletes all lots for an investment.
func (r *investmentTransactionRepository) DeleteLotsByInvestmentID(ctx context.Context, investmentID int32) error {
	return r.db.WithContext(ctx).
		Where("investment_id = ?", investmentID).
		Delete(&models.InvestmentLot{}).Error
}
```

### Step 4: Run backend tests

Run: `cd src/go-backend && go build ./...`
Expected: Build succeeds

---

## Task 5: Add RealizedPNL Tracking to Sell Transactions

**Files:**

- Modify: [investment_transaction.go](src/go-backend/domain/models/investment_transaction.go)
- Modify: [investment_service.go](src/go-backend/domain/service/investment_service.go)

### Step 1: Check if RealizedPNL field exists

Run: `grep -n "RealizedPNL" src/go-backend/domain/models/investment_transaction.go`

If it doesn't exist, add it to the model:

```go
RealizedPNL int64 `gorm:"type:bigint;default:0" json:"realizedPnl"`
```

### Step 2: Update processSellTransaction to store RealizedPNL

In the `processSellTransaction` method, update the transaction creation to include the realized PNL:

```go
// Create transaction record with realized PNL
tx := &models.InvestmentTransaction{
	InvestmentID:    investment.ID,
	WalletID:        investment.WalletID,
	Type:            investmentv1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_SELL,
	Quantity:        req.Quantity,
	Price:           req.Price,
	Cost:            sellProceeds,
	Fees:            req.Fees,
	TransactionDate: time.Unix(req.TransactionDate, 0),
	Notes:           req.Notes,
	RealizedPNL:     realizedPNL, // Store the calculated PNL
}
```

### Step 3: Run database migration

Run: `cd src/go-backend && go run cmd/main.go migrate`
Or rely on GORM auto-migrate if enabled.

### Step 4: Run backend tests

Run: `cd src/go-backend && go build ./...`
Expected: Build succeeds

---

## Task 6: Integration Testing

**Files:**

- Manual testing via UI

### Step 1: Start backend and frontend

Run: `task dev`

### Step 2: Test delete transaction flow

1. Navigate to Portfolio page
2. Click on an investment with transactions
3. Go to Transactions tab
4. Click delete button on a transaction
5. Verify confirmation dialog appears
6. Confirm deletion
7. Verify investment stats update correctly
8. Verify transaction disappears from list

### Step 3: Test delete investment flow

1. Navigate to Portfolio page
2. Click on an investment
3. Click "Delete Investment" button
4. Verify confirmation dialog shows warning about remaining holdings (if any)
5. Confirm deletion
6. Verify investment disappears from list
7. Verify portfolio summary updates

### Step 4: Test edge cases

1. Try deleting the only transaction (should delete investment too or leave zero quantity)
2. Try deleting a buy transaction when there's a subsequent sell (verify FIFO handling)
3. Verify error handling when backend fails

---

## Task 7: Final Review and Cleanup

### Step 1: Review all changed files

Run: `git diff main --stat`

### Step 2: Run full build

Run: `task build:all`
Expected: Both frontend and backend build successfully

### Step 3: Run linters

Run: `cd src/wj-client && npm run lint`
Run: `cd src/go-backend && golangci-lint run`

### Step 4: Fix any linting issues

---

## Summary of Changes

### Frontend Changes

- [InvestmentDetailModal.tsx](src/wj-client/components/modals/InvestmentDetailModal.tsx)
  - Added delete button to transaction table rows
  - Added delete investment button in overview tab
  - Added confirmation dialogs for both actions
  - Integrated with delete mutation hooks
  - Added error handling and loading states

### Backend Changes

- [investment_service.go](src/go-backend/domain/service/investment_service.go)
  - Updated `DeleteTransaction` to recalculate parent investment
  - Added `reverseBuyTransaction` helper for buy reversal
  - Added `reverseSellTransaction` helper for sell reversal
  - Updated `DeleteInvestment` to cascade delete transactions/lots
  - Removed quantity=0 restriction (allow force delete)

- [investment_transaction_repository.go](src/go-backend/domain/repository/investment_transaction_repository.go)
  - Added `DeleteByInvestmentID` interface method
  - Added `DeleteLotsByInvestmentID` interface method

- [investment_transaction_repository_impl.go](src/go-backend/domain/repository/investment_transaction_repository_impl.go)
  - Implemented `DeleteByInvestmentID`
  - Implemented `DeleteLotsByInvestmentID`

- [investment_transaction.go](src/go-backend/domain/models/investment_transaction.go)
  - Added `RealizedPNL` field for accurate sell reversal

### API (No Changes)

- Existing protobuf definitions already support delete operations
- No proto changes needed

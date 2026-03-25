package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"wealthjourney/domain/models"
	"wealthjourney/domain/repository"
	apperrors "wealthjourney/pkg/errors"
	v1 "wealthjourney/protobuf/v1"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// editTestDeps bundles all mocks returned by newEditTestService so that each
// test can register fine-grained expectations on individual mocks.
type editTestDeps struct {
	svc         *investmentService
	txRepo      *MockInvestmentTransactionRepository
	invRepo     *MockInvestmentRepository
	userRepo    *MockUserRepository
	walletSvc   *MockWalletService
}

// newEditTestService creates a fresh investmentService with fresh mocks.
func newEditTestService(t *testing.T) editTestDeps {
	t.Helper()
	mockTxRepo := new(MockInvestmentTransactionRepository)
	mockInvRepo := new(MockInvestmentRepository)
	mockUserRepo := new(MockUserRepository)
	mockWalletSvc := new(MockWalletService)

	svc := NewInvestmentService(
		mockInvRepo,
		new(MockWalletRepository),
		mockTxRepo,
		new(MockMarketDataService),
		mockUserRepo,
		new(MockFXRateService),
		nil, // currencyCache — nil is safe for unit tests
		mockWalletSvc,
		nil, // portfolioHistoryRepo
	).(*investmentService)

	return editTestDeps{
		svc:       svc,
		txRepo:    mockTxRepo,
		invRepo:   mockInvRepo,
		userRepo:  mockUserRepo,
		walletSvc: mockWalletSvc,
	}
}

// pastDate returns a Unix timestamp one week in the past — always valid.
func pastDate() int64 {
	return time.Now().Add(-7 * 24 * time.Hour).Unix()
}

// futureDate returns a Unix timestamp 24h in the future — always invalid.
func futureDate() int64 {
	return time.Now().Add(24 * time.Hour).Unix()
}

// setupEnrichMocks registers user-repo and investment-repo mock calls required
// by enrichTransactionProto and enrichInvestmentProto. Both methods call
// userRepo.GetByID. If the currencies match, no FX call is made.
func (d *editTestDeps) setupEnrichMocks(ctx context.Context, userID int32) {
	user := &models.User{ID: userID, PreferredCurrency: "USD"}
	// enrichTransactionProto calls userRepo.GetByID
	d.userRepo.On("GetByID", ctx, userID).Return(user, nil).Maybe()
}

// --------------------------------------------------------------------------
// TestEditTransaction_InvalidTransactionID
// --------------------------------------------------------------------------

// TestEditTransaction_InvalidTransactionID verifies that a transactionID <= 0
// is rejected with a validation error before any repo calls are made.
func TestEditTransaction_InvalidTransactionID(t *testing.T) {
	d := newEditTestService(t)
	ctx := context.Background()

	_, err := d.svc.EditTransaction(ctx, 0, 1, &v1.EditInvestmentTransactionRequest{
		Quantity:        10000,
		Price:           15000000,
		TransactionDate: pastDate(),
	})

	assert.Error(t, err)
	var validationErr apperrors.ValidationError
	assert.True(t, errors.As(err, &validationErr) || isIDValidationError(err),
		"expected ID-level error, got %T: %v", err, err)
}

// TestEditTransaction_InvalidUserID verifies that a userID <= 0 is rejected.
func TestEditTransaction_InvalidUserID(t *testing.T) {
	d := newEditTestService(t)
	ctx := context.Background()

	_, err := d.svc.EditTransaction(ctx, 1, 0, &v1.EditInvestmentTransactionRequest{
		Quantity:        10000,
		Price:           15000000,
		TransactionDate: pastDate(),
	})

	assert.Error(t, err)
}

// isIDValidationError checks if an error is a ValidationError or NotFoundError
// at the validator.ID level (lenient assertion for ID validation).
func isIDValidationError(err error) bool {
	var ve apperrors.ValidationError
	var ne apperrors.NotFoundError
	return errors.As(err, &ve) || errors.As(err, &ne)
}

// --------------------------------------------------------------------------
// TestEditTransaction_TransactionNotOwnedByUser
// --------------------------------------------------------------------------

// TestEditTransaction_TransactionNotOwnedByUser verifies that when
// GetByIDForUser returns a not-found error, EditTransaction propagates it
// and makes no further mutations.
func TestEditTransaction_TransactionNotOwnedByUser(t *testing.T) {
	d := newEditTestService(t)
	ctx := context.Background()

	notFoundErr := apperrors.NewNotFoundError("transaction")
	d.txRepo.On("GetByIDForUser", ctx, int32(99), int32(1)).Return(nil, notFoundErr)

	_, err := d.svc.EditTransaction(ctx, 99, 1, &v1.EditInvestmentTransactionRequest{
		Quantity:        10000,
		Price:           15000000,
		TransactionDate: pastDate(),
	})

	assert.Error(t, err)
	var nfe apperrors.NotFoundError
	assert.True(t, errors.As(err, &nfe), "expected NotFoundError, got %T: %v", err, err)
	d.txRepo.AssertExpectations(t)
	d.txRepo.AssertNotCalled(t, "Delete")
	d.txRepo.AssertNotCalled(t, "Create")
}

// --------------------------------------------------------------------------
// TestEditTransaction_TransactionDateInFuture
// --------------------------------------------------------------------------

// TestEditTransaction_TransactionDateInFuture verifies that a transaction date
// in the future is rejected with a ValidationError.
func TestEditTransaction_TransactionDateInFuture(t *testing.T) {
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
		Cost:         15000000000,
		LotID:        &lotID,
	}
	investment := createTestInvestment(5, 1, "AAPL", 10000, 15000000, 15000000000)

	d.txRepo.On("GetByIDForUser", ctx, int32(1), int32(1)).Return(oldTx, nil)
	d.invRepo.On("GetByID", ctx, int32(5)).Return(investment, nil)

	// buy→buy with lot: validateBuyQuantityReduction is called
	lot := &models.InvestmentLot{
		ID:                lotID,
		Quantity:          10000,
		RemainingQuantity: 10000,
	}
	d.txRepo.On("GetLotByID", ctx, lotID).Return(lot, nil)

	_, err := d.svc.EditTransaction(ctx, 1, 1, &v1.EditInvestmentTransactionRequest{
		Type:            v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_BUY,
		Quantity:        10000,
		Price:           15000000,
		TransactionDate: futureDate(), // INVALID
	})

	assert.Error(t, err)
	var ve apperrors.ValidationError
	assert.True(t, errors.As(err, &ve), "expected ValidationError for future date, got %T: %v", err, err)
	d.txRepo.AssertExpectations(t)
	d.txRepo.AssertNotCalled(t, "Delete")
	d.txRepo.AssertNotCalled(t, "Create")
}

// --------------------------------------------------------------------------
// TestEditTransaction_BuyToBuy_QuantityReducedBelowSold
// --------------------------------------------------------------------------

// TestEditTransaction_BuyToBuy_QuantityReducedBelowSold verifies the guard:
// if 30 units were already sold from this lot, reducing quantity to 20 is rejected.
func TestEditTransaction_BuyToBuy_QuantityReducedBelowSold(t *testing.T) {
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
		Cost:         15000000000,
		LotID:        &lotID,
	}
	investment := createTestInvestment(5, 1, "AAPL", 7000, 15000000, 10500000000)

	lot := &models.InvestmentLot{
		ID:                lotID,
		Quantity:          10000,
		RemainingQuantity: 7000, // 3000 already sold
	}

	d.txRepo.On("GetByIDForUser", ctx, int32(1), int32(1)).Return(oldTx, nil)
	d.invRepo.On("GetByID", ctx, int32(5)).Return(investment, nil)
	d.txRepo.On("GetLotByID", ctx, lotID).Return(lot, nil)

	_, err := d.svc.EditTransaction(ctx, 1, 1, &v1.EditInvestmentTransactionRequest{
		Type:            v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_BUY,
		Quantity:        2000, // 2000 < 3000 (already sold) → INVALID
		Price:           15000000,
		TransactionDate: pastDate(),
	})

	assert.Error(t, err)
	var ve apperrors.ValidationError
	assert.True(t, errors.As(err, &ve), "expected ValidationError for qty below sold, got %T: %v", err, err)
	d.txRepo.AssertExpectations(t)
	d.txRepo.AssertNotCalled(t, "Delete")
	d.txRepo.AssertNotCalled(t, "Create")
}

// --------------------------------------------------------------------------
// TestEditTransaction_BuyToSell_LotAlreadyConsumed
// --------------------------------------------------------------------------

// TestEditTransaction_BuyToSell_LotAlreadyConsumed verifies that changing a buy
// transaction to sell is blocked when any units from the lot have already been sold.
func TestEditTransaction_BuyToSell_LotAlreadyConsumed(t *testing.T) {
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
		Cost:         15000000000,
		LotID:        &lotID,
	}
	investment := createTestInvestment(5, 1, "AAPL", 7000, 15000000, 10500000000)

	lot := &models.InvestmentLot{
		ID:                lotID,
		Quantity:          10000,
		RemainingQuantity: 7000, // 3000 already sold
	}

	d.txRepo.On("GetByIDForUser", ctx, int32(1), int32(1)).Return(oldTx, nil)
	d.invRepo.On("GetByID", ctx, int32(5)).Return(investment, nil)
	d.txRepo.On("GetLotByID", ctx, lotID).Return(lot, nil)

	_, err := d.svc.EditTransaction(ctx, 1, 1, &v1.EditInvestmentTransactionRequest{
		Type:            v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_SELL,
		Quantity:        5000,
		Price:           18000000,
		TransactionDate: pastDate(),
	})

	assert.Error(t, err)
	var ve apperrors.ValidationError
	assert.True(t, errors.As(err, &ve), "expected ValidationError for buy→sell with consumed lot, got %T: %v", err, err)
	d.txRepo.AssertExpectations(t)
}

// --------------------------------------------------------------------------
// TestEditTransaction_BuyToBuy_HappyPath
// --------------------------------------------------------------------------

// TestEditTransaction_BuyToBuy_HappyPath verifies editing a buy transaction
// (same type, new quantity and price) succeeds end-to-end:
//  1. Reverse old buy (update lot + investment)
//  2. Soft-delete old transaction
//  3. Process new buy (create lot, create transaction, update investment)
//  4. Return success response with updated investment
func TestEditTransaction_BuyToBuy_HappyPath(t *testing.T) {
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
		RemainingQuantity: 10000, // nothing sold
		TotalCost:         150000000,
		AverageCost:       15000000,
	}

	newTxID := int32(2)
	newTx := &models.InvestmentTransaction{
		ID:           newTxID,
		InvestmentID: 5,
		UserID:       1,
		Type:         int32(v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_BUY),
		Quantity:     20000,
		Price:        16000000,
		Cost:         320000000,
		LotID:        &lotID,
	}

	// --- ownership check ---
	d.txRepo.On("GetByIDForUser", ctx, int32(1), int32(1)).Return(oldTx, nil)
	// --- parent investment (first GetByID) ---
	d.invRepo.On("GetByID", ctx, int32(5)).Return(investment, nil).Once()
	// --- buy→buy lot guard ---
	d.txRepo.On("GetLotByID", ctx, lotID).Return(lot, nil)
	// --- reverseBuyTransaction: UpdateLot ---
	d.txRepo.On("UpdateLot", ctx, mock.AnythingOfType("*models.InvestmentLot")).Return(nil)
	// --- reverseBuyTransaction: Update investment ---
	d.invRepo.On("Update", ctx, mock.AnythingOfType("*models.Investment")).Return(nil)
	// --- soft-delete old transaction ---
	d.txRepo.On("Delete", ctx, int32(1)).Return(nil)
	// --- re-fetch investment after reversal (second GetByID) ---
	d.invRepo.On("GetByID", ctx, int32(5)).Return(investment, nil).Once()
	// --- processBuyTransaction: GetOpenLots (no open lots → create new lot) ---
	d.txRepo.On("GetOpenLots", ctx, int32(5)).Return([]*models.InvestmentLot{}, nil)
	// --- processBuyTransaction: CreateLot ---
	d.txRepo.On("CreateLot", ctx, mock.AnythingOfType("*models.InvestmentLot")).Return(nil).Run(
		func(args mock.Arguments) {
			l := args.Get(1).(*models.InvestmentLot)
			l.ID = 11
		},
	)
	// --- processBuyTransaction: Create transaction ---
	d.txRepo.On("Create", ctx, mock.AnythingOfType("*models.InvestmentTransaction")).Return(nil).Run(
		func(args mock.Arguments) {
			tx := args.Get(1).(*models.InvestmentTransaction)
			tx.ID = newTxID
		},
	)
	// --- ListByInvestmentID: get newest transaction for response ---
	d.txRepo.On("ListByInvestmentID", ctx, int32(5), (*v1.InvestmentTransactionType)(nil), repository.ListOptions{
		Limit:   1,
		OrderBy: "created_at",
		Order:   "desc",
	}).Return([]*models.InvestmentTransaction{newTx}, 1, nil)
	// --- enrichTransactionProto and enrichInvestmentProto call userRepo.GetByID ---
	d.setupEnrichMocks(ctx, 1)

	resp, err := d.svc.EditTransaction(ctx, 1, 1, &v1.EditInvestmentTransactionRequest{
		Type:            v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_BUY,
		Quantity:        20000,
		Price:           16000000,
		Fees:            0,
		TransactionDate: pastDate(),
		Notes:           "updated buy",
	})

	assert.NoError(t, err)
	assert.NotNil(t, resp)
	assert.True(t, resp.Success)
	assert.Equal(t, "Transaction updated successfully", resp.Message)
	assert.NotEmpty(t, resp.Timestamp)
	assert.NotNil(t, resp.Data, "response Data (new transaction) should be set")
	assert.NotNil(t, resp.UpdatedInvestment, "response UpdatedInvestment should be set")

	d.txRepo.AssertExpectations(t)
	d.invRepo.AssertExpectations(t)
}

// --------------------------------------------------------------------------
// TestEditTransaction_BuyToSell_LotIntact_HappyPath
// --------------------------------------------------------------------------

// TestEditTransaction_BuyToSell_LotIntact_HappyPath verifies that changing
// a buy transaction to sell is allowed when NO units from the lot have been sold
// AND there is remaining quantity from other lots.
//
// Scenario: Investment has 20000 total qty (10000 from lot A, 10000 from lot B).
// User edits lot A's buy transaction to be a sell of 5000.
//   - After reversing lot A's buy: investment qty goes from 20000 to 10000 (lot B remains)
//   - Fresh re-fetch of investment returns qty=10000
//   - processSellTransaction of 5000 from qty=10000 succeeds
func TestEditTransaction_BuyToSell_LotIntact_HappyPath(t *testing.T) {
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
	// Investment has 20000 qty total (from 2 buys: lot A=10000, lot B=10000)
	investment := createTestInvestment(5, 1, "AAPL", 20000, 15000000, 300000000)

	lot := &models.InvestmentLot{
		ID:                lotID,
		InvestmentID:      5,
		Quantity:          10000,
		RemainingQuantity: 10000, // nothing sold from lot A — type change allowed
		TotalCost:         150000000,
		AverageCost:       15000000,
	}

	newTxID := int32(2)
	newSellTx := &models.InvestmentTransaction{
		ID:           newTxID,
		InvestmentID: 5,
		UserID:       1,
		Type:         int32(v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_SELL),
		Quantity:     5000,
		Price:        18000000,
	}

	// After reversal, fresh investment has qty=10000 (lot B remains)
	freshInvestment := createTestInvestment(5, 1, "AAPL", 10000, 15000000, 150000000)

	// --- ownership check ---
	d.txRepo.On("GetByIDForUser", ctx, int32(1), int32(1)).Return(oldTx, nil)
	// --- parent investment (first GetByID call) ---
	d.invRepo.On("GetByID", ctx, int32(5)).Return(investment, nil).Once()
	// --- buy→sell guard: GetLotByID (alreadySold = 0, allowed) ---
	d.txRepo.On("GetLotByID", ctx, lotID).Return(lot, nil)
	// --- reverseBuyTransaction: UpdateLot ---
	d.txRepo.On("UpdateLot", ctx, mock.AnythingOfType("*models.InvestmentLot")).Return(nil)
	// --- reverseBuyTransaction: Update investment ---
	d.invRepo.On("Update", ctx, mock.AnythingOfType("*models.Investment")).Return(nil)
	// --- soft-delete ---
	d.txRepo.On("Delete", ctx, int32(1)).Return(nil)
	// --- re-fetch investment after reversal (second GetByID call) ---
	d.invRepo.On("GetByID", ctx, int32(5)).Return(freshInvestment, nil).Once()
	// --- processSellTransaction: GetOpenLots (lot B still open) ---
	openLotForSell := &models.InvestmentLot{
		ID:                13, // lot B
		InvestmentID:      5,
		Quantity:          10000,
		RemainingQuantity: 10000,
		AverageCost:       15000000,
	}
	d.txRepo.On("GetOpenLots", ctx, int32(5)).Return([]*models.InvestmentLot{openLotForSell}, nil)
	// --- processSellTransaction: UpdateLot (FIFO consumption) ---
	// Already mocked above (AnythingOfType)
	// --- processSellTransaction: Create sell transaction ---
	d.txRepo.On("Create", ctx, mock.AnythingOfType("*models.InvestmentTransaction")).Return(nil).Run(
		func(args mock.Arguments) {
			tx := args.Get(1).(*models.InvestmentTransaction)
			tx.ID = newTxID
		},
	)
	// --- ListByInvestmentID ---
	d.txRepo.On("ListByInvestmentID", ctx, int32(5), (*v1.InvestmentTransactionType)(nil), repository.ListOptions{
		Limit:   1,
		OrderBy: "created_at",
		Order:   "desc",
	}).Return([]*models.InvestmentTransaction{newSellTx}, 1, nil)
	// --- enrich mocks ---
	d.setupEnrichMocks(ctx, 1)

	resp, err := d.svc.EditTransaction(ctx, 1, 1, &v1.EditInvestmentTransactionRequest{
		Type:            v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_SELL,
		Quantity:        5000,
		Price:           18000000,
		Fees:            0,
		TransactionDate: pastDate(),
	})

	assert.NoError(t, err)
	assert.NotNil(t, resp)
	assert.True(t, resp.Success)
	assert.Equal(t, "Transaction updated successfully", resp.Message)
	assert.NotNil(t, resp.UpdatedInvestment)

	d.txRepo.AssertExpectations(t)
	d.invRepo.AssertExpectations(t)
}

// --------------------------------------------------------------------------
// TestEditTransaction_DividendEdit_HappyPath
// --------------------------------------------------------------------------

// TestEditTransaction_DividendEdit_HappyPath verifies editing a dividend
// transaction: reverse old dividend (subtract TotalDividends) + create new.
func TestEditTransaction_DividendEdit_HappyPath(t *testing.T) {
	d := newEditTestService(t)
	ctx := context.Background()

	oldTx := &models.InvestmentTransaction{
		ID:           3,
		InvestmentID: 5,
		UserID:       1,
		Type:         int32(v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_DIVIDEND),
		Quantity:     10000,
		Price:        50000,
		Cost:         500000000,
		LotID:        nil,
	}
	investment := &models.Investment{
		ID:             5,
		UserID:         1,
		Symbol:         "AAPL",
		Type:           int32(v1.InvestmentType_INVESTMENT_TYPE_STOCK),
		Currency:       "USD",
		Quantity:       10000,
		TotalDividends: 500000000,
	}

	// --- ownership check ---
	d.txRepo.On("GetByIDForUser", ctx, int32(3), int32(1)).Return(oldTx, nil)
	// --- parent investment (first GetByID) ---
	d.invRepo.On("GetByID", ctx, int32(5)).Return(investment, nil).Once()
	// No lot guard (dividend, LotID nil)
	// --- reverseDividendTransaction: Update investment ---
	d.invRepo.On("Update", ctx, mock.AnythingOfType("*models.Investment")).Return(nil)
	// --- soft-delete ---
	d.txRepo.On("Delete", ctx, int32(3)).Return(nil)
	// --- re-fetch investment after reversal (second GetByID) ---
	d.invRepo.On("GetByID", ctx, int32(5)).Return(investment, nil).Once()
	// --- processDividendTransaction: Create dividend transaction ---
	d.txRepo.On("Create", ctx, mock.AnythingOfType("*models.InvestmentTransaction")).Return(nil).Run(
		func(args mock.Arguments) {
			tx := args.Get(1).(*models.InvestmentTransaction)
			tx.ID = 4
		},
	)
	// processDividendTransaction also calls investmentRepo.Update — already mocked above
	// --- enrich mocks ---
	d.setupEnrichMocks(ctx, 1)

	resp, err := d.svc.EditTransaction(ctx, 3, 1, &v1.EditInvestmentTransactionRequest{
		Type:            v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_DIVIDEND,
		Quantity:        10000,
		Price:           60000,
		Fees:            0,
		TransactionDate: pastDate(),
	})

	assert.NoError(t, err)
	assert.NotNil(t, resp)
	assert.True(t, resp.Success)
	assert.Equal(t, "Transaction updated successfully", resp.Message)
	assert.NotNil(t, resp.Data, "dividend response must include the new transaction")
	assert.NotNil(t, resp.UpdatedInvestment)

	d.txRepo.AssertExpectations(t)
	d.invRepo.AssertExpectations(t)
}

// --------------------------------------------------------------------------
// TestEditTransaction_UseExistingTypeWhenUnspecified
// --------------------------------------------------------------------------

// TestEditTransaction_UseExistingTypeWhenUnspecified verifies that when req.Type
// is UNSPECIFIED (0), the old transaction type is preserved (dividend stays dividend).
func TestEditTransaction_UseExistingTypeWhenUnspecified(t *testing.T) {
	d := newEditTestService(t)
	ctx := context.Background()

	// Old transaction is a dividend
	oldTx := &models.InvestmentTransaction{
		ID:           3,
		InvestmentID: 5,
		UserID:       1,
		Type:         int32(v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_DIVIDEND),
		Quantity:     10000,
		Price:        50000,
		Cost:         500000000,
		LotID:        nil,
	}
	investment := &models.Investment{
		ID:             5,
		UserID:         1,
		Symbol:         "AAPL",
		Type:           int32(v1.InvestmentType_INVESTMENT_TYPE_STOCK),
		Currency:       "USD",
		Quantity:       10000,
		TotalDividends: 500000000,
	}

	d.txRepo.On("GetByIDForUser", ctx, int32(3), int32(1)).Return(oldTx, nil)
	d.invRepo.On("GetByID", ctx, int32(5)).Return(investment, nil).Once()
	d.invRepo.On("Update", ctx, mock.AnythingOfType("*models.Investment")).Return(nil)
	d.txRepo.On("Delete", ctx, int32(3)).Return(nil)
	d.invRepo.On("GetByID", ctx, int32(5)).Return(investment, nil).Once()
	d.txRepo.On("Create", ctx, mock.AnythingOfType("*models.InvestmentTransaction")).Return(nil).Run(
		func(args mock.Arguments) {
			tx := args.Get(1).(*models.InvestmentTransaction)
			tx.ID = 4
		},
	)
	d.setupEnrichMocks(ctx, 1)

	resp, err := d.svc.EditTransaction(ctx, 3, 1, &v1.EditInvestmentTransactionRequest{
		// Type is UNSPECIFIED — must inherit DIVIDEND from oldTx
		Type:            v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_UNSPECIFIED,
		Quantity:        10000,
		Price:           60000,
		TransactionDate: pastDate(),
	})

	assert.NoError(t, err)
	assert.NotNil(t, resp)
	assert.True(t, resp.Success)

	d.txRepo.AssertExpectations(t)
	d.invRepo.AssertExpectations(t)
}

// --------------------------------------------------------------------------
// TestEditTransaction_ReverseFailure_NoMutation
// --------------------------------------------------------------------------

// TestEditTransaction_BuyToSell_SingleLot_ProcessFailDoesNotDeleteOldTx verifies
// that when a BUY→SELL edit has only one lot and processSellTransaction fails
// (because reverseBuyTransaction zeroed the only lot, leaving no open lots),
// the old BUY transaction is NOT soft-deleted. This prevents the "investment
// transaction not found" error on retry and keeps the transaction list non-empty.
func TestEditTransaction_BuyToSell_SingleLot_ProcessFailDoesNotDeleteOldTx(t *testing.T) {
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
	// Investment has ONLY the qty from this one BUY transaction
	investment := createTestInvestment(5, 1, "AAPL", 10000, 15000000, 150000000)

	lot := &models.InvestmentLot{
		ID:                lotID,
		InvestmentID:      5,
		Quantity:          10000,
		RemainingQuantity: 10000, // nothing sold — type change to SELL is allowed by guard
		TotalCost:         150000000,
		AverageCost:       15000000,
	}

	// After reverseBuyTransaction, investment qty drops to 0.
	// processSellTransaction checks investment.Quantity < req.Quantity first,
	// so it fails with "insufficient quantity" before even reaching GetOpenLots.
	freshInvestment := createTestInvestment(5, 1, "AAPL", 0, 0, 0)

	// --- ownership check ---
	d.txRepo.On("GetByIDForUser", ctx, int32(1), int32(1)).Return(oldTx, nil)
	// --- parent investment (first GetByID) ---
	d.invRepo.On("GetByID", ctx, int32(5)).Return(investment, nil).Once()
	// --- buy→sell guard: GetLotByID (alreadySold = 0, allowed) ---
	d.txRepo.On("GetLotByID", ctx, lotID).Return(lot, nil)
	// --- reverseBuyTransaction: UpdateLot (zeros the lot) ---
	d.txRepo.On("UpdateLot", ctx, mock.AnythingOfType("*models.InvestmentLot")).Return(nil)
	// --- reverseBuyTransaction: Update investment ---
	d.invRepo.On("Update", ctx, mock.AnythingOfType("*models.Investment")).Return(nil)
	// --- re-fetch investment after reversal (second GetByID) ---
	d.invRepo.On("GetByID", ctx, int32(5)).Return(freshInvestment, nil).Once()
	// NOTE: processSellTransaction fails at quantity check (0 < 5000) before GetOpenLots

	_, err := d.svc.EditTransaction(ctx, 1, 1, &v1.EditInvestmentTransactionRequest{
		Type:            v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_SELL,
		Quantity:        5000,
		Price:           18000000,
		Fees:            0,
		TransactionDate: pastDate(),
	})

	// Must return an error (no open lots)
	assert.Error(t, err)
	// Critical: Delete must NOT have been called — old tx must survive the failure
	d.txRepo.AssertNotCalled(t, "Delete")
	d.txRepo.AssertNotCalled(t, "Create")
	d.txRepo.AssertExpectations(t)
	d.invRepo.AssertExpectations(t)
}

// TestEditTransaction_ReverseFailure_NoMutation verifies that if the reversal
// step fails (UpdateLot returns error), the operation aborts and neither
// soft-delete nor create is performed.
func TestEditTransaction_ReverseFailure_NoMutation(t *testing.T) {
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
		Quantity:          10000,
		RemainingQuantity: 10000,
		TotalCost:         150000000,
		AverageCost:       15000000,
	}

	d.txRepo.On("GetByIDForUser", ctx, int32(1), int32(1)).Return(oldTx, nil)
	d.invRepo.On("GetByID", ctx, int32(5)).Return(investment, nil)
	d.txRepo.On("GetLotByID", ctx, lotID).Return(lot, nil)

	// reverseBuyTransaction: UpdateLot FAILS
	dbErr := errors.New("database error")
	d.txRepo.On("UpdateLot", ctx, mock.AnythingOfType("*models.InvestmentLot")).Return(dbErr)

	_, err := d.svc.EditTransaction(ctx, 1, 1, &v1.EditInvestmentTransactionRequest{
		Type:            v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_BUY,
		Quantity:        20000,
		Price:           16000000,
		TransactionDate: pastDate(),
	})

	assert.Error(t, err)
	d.txRepo.AssertNotCalled(t, "Delete")
	d.txRepo.AssertNotCalled(t, "Create")
	d.txRepo.AssertExpectations(t)
}

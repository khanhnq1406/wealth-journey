package service

import (
	"context"
	"errors"
	"testing"

	"wealthjourney/domain/models"
	apperrors "wealthjourney/pkg/errors"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// TestValidateBuyQuantityReduction tests the validateBuyQuantityReduction helper.
//
// Business rule: when editing a BUY transaction, the new quantity must be >= the
// number of units already consumed by SELL transactions from the associated lot.
// Formally: alreadySold = lot.Quantity - lot.RemainingQuantity
//           newQuantity must be >= alreadySold
//
// This prevents lot.RemainingQuantity from going negative, which would corrupt
// FIFO cost-basis accounting.

func newTestInvestmentService() *investmentService {
	return NewInvestmentService(
		new(MockInvestmentRepository),
		new(MockWalletRepository),
		new(MockInvestmentTransactionRepository),
		new(MockMarketDataService),
		new(MockUserRepository),
		new(MockFXRateService),
		nil,
		new(MockWalletService),
		nil,
	).(*investmentService)
}

// TestValidateBuyQuantityReduction_NilLotID verifies that when the transaction
// has no associated lot (LotID == nil), no validation is performed and nil is returned.
func TestValidateBuyQuantityReduction_NilLotID(t *testing.T) {
	svc := newTestInvestmentService()
	ctx := context.Background()

	tx := &models.InvestmentTransaction{
		ID:    1,
		LotID: nil, // No lot tracking
	}

	err := svc.validateBuyQuantityReduction(ctx, tx, 50)
	assert.NoError(t, err)
}

// TestValidateBuyQuantityReduction_NothingSold verifies that when nothing has been
// sold from the lot (RemainingQuantity == Quantity), any newQuantity is accepted.
func TestValidateBuyQuantityReduction_NothingSold(t *testing.T) {
	mockTxRepo := new(MockInvestmentTransactionRepository)
	svc := NewInvestmentService(
		new(MockInvestmentRepository),
		new(MockWalletRepository),
		mockTxRepo,
		new(MockMarketDataService),
		new(MockUserRepository),
		new(MockFXRateService),
		nil,
		new(MockWalletService),
		nil,
	).(*investmentService)

	ctx := context.Background()
	lotID := int32(10)

	tx := &models.InvestmentTransaction{
		ID:    1,
		LotID: &lotID,
	}

	lot := &models.InvestmentLot{
		ID:                lotID,
		Quantity:          100,
		RemainingQuantity: 100, // Nothing sold
	}

	mockTxRepo.On("GetLotByID", ctx, lotID).Return(lot, nil)

	// Even reducing to 1 should be fine when nothing was sold
	err := svc.validateBuyQuantityReduction(ctx, tx, 1)
	assert.NoError(t, err)
	mockTxRepo.AssertExpectations(t)
}

// TestValidateBuyQuantityReduction_ReduceBelowSold verifies that reducing the
// quantity below the already-sold amount returns a ValidationError.
// Example: bought 100, sold 30 (alreadySold=30), trying to reduce to 20 → error.
func TestValidateBuyQuantityReduction_ReduceBelowSold(t *testing.T) {
	mockTxRepo := new(MockInvestmentTransactionRepository)
	svc := NewInvestmentService(
		new(MockInvestmentRepository),
		new(MockWalletRepository),
		mockTxRepo,
		new(MockMarketDataService),
		new(MockUserRepository),
		new(MockFXRateService),
		nil,
		new(MockWalletService),
		nil,
	).(*investmentService)

	ctx := context.Background()
	lotID := int32(10)

	tx := &models.InvestmentTransaction{
		ID:    1,
		LotID: &lotID,
	}

	lot := &models.InvestmentLot{
		ID:                lotID,
		Quantity:          100,
		RemainingQuantity: 70, // 30 already sold
	}

	mockTxRepo.On("GetLotByID", ctx, lotID).Return(lot, nil)

	// Trying to reduce to 20 when 30 are already sold → must fail
	err := svc.validateBuyQuantityReduction(ctx, tx, 20)
	assert.Error(t, err)

	var validationErr apperrors.ValidationError
	assert.True(t, errors.As(err, &validationErr), "expected ValidationError, got: %T", err)
	mockTxRepo.AssertExpectations(t)
}

// TestValidateBuyQuantityReduction_ReduceToExactSold verifies that reducing to
// exactly the already-sold amount is accepted (boundary: newQuantity == alreadySold).
// Example: bought 100, sold 30, reduce to exactly 30 → allowed.
func TestValidateBuyQuantityReduction_ReduceToExactSold(t *testing.T) {
	mockTxRepo := new(MockInvestmentTransactionRepository)
	svc := NewInvestmentService(
		new(MockInvestmentRepository),
		new(MockWalletRepository),
		mockTxRepo,
		new(MockMarketDataService),
		new(MockUserRepository),
		new(MockFXRateService),
		nil,
		new(MockWalletService),
		nil,
	).(*investmentService)

	ctx := context.Background()
	lotID := int32(10)

	tx := &models.InvestmentTransaction{
		ID:    1,
		LotID: &lotID,
	}

	lot := &models.InvestmentLot{
		ID:                lotID,
		Quantity:          100,
		RemainingQuantity: 70, // 30 already sold
	}

	mockTxRepo.On("GetLotByID", ctx, lotID).Return(lot, nil)

	// Reducing to exactly 30 (== alreadySold) must be allowed
	err := svc.validateBuyQuantityReduction(ctx, tx, 30)
	assert.NoError(t, err)
	mockTxRepo.AssertExpectations(t)
}

// TestValidateBuyQuantityReduction_ReduceAboveSold verifies that reducing to a
// quantity above the already-sold amount is accepted.
// Example: bought 100, sold 30, reduce to 50 → allowed.
func TestValidateBuyQuantityReduction_ReduceAboveSold(t *testing.T) {
	mockTxRepo := new(MockInvestmentTransactionRepository)
	svc := NewInvestmentService(
		new(MockInvestmentRepository),
		new(MockWalletRepository),
		mockTxRepo,
		new(MockMarketDataService),
		new(MockUserRepository),
		new(MockFXRateService),
		nil,
		new(MockWalletService),
		nil,
	).(*investmentService)

	ctx := context.Background()
	lotID := int32(10)

	tx := &models.InvestmentTransaction{
		ID:    1,
		LotID: &lotID,
	}

	lot := &models.InvestmentLot{
		ID:                lotID,
		Quantity:          100,
		RemainingQuantity: 70, // 30 already sold
	}

	mockTxRepo.On("GetLotByID", ctx, lotID).Return(lot, nil)

	// Reducing to 50 when only 30 were sold → allowed
	err := svc.validateBuyQuantityReduction(ctx, tx, 50)
	assert.NoError(t, err)
	mockTxRepo.AssertExpectations(t)
}

// TestValidateBuyQuantityReduction_GetLotError verifies that when the repository
// returns an error, it is wrapped as an InternalError and propagated.
func TestValidateBuyQuantityReduction_GetLotError(t *testing.T) {
	mockTxRepo := new(MockInvestmentTransactionRepository)
	svc := NewInvestmentService(
		new(MockInvestmentRepository),
		new(MockWalletRepository),
		mockTxRepo,
		new(MockMarketDataService),
		new(MockUserRepository),
		new(MockFXRateService),
		nil,
		new(MockWalletService),
		nil,
	).(*investmentService)

	ctx := context.Background()
	lotID := int32(10)

	tx := &models.InvestmentTransaction{
		ID:    1,
		LotID: &lotID,
	}

	mockTxRepo.On("GetLotByID", ctx, lotID).Return(nil, errors.New("db connection error"))

	err := svc.validateBuyQuantityReduction(ctx, tx, 50)
	assert.Error(t, err)

	var internalErr apperrors.InternalError
	assert.True(t, errors.As(err, &internalErr), "expected InternalError, got: %T", err)
	mockTxRepo.AssertExpectations(t)
}

// TestValidateBuyQuantityReduction_AllSoldReduceToZero verifies the edge case
// where all shares are sold (RemainingQuantity==0) and user tries to reduce to 0.
// alreadySold = 100 - 0 = 100; newQuantity = 0 < 100 → must fail.
func TestValidateBuyQuantityReduction_AllSoldReduceToZero(t *testing.T) {
	mockTxRepo := new(MockInvestmentTransactionRepository)
	svc := NewInvestmentService(
		new(MockInvestmentRepository),
		new(MockWalletRepository),
		mockTxRepo,
		new(MockMarketDataService),
		new(MockUserRepository),
		new(MockFXRateService),
		nil,
		new(MockWalletService),
		nil,
	).(*investmentService)

	ctx := context.Background()
	lotID := int32(10)

	tx := &models.InvestmentTransaction{
		ID:    1,
		LotID: &lotID,
	}

	lot := &models.InvestmentLot{
		ID:                lotID,
		Quantity:          100,
		RemainingQuantity: 0, // All sold
	}

	mockTxRepo.On("GetLotByID", ctx, lotID).Return(lot, nil)

	err := svc.validateBuyQuantityReduction(ctx, tx, 0)
	assert.Error(t, err)

	var validationErr apperrors.ValidationError
	assert.True(t, errors.As(err, &validationErr), "expected ValidationError, got: %T", err)
	mockTxRepo.AssertExpectations(t)
}

// TestValidateBuyQuantityReduction_NoSoldLargeQuantity verifies that when
// nothing has been sold, even increasing quantity has no issues.
func TestValidateBuyQuantityReduction_NoSoldIncrease(t *testing.T) {
	mockTxRepo := new(MockInvestmentTransactionRepository)
	svc := NewInvestmentService(
		new(MockInvestmentRepository),
		new(MockWalletRepository),
		mockTxRepo,
		new(MockMarketDataService),
		new(MockUserRepository),
		new(MockFXRateService),
		nil,
		new(MockWalletService),
		nil,
	).(*investmentService)

	ctx := context.Background()
	lotID := int32(10)

	tx := &models.InvestmentTransaction{
		ID:    1,
		LotID: &lotID,
	}

	lot := &models.InvestmentLot{
		ID:                lotID,
		Quantity:          100,
		RemainingQuantity: 100, // Nothing sold
	}

	mockTxRepo.On("GetLotByID", ctx, lotID).Return(lot, nil)

	// Increasing quantity is always fine
	err := svc.validateBuyQuantityReduction(ctx, tx, 200)
	assert.NoError(t, err)
	mockTxRepo.AssertExpectations(t)
}

// Ensure mock satisfies the interface (compile-time check)
var _ = mock.Mock{}

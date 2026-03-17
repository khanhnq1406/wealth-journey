package service

import (
	"context"
	"testing"
	"time"

	"wealthjourney/domain/models"
	apperrors "wealthjourney/pkg/errors"

	v1 "wealthjourney/protobuf/v1"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// This file documents the correct FIFO cost basis behavior for sell transactions.
//
// KEY PRINCIPLE: When selling shares, TotalCost and AverageCost MUST NOT be recalculated.
//
// Why?
// - TotalCost represents the cumulative cost of ALL purchases (cost basis)
// - AverageCost is the weighted average of all buy transactions
// - When selling, we only decrease Quantity
// - RealizedPNL increases by (sell_price - average_cost) * quantity_sold
//
// Example scenario:
// 1. Buy 100 shares @ $150 = $15,000 total cost
//    Quantity: 100, TotalCost: $15,000, AverageCost: $150
//
// 2. Buy 50 shares @ $160 = $8,000 total cost
//    Quantity: 150, TotalCost: $23,000, AverageCost: $153.33
//
// 3. Sell 30 shares @ $170
//    - Proceeds: 30 * $170 = $5,100
//    - Cost basis: 30 * $153.33 = $4,600 (using FIFO from oldest lot)
//    - Realized PNL: $5,100 - $4,600 = $500
//    - NEW state: Quantity: 120, TotalCost: $23,000 (UNCHANGED!), AverageCost: $153.33 (UNCHANGED!)
//
// If we recalculated TotalCost on sell (WRONG):
//    - TotalCost: 120 * $153.33 = $18,400 (WRONG! Lost cost basis data)
//    - This breaks future PNL calculations
//
// Edge case: Selling all shares
//  - Quantity becomes 0
//  - TotalCost and AverageCost should be preserved for historical tracking
//  - They won't be used for PNL calculations (since Quantity = 0)
//  - This maintains accurate cost basis data if more shares are purchased later

// TestSellTransaction_CostBasisPreserved verifies that TotalCost and AverageCost
// are NOT recalculated when selling shares, maintaining proper FIFO cost basis.
func TestSellTransaction_CostBasisPreserved(t *testing.T) {
	// Setup
	mockWalletRepo := new(MockWalletRepository)
	mockInvestmentRepo := new(MockInvestmentRepository)
	mockTxRepo := new(MockInvestmentTransactionRepository)
	mockMarketDataService := new(MockMarketDataService)
	mockUserRepo := new(MockUserRepository)
	mockFXRateSvc := new(MockFXRateService)

	service := NewInvestmentService(
		mockInvestmentRepo,
		mockWalletRepo,
		mockTxRepo,
		mockMarketDataService,
		mockUserRepo,
		mockFXRateSvc,
		nil, // currencyCache not needed for this test
		new(MockWalletService),
		nil, // portfolioHistoryRepo not needed for this test
	).(*investmentService)

	ctx := context.Background()
	userID := int32(1)
	walletID := int32(1)
	investmentID := int32(1)

	// Initial state: Bought 100 shares @ $150 = $15,000 total cost
	// Quantity: 10000 (1 share with 4 decimals), TotalCost: $15,000, AverageCost: $150
	investment := &models.Investment{
		ID:          investmentID,
		WalletID:    &walletID,
		Symbol:      "AAPL",
		Name:        "Apple Inc.",
		Type:        int32(v1.InvestmentType_INVESTMENT_TYPE_STOCK),
		Quantity:    10000,  // 1 share (4 decimal places)
		AverageCost: 1500000, // $150.00
		TotalCost:   15000000000, // $15,000.00
		Currency:    "USD",
	}

	// Create an open lot from previous purchase
	lot := &models.InvestmentLot{
		ID:                1,
		InvestmentID:      investmentID,
		Quantity:          10000,
		RemainingQuantity: 10000,
		AverageCost:       1500000, // $150.00
		TotalCost:         15000000000, // $15,000.00
		PurchasedAt:       time.Now().Add(-24 * time.Hour),
	}

	// Sell 30 shares @ $170
	req := &v1.AddTransactionRequest{
		InvestmentId:     investmentID,
		Type:             v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_SELL,
		Quantity:         3000,  // 0.3 shares (4 decimal places)
		Price:            1700000, // $170.00
		Fees:             100,    // $1.00 fee
		TransactionDate:  time.Now().Unix(),
		Notes:            "Take profit",
	}

	// Expected values after sell
	expectedQuantity := int64(7000)  // 10000 - 3000 = 0.7 shares
	// Calculate expected realized PNL using the same formula as the service
	// For stocks: precision = 10000 (4 decimals)
	// quantityWholeUnits = 3000 / 10000 = 0.3 shares
	// lotCostBasis = 1500000 * 0.3 = 450000 (cents) = $4,500
	// lotSellValue = 1700000 * 0.3 = 510000 (cents) = $5,100
	// lotPNL = 510000 - 450000 = 60000 (cents) = $600
	// realizedPNL = 60000 - 100 (fees) = 59900 (cents) = $599.99
	expectedRealizedPNL := int64(59900)

	mockInvestmentRepo.On("GetByIDForUser", ctx, investmentID, userID).Return(investment, nil)
	mockInvestmentRepo.On("GetByID", ctx, investmentID).Return(investment, nil)
	mockTxRepo.On("GetOpenLots", ctx, investmentID).Return([]*models.InvestmentLot{lot}, nil)
	// For populateInvestmentCache
	mockUserRepo.On("GetByID", ctx, userID).Return(&models.User{ID: userID, PreferredCurrency: "USD"}, nil)
	mockTxRepo.On("UpdateLot", ctx, mock.MatchedBy(func(l *models.InvestmentLot) bool {
		return l.ID == 1 && l.RemainingQuantity == 7000
	})).Return(nil)
	mockTxRepo.On("Create", ctx, mock.AnythingOfType("*models.InvestmentTransaction")).Return(nil)
	mockTxRepo.On("ListByInvestmentID", ctx, investmentID, (*v1.InvestmentTransactionType)(nil), mock.Anything).Return([]*models.InvestmentTransaction{}, 0, nil)

	// CRITICAL ASSERTION: TotalCost and AverageCost should NOT change
	mockInvestmentRepo.On("Update", ctx, mock.MatchedBy(func(inv *models.Investment) bool {
		return inv.Quantity == expectedQuantity &&
			inv.TotalCost == investment.TotalCost && // MUST BE UNCHANGED
			inv.AverageCost == investment.AverageCost && // MUST BE UNCHANGED
			inv.RealizedPNL == expectedRealizedPNL
	})).Return(nil)

	// Execute
	response, err := service.AddTransaction(ctx, userID, req)

	// Assert
	assert.NoError(t, err)
	assert.NotNil(t, response)
	assert.True(t, response.Success)

	// Verify the investment state is correct
	assert.Equal(t, expectedQuantity, investment.Quantity, "Quantity should decrease")
	assert.Equal(t, int64(15000000000), investment.TotalCost, "TotalCost must remain unchanged")
	assert.Equal(t, int64(1500000), investment.AverageCost, "AverageCost must remain unchanged")
	assert.Equal(t, expectedRealizedPNL, investment.RealizedPNL, "RealizedPNL should increase")

	mockWalletRepo.AssertExpectations(t)
	mockInvestmentRepo.AssertExpectations(t)
	mockTxRepo.AssertExpectations(t)
}

// TestSellTransaction_SellAllShares verifies cost basis is preserved even when selling all shares
func TestSellTransaction_SellAllShares(t *testing.T) {
	// Setup
	mockWalletRepo := new(MockWalletRepository)
	mockInvestmentRepo := new(MockInvestmentRepository)
	mockTxRepo := new(MockInvestmentTransactionRepository)
	mockMarketDataService := new(MockMarketDataService)
	mockUserRepo := new(MockUserRepository)
	mockFXRateSvc := new(MockFXRateService)

	service := NewInvestmentService(
		mockInvestmentRepo,
		mockWalletRepo,
		mockTxRepo,
		mockMarketDataService,
		mockUserRepo,
		mockFXRateSvc,
		nil, // currencyCache not needed for this test
		new(MockWalletService),
		nil, // portfolioHistoryRepo not needed for this test
	).(*investmentService)

	ctx := context.Background()
	userID := int32(1)
	walletID := int32(1)
	investmentID := int32(1)

	// Initial state: Bought 100 shares @ $150 = $15,000 total cost
	investment := &models.Investment{
		ID:          investmentID,
		WalletID:    &walletID,
		Symbol:      "AAPL",
		Name:        "Apple Inc.",
		Type:        int32(v1.InvestmentType_INVESTMENT_TYPE_STOCK),
		Quantity:    10000,
		AverageCost: 1500000,
		TotalCost:   15000000000,
		Currency:    "USD",
	}

	lot := &models.InvestmentLot{
		ID:                1,
		InvestmentID:      investmentID,
		Quantity:          10000,
		RemainingQuantity: 10000,
		AverageCost:       1500000,
		TotalCost:         15000000000,
		PurchasedAt:       time.Now().Add(-24 * time.Hour),
	}

	// Sell all shares
	req := &v1.AddTransactionRequest{
		InvestmentId:     investmentID,
		Type:             v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_SELL,
		Quantity:         10000, // Sell all
		Price:            1700000,
		Fees:             100,
		TransactionDate:  time.Now().Unix(),
		Notes:            "Complete exit",
	}

	mockInvestmentRepo.On("GetByIDForUser", ctx, investmentID, userID).Return(investment, nil)
	mockInvestmentRepo.On("GetByID", ctx, investmentID).Return(investment, nil)
	mockTxRepo.On("GetOpenLots", ctx, investmentID).Return([]*models.InvestmentLot{lot}, nil)
	// For populateInvestmentCache
	mockUserRepo.On("GetByID", ctx, userID).Return(&models.User{ID: userID, PreferredCurrency: "USD"}, nil)
	mockTxRepo.On("UpdateLot", ctx, mock.MatchedBy(func(l *models.InvestmentLot) bool {
		return l.ID == 1 && l.RemainingQuantity == 0
	})).Return(nil)
	mockTxRepo.On("Create", ctx, mock.AnythingOfType("*models.InvestmentTransaction")).Return(nil)
	mockTxRepo.On("ListByInvestmentID", ctx, investmentID, (*v1.InvestmentTransactionType)(nil), mock.Anything).Return([]*models.InvestmentTransaction{}, 0, nil)

	// CRITICAL: Even when Quantity = 0, TotalCost and AverageCost are preserved
	mockInvestmentRepo.On("Update", ctx, mock.MatchedBy(func(inv *models.Investment) bool {
		return inv.Quantity == 0 &&
			inv.TotalCost == investment.TotalCost && // PRESERVED for historical tracking
			inv.AverageCost == investment.AverageCost && // PRESERVED for historical tracking
			inv.RealizedPNL > 0
	})).Return(nil)

	// Execute
	response, err := service.AddTransaction(ctx, userID, req)

	// Assert
	assert.NoError(t, err)
	assert.NotNil(t, response)
	assert.True(t, response.Success)

	// Verify cost basis is preserved even at zero quantity
	assert.Equal(t, int64(0), investment.Quantity, "Quantity should be zero")
	assert.Equal(t, int64(15000000000), investment.TotalCost, "TotalCost must be preserved")
	assert.Equal(t, int64(1500000), investment.AverageCost, "AverageCost must be preserved")

	mockWalletRepo.AssertExpectations(t)
	mockInvestmentRepo.AssertExpectations(t)
	mockTxRepo.AssertExpectations(t)
}

// TestSellTransaction_MultipleBuysThenSell verifies correct FIFO behavior across multiple buy transactions
func TestSellTransaction_MultipleBuysThenSell(t *testing.T) {
	// Setup
	mockWalletRepo := new(MockWalletRepository)
	mockInvestmentRepo := new(MockInvestmentRepository)
	mockTxRepo := new(MockInvestmentTransactionRepository)
	mockMarketDataService := new(MockMarketDataService)
	mockUserRepo := new(MockUserRepository)
	mockFXRateSvc := new(MockFXRateService)

	service := NewInvestmentService(
		mockInvestmentRepo,
		mockWalletRepo,
		mockTxRepo,
		mockMarketDataService,
		mockUserRepo,
		mockFXRateSvc,
		nil, // currencyCache not needed for this test
		new(MockWalletService),
		nil, // portfolioHistoryRepo not needed for this test
	).(*investmentService)

	ctx := context.Background()
	userID := int32(1)
	walletID := int32(1)
	investmentID := int32(1)

	// Scenario:
	// Buy 1: 100 shares @ $150 = $15,000
	// Buy 2: 50 shares @ $160 = $8,000
	// Total: 150 shares, $23,000 total cost, $153.33 avg cost
	// Sell: 30 shares @ $170
	// Expected: Sell from oldest lot first (FIFO)
	//   Cost basis: 30 * $150 = $4,500
	//   Proceeds: 30 * $170 = $5,100
	//   Realized PNL: $600
	// New state: 120 shares, $23,000 total cost (unchanged), $153.33 avg cost (unchanged)

	investment := &models.Investment{
		ID:          investmentID,
		WalletID:    &walletID,
		Symbol:      "AAPL",
		Name:        "Apple Inc.",
		Type:        int32(v1.InvestmentType_INVESTMENT_TYPE_STOCK),
		Quantity:    15000, // 150 shares (4 decimals)
		AverageCost: 1533333, // ~$153.33
		TotalCost:   23000000000, // $23,000.00
		Currency:    "USD",
	}

	// Two lots from previous purchases
	lot1 := &models.InvestmentLot{
		ID:                1,
		InvestmentID:      investmentID,
		Quantity:          10000,
		RemainingQuantity: 10000,
		AverageCost:       1500000, // $150.00
		TotalCost:         15000000000,
		PurchasedAt:       time.Now().Add(-48 * time.Hour), // Oldest
	}

	lot2 := &models.InvestmentLot{
		ID:                2,
		InvestmentID:      investmentID,
		Quantity:          5000,
		RemainingQuantity: 5000,
		AverageCost:       1600000, // $160.00
		TotalCost:         8000000000,
		PurchasedAt:       time.Now().Add(-24 * time.Hour), // More recent
	}

	req := &v1.AddTransactionRequest{
		InvestmentId:     investmentID,
		Type:             v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_SELL,
		Quantity:         3000, // 30 shares
		Price:            1700000, // $170.00
		Fees:             100,
		TransactionDate:  time.Now().Unix(),
		Notes:            "Take profit",
	}

	mockInvestmentRepo.On("GetByIDForUser", ctx, investmentID, userID).Return(investment, nil)
	mockInvestmentRepo.On("GetByID", ctx, investmentID).Return(investment, nil)
	mockTxRepo.On("GetOpenLots", ctx, investmentID).Return([]*models.InvestmentLot{lot1, lot2}, nil)
	// For populateInvestmentCache
	mockUserRepo.On("GetByID", ctx, userID).Return(&models.User{ID: userID, PreferredCurrency: "USD"}, nil)
	mockTxRepo.On("UpdateLot", ctx, mock.MatchedBy(func(l *models.InvestmentLot) bool {
		return l.ID == 1 && l.RemainingQuantity == 7000 // Oldest lot consumed first
	})).Return(nil)
	mockTxRepo.On("Create", ctx, mock.AnythingOfType("*models.InvestmentTransaction")).Return(nil)
	mockTxRepo.On("ListByInvestmentID", ctx, investmentID, (*v1.InvestmentTransactionType)(nil), mock.Anything).Return([]*models.InvestmentTransaction{}, 0, nil)

	mockInvestmentRepo.On("Update", ctx, mock.MatchedBy(func(inv *models.Investment) bool {
		return inv.Quantity == 12000 && // 15000 - 3000
			inv.TotalCost == investment.TotalCost && // UNCHANGED
			inv.AverageCost == investment.AverageCost && // UNCHANGED
			inv.RealizedPNL > 0
	})).Return(nil)

	// Execute
	response, err := service.AddTransaction(ctx, userID, req)

	// Assert
	assert.NoError(t, err)
	assert.NotNil(t, response)
	assert.True(t, response.Success)

	mockWalletRepo.AssertExpectations(t)
	mockInvestmentRepo.AssertExpectations(t)
	mockTxRepo.AssertExpectations(t)
}

// TestSellTransaction_InsufficientQuantity validates error handling
func TestSellTransaction_InsufficientQuantity(t *testing.T) {
	// Setup
	mockWalletRepo := new(MockWalletRepository)
	mockInvestmentRepo := new(MockInvestmentRepository)
	mockTxRepo := new(MockInvestmentTransactionRepository)
	mockMarketDataService := new(MockMarketDataService)
	mockUserRepo := new(MockUserRepository)
	mockFXRateSvc := new(MockFXRateService)

	service := NewInvestmentService(
		mockInvestmentRepo,
		mockWalletRepo,
		mockTxRepo,
		mockMarketDataService,
		mockUserRepo,
		mockFXRateSvc,
		nil, // currencyCache not needed for this test
		new(MockWalletService),
		nil, // portfolioHistoryRepo not needed for this test
	).(*investmentService)

	ctx := context.Background()
	userID := int32(1)
	walletID := int32(1)
	investmentID := int32(1)

	investment := &models.Investment{
		ID:          investmentID,
		WalletID:    &walletID,
		Symbol:      "AAPL",
		Name:        "Apple Inc.",
		Type:        int32(v1.InvestmentType_INVESTMENT_TYPE_STOCK),
		Quantity:    5000, // Only 0.5 shares
		AverageCost: 1500000,
		TotalCost:   7500000000,
		Currency:    "USD",
	}

	req := &v1.AddTransactionRequest{
		InvestmentId:     investmentID,
		Type:             v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_SELL,
		Quantity:         10000, // Trying to sell 1 share (more than owned)
		Price:            1700000,
		Fees:             100,
		TransactionDate:  time.Now().Unix(),
		Notes:            "Excessive sell",
	}

	mockInvestmentRepo.On("GetByIDForUser", ctx, investmentID, userID).Return(investment, nil)

	// Execute
	response, err := service.AddTransaction(ctx, userID, req)

	// Assert
	assert.Error(t, err)
	assert.Nil(t, response)
	assert.IsType(t, apperrors.ValidationError{}, err)
	assert.Contains(t, err.Error(), "insufficient quantity")
}

// TestSellTransaction_NoOpenLots validates error handling when no lots available
func TestSellTransaction_NoOpenLots(t *testing.T) {
	// Setup
	mockWalletRepo := new(MockWalletRepository)
	mockInvestmentRepo := new(MockInvestmentRepository)
	mockTxRepo := new(MockInvestmentTransactionRepository)
	mockMarketDataService := new(MockMarketDataService)
	mockUserRepo := new(MockUserRepository)
	mockFXRateSvc := new(MockFXRateService)

	service := NewInvestmentService(
		mockInvestmentRepo,
		mockWalletRepo,
		mockTxRepo,
		mockMarketDataService,
		mockUserRepo,
		mockFXRateSvc,
		nil, // currencyCache not needed for this test
		new(MockWalletService),
		nil, // portfolioHistoryRepo not needed for this test
	).(*investmentService)

	ctx := context.Background()
	userID := int32(1)
	walletID := int32(1)
	investmentID := int32(1)

	investment := &models.Investment{
		ID:          investmentID,
		WalletID:    &walletID,
		Symbol:      "AAPL",
		Name:        "Apple Inc.",
		Type:        int32(v1.InvestmentType_INVESTMENT_TYPE_STOCK),
		Quantity:    10000,
		AverageCost: 1500000,
		TotalCost:   15000000000,
		Currency:    "USD",
	}

	req := &v1.AddTransactionRequest{
		InvestmentId:     investmentID,
		Type:             v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_SELL,
		Quantity:         3000,
		Price:            1700000,
		Fees:             100,
		TransactionDate:  time.Now().Unix(),
		Notes:            "Sell without lots",
	}

	mockInvestmentRepo.On("GetByIDForUser", ctx, investmentID, userID).Return(investment, nil)
	mockTxRepo.On("GetOpenLots", ctx, investmentID).Return([]*models.InvestmentLot{}, nil)

	// Execute
	response, err := service.AddTransaction(ctx, userID, req)

	// Assert
	assert.Error(t, err)
	assert.Nil(t, response)
	assert.IsType(t, apperrors.ValidationError{}, err)
	assert.Contains(t, err.Error(), "no open lots")
}

// TestSellTransaction_FIFOMultipleLots verifies FIFO consumption across multiple lots
func TestSellTransaction_FIFOMultipleLots(t *testing.T) {
	// Setup
	mockWalletRepo := new(MockWalletRepository)
	mockInvestmentRepo := new(MockInvestmentRepository)
	mockTxRepo := new(MockInvestmentTransactionRepository)
	mockMarketDataService := new(MockMarketDataService)
	mockUserRepo := new(MockUserRepository)
	mockFXRateSvc := new(MockFXRateService)

	service := NewInvestmentService(
		mockInvestmentRepo,
		mockWalletRepo,
		mockTxRepo,
		mockMarketDataService,
		mockUserRepo,
		mockFXRateSvc,
		nil, // currencyCache not needed for this test
		new(MockWalletService),
		nil, // portfolioHistoryRepo not needed for this test
	).(*investmentService)

	ctx := context.Background()
	userID := int32(1)
	walletID := int32(1)
	investmentID := int32(1)

	// Scenario: Sell quantity that spans multiple lots
	// Lot 1: 20 shares @ $150 (oldest)
	// Lot 2: 30 shares @ $160
	// Lot 3: 50 shares @ $170 (newest)
	// Total: 100 shares
	// Sell: 40 shares
	// Expected FIFO: Consume all 20 from lot1, 20 from lot2
	// Realized PNL: (20 * $180 - 20 * $150) + (20 * $180 - 20 * $160) = $600 + $400 = $1,000

	investment := &models.Investment{
		ID:          investmentID,
		WalletID:    &walletID,
		Symbol:      "AAPL",
		Name:        "Apple Inc.",
		Type:        int32(v1.InvestmentType_INVESTMENT_TYPE_STOCK),
		Quantity:    10000, // 100 shares
		AverageCost: 1630000, // Weighted average: ($3,000 + $4,800 + $8,500) / 100 = $163
		TotalCost:   16300000000, // $16,300
		Currency:    "USD",
	}

	lot1 := &models.InvestmentLot{
		ID:                1,
		InvestmentID:      investmentID,
		Quantity:          2000,
		RemainingQuantity: 2000,
		AverageCost:       1500000,
		TotalCost:         3000000000,
		PurchasedAt:       time.Now().Add(-72 * time.Hour), // Oldest
	}

	lot2 := &models.InvestmentLot{
		ID:                2,
		InvestmentID:      investmentID,
		Quantity:          3000,
		RemainingQuantity: 3000,
		AverageCost:       1600000,
		TotalCost:         4800000000,
		PurchasedAt:       time.Now().Add(-48 * time.Hour),
	}

	lot3 := &models.InvestmentLot{
		ID:                3,
		InvestmentID:      investmentID,
		Quantity:          5000,
		RemainingQuantity: 5000,
		AverageCost:       1700000,
		TotalCost:         8500000000,
		PurchasedAt:       time.Now().Add(-24 * time.Hour), // Newest
	}

	req := &v1.AddTransactionRequest{
		InvestmentId:     investmentID,
		Type:             v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_SELL,
		Quantity:         4000, // 40 shares - consumes all of lot1 (20) and 20 from lot2
		Price:            1800000, // $180.00
		Fees:             100,
		TransactionDate:  time.Now().Unix(),
		Notes:            "Multi-lot sell",
	}

	mockInvestmentRepo.On("GetByIDForUser", ctx, investmentID, userID).Return(investment, nil)
	mockInvestmentRepo.On("GetByID", ctx, investmentID).Return(investment, nil)
	mockTxRepo.On("GetOpenLots", ctx, investmentID).Return([]*models.InvestmentLot{lot1, lot2, lot3}, nil)
	// For populateInvestmentCache
	mockUserRepo.On("GetByID", ctx, userID).Return(&models.User{ID: userID, PreferredCurrency: "USD"}, nil)

	// Both lot1 and lot2 should be updated
	updateCount := 0
	mockTxRepo.On("UpdateLot", ctx, mock.MatchedBy(func(l *models.InvestmentLot) bool {
		updateCount++
		if l.ID == 1 {
			return l.RemainingQuantity == 0 // All consumed
		}
		if l.ID == 2 {
			return l.RemainingQuantity == 1000 // 3000 - 2000
		}
		return false
	})).Return(nil).Times(2)

	mockTxRepo.On("Create", ctx, mock.AnythingOfType("*models.InvestmentTransaction")).Return(nil)
	mockTxRepo.On("ListByInvestmentID", ctx, investmentID, (*v1.InvestmentTransactionType)(nil), mock.Anything).Return([]*models.InvestmentTransaction{}, 0, nil)

	mockInvestmentRepo.On("Update", ctx, mock.MatchedBy(func(inv *models.Investment) bool {
		return inv.Quantity == 6000 && // 10000 - 4000
			inv.TotalCost == investment.TotalCost && // UNCHANGED
			inv.AverageCost == investment.AverageCost && // UNCHANGED
			inv.RealizedPNL > 0
	})).Return(nil)

	// Execute
	response, err := service.AddTransaction(ctx, userID, req)

	// Assert
	assert.NoError(t, err)
	assert.NotNil(t, response)
	assert.True(t, response.Success)
	assert.Equal(t, 2, updateCount, "Should update 2 lots")

	mockWalletRepo.AssertExpectations(t)
	mockInvestmentRepo.AssertExpectations(t)
	mockTxRepo.AssertExpectations(t)
}

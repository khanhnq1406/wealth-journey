//go:build integration
// +build integration

package service

import (
	"context"
	"testing"
	"time"

	"wealthjourney/domain/models"
	"wealthjourney/domain/repository"
	"wealthjourney/pkg/config"
	"wealthjourney/pkg/database"
	investmentv1 "wealthjourney/protobuf/v1"
	walletv1 "wealthjourney/protobuf/v1"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestInvestmentService_Integration_ManualPriceUpdate tests manual price override for custom investments
func TestInvestmentService_Integration_ManualPriceUpdate(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test")
	}

	ctx := context.Background()

	// Setup
	cfg, err := config.Load()
	require.NoError(t, err)

	db, err := database.New(cfg)
	require.NoError(t, err)
	defer db.Close()

	// Create repositories
	userRepo := repository.NewUserRepository(db)
	walletRepo := repository.NewWalletRepository(db)
	investmentRepo := repository.NewInvestmentRepository(db)
	txRepo := repository.NewInvestmentTransactionRepository(db)

	// Create mock market data service (not used for manual updates)
	mockMarketData := new(MockMarketDataService)

	investmentService := NewInvestmentService(
		investmentRepo,
		walletRepo,
		txRepo,
		mockMarketData,
		userRepo,
		nil, // fxRateSvc not needed for this test
		nil, // currencyCache not needed for this test
		nil, // walletService not needed for this test
		nil, // portfolioHistoryRepo not needed for this test
	)

	// Create test user
	user := &models.User{
		Email:             "test-manual-price@example.com",
		Name:              "Test User",
		PreferredCurrency: "USD",
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}
	require.NoError(t, userRepo.Create(ctx, user))
	defer userRepo.Delete(ctx, user.ID)

	// Create investment wallet
	wallet := &models.Wallet{
		UserID:     user.ID,
		WalletName: "Test Investment Wallet",
		Balance:    100000000, // $1,000,000
		Currency:   "USD",
		Type:       int32(walletv1.WalletType_BASIC),
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}
	require.NoError(t, walletRepo.Create(ctx, wallet))
	defer walletRepo.Delete(ctx, wallet.ID)

	// Create custom investment
	createReq := &investmentv1.CreateInvestmentRequest{
		WalletId:               wallet.ID,
		Symbol:                 "MY-STARTUP",
		Name:                   "My Startup Equity",
		Type:                   investmentv1.InvestmentType_INVESTMENT_TYPE_OTHER,
		InitialQuantityDecimal: 100.0,
		InitialCostDecimal:     50000.0, // $50,000 for 100 shares
		Currency:               "USD",
		IsCustom:               true,
	}

	createResp, err := investmentService.CreateInvestment(ctx, user.ID, createReq)
	require.NoError(t, err)
	require.True(t, createResp.Success)
	investmentID := createResp.Data.Id
	defer investmentRepo.Delete(ctx, investmentID)

	t.Run("Manual price update for custom investment", func(t *testing.T) {
		// Update price manually to $600 per share (60000 cents)
		updateReq := &investmentv1.UpdateInvestmentRequest{
			Id:           investmentID,
			Name:         "My Startup Equity", // Name unchanged
			CurrentPrice: 60000,                // $600.00 per share
		}

		updateResp, err := investmentService.UpdateInvestment(ctx, investmentID, user.ID, updateReq)
		require.NoError(t, err)
		assert.True(t, updateResp.Success)
		assert.Equal(t, int64(60000), updateResp.Data.CurrentPrice)

		// Verify PNL was recalculated
		// 100 shares * $600 = $60,000 current value
		// $60,000 - $50,000 cost = $10,000 profit = 20% gain
		assert.Equal(t, int64(6000000), updateResp.Data.CurrentValue)      // $60,000 in cents
		assert.Equal(t, int64(1000000), updateResp.Data.UnrealizedPnl)     // $10,000 profit
		assert.InDelta(t, 20.0, updateResp.Data.UnrealizedPnlPercent, 0.1) // 20% gain

		// Verify database was updated via UpdatePrices method
		inv, err := investmentRepo.GetByID(ctx, investmentID)
		require.NoError(t, err)
		assert.Equal(t, int64(60000), inv.CurrentPrice)
		assert.Equal(t, int64(6000000), inv.CurrentValue)
	})

	t.Run("Set price to 0 for custom investment", func(t *testing.T) {
		// Allow setting price to 0 (useful for clearing stale prices)
		updateReq := &investmentv1.UpdateInvestmentRequest{
			Id:           investmentID,
			Name:         "My Startup Equity",
			CurrentPrice: 0,
		}

		updateResp, err := investmentService.UpdateInvestment(ctx, investmentID, user.ID, updateReq)
		require.NoError(t, err)
		assert.True(t, updateResp.Success)
		assert.Equal(t, int64(0), updateResp.Data.CurrentPrice)
		assert.Equal(t, int64(0), updateResp.Data.CurrentValue)
	})
}

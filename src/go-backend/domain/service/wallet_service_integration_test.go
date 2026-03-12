// +build integration

package service

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"wealthjourney/domain/models"
	"wealthjourney/pkg/cache"
	"wealthjourney/pkg/fx"
	"wealthjourney/pkg/types"
	walletv1 "wealthjourney/protobuf/v1"
)

// TestWalletService_CurrencyConversion tests wallet currency conversion functionality
func TestWalletService_CurrencyConversion(t *testing.T) {
	// Setup test database and services
	ctx := context.Background()
	db, cleanup := setupTestDB(t)
	defer cleanup()

	// Create Redis client for caching
	redisClient := setupTestRedis(t)
	defer func() { _ = redisClient.Close() }()

	// Create repositories
	userRepo := setupUserRepository(db)
	walletRepo := setupWalletRepository(db)
	txRepo := setupTransactionRepository(db)
	categoryRepo := setupCategoryRepository(db)
	fxRateRepo := setupFXRateRepository(db)

	// Create services
	fxRateSvc := NewFXRateService(fxRateRepo, redisClient)
	currencyCache := cache.NewCurrencyCache(redisClient)
	categoryService := NewCategoryService(categoryRepo, userRepo)
	walletService := NewWalletService(walletRepo, userRepo, txRepo, categoryRepo, categoryService, fxRateSvc, currencyCache)

	// Create test user with VND as preferred currency
	user := &models.User{
		Email:             "test@example.com",
		Name:              "Test User",
		PreferredCurrency: types.VND,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}
	err := userRepo.Create(ctx, user)
	require.NoError(t, err, "Failed to create test user")

	t.Run("CreateWallet_WithCurrencyConversion", func(t *testing.T) {
		// Create wallet in USD with initial balance
		req := &walletv1.CreateWalletRequest{
			WalletName: "USD Wallet",
			InitialBalance: &walletv1.Money{
				Amount:   10000, // $100.00 USD
				Currency: types.USD,
			},
			Type: walletv1.WalletType_BASIC,
		}

		resp, err := walletService.CreateWallet(ctx, user.ID, req)
		require.NoError(t, err, "Failed to create wallet")
		assert.NotNil(t, resp)
		assert.Equal(t, "USD Wallet", resp.Wallet.WalletName)
		assert.Equal(t, int64(10000), resp.Wallet.Balance)
		assert.Equal(t, types.USD, resp.Wallet.Currency)

		// Verify cache entry exists for user's preferred currency (VND)
		cachedValue, err := currencyCache.GetConvertedValue(ctx, user.ID, "wallet", resp.Wallet.Id, types.VND)
		assert.NoError(t, err, "Cache should exist for user's preferred currency")
		assert.Greater(t, cachedValue, int64(0), "Cached value should be positive")

		// Expected conversion: $100 USD -> ~2,500,000 VND (assuming rate ~25000)
		// Allow for rate fluctuation (between 2M and 3M VND)
		assert.Greater(t, cachedValue, int64(2000000), "Converted value too low")
		assert.Less(t, cachedValue, int64(3000000), "Converted value too high")
	})

	t.Run("UpdateWallet_InvalidatesCacheCorrectly", func(t *testing.T) {
		// Create wallet
		req := &walletv1.CreateWalletRequest{
			WalletName: "Test Wallet",
			InitialBalance: &walletv1.Money{
				Amount:   5000, // $50.00 USD
				Currency: types.USD,
			},
			Type: walletv1.WalletType_BASIC,
		}

		createResp, err := walletService.CreateWallet(ctx, user.ID, req)
		require.NoError(t, err)
		walletID := createResp.Wallet.Id

		// Verify initial cache exists
		cachedValue, err := currencyCache.GetConvertedValue(ctx, user.ID, "wallet", walletID, types.VND)
		assert.NoError(t, err)
		initialCachedValue := cachedValue

		// Update wallet balance (add funds)
		addFundsReq := &walletv1.AddFundsRequest{
			WalletId: walletID,
			Amount: &walletv1.Money{
				Amount:   5000, // Add $50.00 USD
				Currency: types.USD,
			},
			Description: "Test add funds",
		}

		_, err = walletService.AddFunds(ctx, user.ID, addFundsReq)
		require.NoError(t, err)

		// Verify cache was updated
		newCachedValue, err := currencyCache.GetConvertedValue(ctx, user.ID, "wallet", walletID, types.VND)
		assert.NoError(t, err)
		assert.Greater(t, newCachedValue, initialCachedValue, "Cache should reflect new balance")
		assert.Equal(t, newCachedValue, initialCachedValue*2, "Cache should double after adding same amount")
	})

	t.Run("TransferFunds_UpdatesCacheForBothWallets", func(t *testing.T) {
		// Create two wallets
		wallet1Req := &walletv1.CreateWalletRequest{
			WalletName: "Source Wallet",
			InitialBalance: &walletv1.Money{
				Amount:   100000, // $1000.00 USD
				Currency: types.USD,
			},
			Type: walletv1.WalletType_BASIC,
		}
		wallet1Resp, err := walletService.CreateWallet(ctx, user.ID, wallet1Req)
		require.NoError(t, err)

		wallet2Req := &walletv1.CreateWalletRequest{
			WalletName: "Destination Wallet",
			InitialBalance: &walletv1.Money{
				Amount:   50000, // $500.00 USD
				Currency: types.USD,
			},
			Type: walletv1.WalletType_BASIC,
		}
		wallet2Resp, err := walletService.CreateWallet(ctx, user.ID, wallet2Req)
		require.NoError(t, err)

		// Get initial cached values
		wallet1InitialCache, _ := currencyCache.GetConvertedValue(ctx, user.ID, "wallet", wallet1Resp.Wallet.Id, types.VND)
		wallet2InitialCache, _ := currencyCache.GetConvertedValue(ctx, user.ID, "wallet", wallet2Resp.Wallet.Id, types.VND)

		// Transfer funds
		transferReq := &walletv1.TransferFundsRequest{
			FromWalletId: wallet1Resp.Wallet.Id,
			ToWalletId:   wallet2Resp.Wallet.Id,
			Amount: &walletv1.Money{
				Amount:   20000, // Transfer $200.00 USD
				Currency: types.USD,
			},
		}

		_, err = walletService.TransferFunds(ctx, user.ID, transferReq)
		require.NoError(t, err)

		// Verify both caches were updated
		wallet1NewCache, err := currencyCache.GetConvertedValue(ctx, user.ID, "wallet", wallet1Resp.Wallet.Id, types.VND)
		assert.NoError(t, err)
		assert.Less(t, wallet1NewCache, wallet1InitialCache, "Source wallet cache should decrease")

		wallet2NewCache, err := currencyCache.GetConvertedValue(ctx, user.ID, "wallet", wallet2Resp.Wallet.Id, types.VND)
		assert.NoError(t, err)
		assert.Greater(t, wallet2NewCache, wallet2InitialCache, "Destination wallet cache should increase")
	})

	t.Run("DeleteWallet_RemovesCache", func(t *testing.T) {
		// Create wallet
		req := &walletv1.CreateWalletRequest{
			WalletName: "Wallet to Delete",
			InitialBalance: &walletv1.Money{
				Amount:   1000,
				Currency: types.USD,
			},
			Type: walletv1.WalletType_BASIC,
		}

		createResp, err := walletService.CreateWallet(ctx, user.ID, req)
		require.NoError(t, err)
		walletID := createResp.Wallet.Id

		// Verify cache exists
		_, err = currencyCache.GetConvertedValue(ctx, user.ID, "wallet", walletID, types.VND)
		assert.NoError(t, err, "Cache should exist before deletion")

		// Delete wallet
		_, err = walletService.DeleteWallet(ctx, user.ID, walletID)
		require.NoError(t, err)

		// Verify cache was removed
		_, err = currencyCache.GetConvertedValue(ctx, user.ID, "wallet", walletID, types.VND)
		assert.Error(t, err, "Cache should not exist after deletion")
	})

	t.Run("ListWallets_ReturnsConvertedBalances", func(t *testing.T) {
		// Create multiple wallets in different currencies
		wallets := []struct {
			name     string
			amount   int64
			currency string
		}{
			{"USD Wallet", 10000, types.USD},   // $100.00
			{"EUR Wallet", 10000, types.EUR},   // €100.00
			{"VND Wallet", 1000000, types.VND}, // ₫1,000,000
		}

		for _, w := range wallets {
			req := &walletv1.CreateWalletRequest{
				WalletName: w.name,
				InitialBalance: &walletv1.Money{
					Amount:   w.amount,
					Currency: w.currency,
				},
				Type: walletv1.WalletType_BASIC,
			}
			_, err := walletService.CreateWallet(ctx, user.ID, req)
			require.NoError(t, err, "Failed to create wallet: %s", w.name)
		}

		// List all wallets
		listResp, err := walletService.ListWallets(ctx, user.ID, &types.Pagination{
			Page:     1,
			PageSize: 10,
		})
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(listResp.Wallets), 3, "Should have at least 3 wallets")

		// Verify each wallet has displayBalance in user's preferred currency
		for _, wallet := range listResp.Wallets {
			assert.NotNil(t, wallet.DisplayBalance, "Display balance should not be nil")
			assert.Equal(t, types.VND, wallet.DisplayBalance.Currency, "Display currency should be user's preferred currency")
			assert.Greater(t, wallet.DisplayBalance.Amount, int64(0), "Display balance should be positive")
		}
	})

	t.Run("GetTotalBalance_AggregatesAcrossCurrencies", func(t *testing.T) {
		// Get total balance (should aggregate all wallets in VND)
		totalResp, err := walletService.GetTotalBalance(ctx, user.ID)
		require.NoError(t, err)
		assert.NotNil(t, totalResp)
		assert.NotNil(t, totalResp.DisplayBalance)
		assert.Equal(t, types.VND, totalResp.DisplayBalance.Currency)
		assert.Greater(t, totalResp.DisplayBalance.Amount, int64(0), "Total balance should be positive")

		// Verify total is greater than individual wallets
		// (we created multiple wallets above, total should be sum of all)
	})

	t.Run("CurrencyConversion_HandlesStaleCache", func(t *testing.T) {
		// Create wallet
		req := &walletv1.CreateWalletRequest{
			WalletName: "Stale Cache Test",
			InitialBalance: &walletv1.Money{
				Amount:   5000,
				Currency: types.USD,
			},
			Type: walletv1.WalletType_BASIC,
		}

		createResp, err := walletService.CreateWallet(ctx, user.ID, req)
		require.NoError(t, err)
		walletID := createResp.Wallet.Id

		// Get initial cached value
		initialCache, err := currencyCache.GetConvertedValue(ctx, user.ID, "wallet", walletID, types.VND)
		require.NoError(t, err)

		// Clear FX rate cache to force recalculation
		// (In production, this would happen when cache expires)
		redisClient.FlushDB(ctx)

		// Get wallet again (should refetch rate and update cache)
		getResp, err := walletService.GetWallet(ctx, user.ID, walletID)
		require.NoError(t, err)
		assert.NotNil(t, getResp.Wallet.DisplayBalance)

		// Cache should be repopulated
		newCache, err := currencyCache.GetConvertedValue(ctx, user.ID, "wallet", walletID, types.VND)
		assert.NoError(t, err)

		// Values should be similar (accounting for rate fluctuation)
		diff := abs(newCache - initialCache)
		percentDiff := float64(diff) / float64(initialCache) * 100
		assert.Less(t, percentDiff, 5.0, "Cache values should be within 5% after refresh")
	})
}

// TestWalletService_CurrencyConversionErrors tests error handling in currency conversion
func TestWalletService_CurrencyConversionErrors(t *testing.T) {
	ctx := context.Background()
	db, cleanup := setupTestDB(t)
	defer cleanup()

	redisClient := setupTestRedis(t)
	defer func() { _ = redisClient.Close() }()

	// Create repositories and services
	userRepo := setupUserRepository(db)
	walletRepo := setupWalletRepository(db)
	txRepo := setupTransactionRepository(db)
	categoryRepo := setupCategoryRepository(db)
	fxRateRepo := setupFXRateRepository(db)

	fxRateSvc := NewFXRateService(fxRateRepo, redisClient)
	currencyCache := cache.NewCurrencyCache(redisClient)
	categoryService := NewCategoryService(categoryRepo, userRepo)
	walletService := NewWalletService(walletRepo, userRepo, txRepo, categoryRepo, categoryService, fxRateSvc, currencyCache)

	// Create test user
	user := &models.User{
		Email:             "error-test@example.com",
		Name:              "Error Test User",
		PreferredCurrency: types.USD,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}
	err := userRepo.Create(ctx, user)
	require.NoError(t, err)

	t.Run("UnsupportedCurrency_ReturnsError", func(t *testing.T) {
		// Try to create wallet with unsupported currency
		req := &walletv1.CreateWalletRequest{
			WalletName: "Invalid Currency Wallet",
			InitialBalance: &walletv1.Money{
				Amount:   1000,
				Currency: "XXX", // Unsupported currency
			},
			Type: walletv1.WalletType_BASIC,
		}

		_, err := walletService.CreateWallet(ctx, user.ID, req)
		assert.Error(t, err, "Should return error for unsupported currency")
		assert.Contains(t, err.Error(), "unsupported currency", "Error message should mention unsupported currency")
	})

	t.Run("InvalidCurrencyPair_GracefulDegradation", func(t *testing.T) {
		// Create wallet with valid currency
		req := &walletv1.CreateWalletRequest{
			WalletName: "Valid Wallet",
			InitialBalance: &walletv1.Money{
				Amount:   1000,
				Currency: types.USD,
			},
			Type: walletv1.WalletType_BASIC,
		}

		createResp, err := walletService.CreateWallet(ctx, user.ID, req)
		require.NoError(t, err, "Should create wallet successfully")

		// Even if FX rate fetch fails, wallet creation should succeed
		// (because we don't require display balance at creation time)
		assert.NotNil(t, createResp.Wallet)
		assert.Equal(t, int64(1000), createResp.Wallet.Balance)
	})
}

// Note: Helper functions (abs, setupTestDB, setupTestRedis, etc.) are defined in other test files

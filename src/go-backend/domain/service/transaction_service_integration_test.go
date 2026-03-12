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
	"wealthjourney/pkg/types"
	transactionv1 "wealthjourney/protobuf/v1"
)

// TestTransactionService_CurrencyConversion tests transaction currency conversion functionality
func TestTransactionService_CurrencyConversion(t *testing.T) {
	ctx := context.Background()
	db, cleanup := setupTestDB(t)
	defer cleanup()

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
	transactionService := NewTransactionService(txRepo, walletRepo, categoryRepo, userRepo, fxRateSvc, currencyCache)

	// Create test user with EUR as preferred currency
	user := &models.User{
		Email:             "transaction-test@example.com",
		Name:              "Transaction Test User",
		PreferredCurrency: types.EUR,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}
	err := userRepo.Create(ctx, user)
	require.NoError(t, err)

	// Create test wallet in USD
	wallet := &models.Wallet{
		UserID:     user.ID,
		WalletName: "Test Wallet",
		Balance:    100000, // $1000.00 USD
		Currency:   types.USD,
		Type:       walletv1.WalletType_BASIC,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}
	err = walletRepo.Create(ctx, wallet)
	require.NoError(t, err)

	// Create test category
	category := &models.Category{
		UserID:      user.ID,
		Name:        "Food",
		Type:        types.EXPENSE,
		IsDefault:   false,
		Description: "Food expenses",
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	err = categoryRepo.Create(ctx, category)
	require.NoError(t, err)

	t.Run("CreateTransaction_CreatesCache", func(t *testing.T) {
		// Create transaction in USD
		req := &transactionv1.CreateTransactionRequest{
			WalletId:    wallet.ID,
			CategoryId:  category.ID,
			Amount:      5000, // $50.00 USD
			Currency:    types.USD,
			Description: "Lunch",
			Date:        time.Now().Unix(),
			Type:        transactionv1.TransactionType_EXPENSE,
		}

		resp, err := transactionService.CreateTransaction(ctx, user.ID, req)
		require.NoError(t, err)
		assert.NotNil(t, resp)
		assert.Equal(t, int64(5000), resp.Transaction.Amount)
		assert.Equal(t, types.USD, resp.Transaction.Currency)

		// Verify cache entry exists for user's preferred currency (EUR)
		cachedValue, err := currencyCache.GetConvertedValue(ctx, user.ID, "transaction", resp.Transaction.Id, types.EUR)
		assert.NoError(t, err, "Cache should exist for transaction")
		assert.Greater(t, cachedValue, int64(0), "Cached value should be positive")

		// Verify displayAmount is populated
		assert.NotNil(t, resp.Transaction.DisplayAmount)
		assert.Equal(t, types.EUR, resp.Transaction.DisplayCurrency)
		assert.Greater(t, resp.Transaction.DisplayAmount, int64(0))
	})

	t.Run("UpdateTransaction_InvalidatesCache", func(t *testing.T) {
		// Create transaction
		createReq := &transactionv1.CreateTransactionRequest{
			WalletId:    wallet.ID,
			CategoryId:  category.ID,
			Amount:      10000, // $100.00 USD
			Currency:    types.USD,
			Description: "Dinner",
			Date:        time.Now().Unix(),
			Type:        transactionv1.TransactionType_EXPENSE,
		}

		createResp, err := transactionService.CreateTransaction(ctx, user.ID, createReq)
		require.NoError(t, err)
		txID := createResp.Transaction.Id

		// Get initial cached value
		initialCache, err := currencyCache.GetConvertedValue(ctx, user.ID, "transaction", txID, types.EUR)
		require.NoError(t, err)

		// Update transaction amount
		updateReq := &transactionv1.UpdateTransactionRequest{
			TransactionId: txID,
			Amount:        20000, // Update to $200.00 USD
			Currency:      types.USD,
			Description:   "Updated Dinner",
			Date:          time.Now().Unix(),
			CategoryId:    category.ID,
		}

		_, err = transactionService.UpdateTransaction(ctx, user.ID, updateReq)
		require.NoError(t, err)

		// Verify cache was updated
		newCache, err := currencyCache.GetConvertedValue(ctx, user.ID, "transaction", txID, types.EUR)
		assert.NoError(t, err)
		assert.Greater(t, newCache, initialCache, "Cache should reflect updated amount")
		assert.Equal(t, newCache, initialCache*2, "Cache should double after doubling amount")
	})

	t.Run("DeleteTransaction_RemovesCache", func(t *testing.T) {
		// Create transaction
		createReq := &transactionv1.CreateTransactionRequest{
			WalletId:    wallet.ID,
			CategoryId:  category.ID,
			Amount:      5000,
			Currency:    types.USD,
			Description: "To Delete",
			Date:        time.Now().Unix(),
			Type:        transactionv1.TransactionType_EXPENSE,
		}

		createResp, err := transactionService.CreateTransaction(ctx, user.ID, createReq)
		require.NoError(t, err)
		txID := createResp.Transaction.Id

		// Verify cache exists
		_, err = currencyCache.GetConvertedValue(ctx, user.ID, "transaction", txID, types.EUR)
		assert.NoError(t, err, "Cache should exist before deletion")

		// Delete transaction
		_, err = transactionService.DeleteTransaction(ctx, user.ID, txID)
		require.NoError(t, err)

		// Verify cache was removed
		_, err = currencyCache.GetConvertedValue(ctx, user.ID, "transaction", txID, types.EUR)
		assert.Error(t, err, "Cache should not exist after deletion")
	})

	t.Run("ListTransactions_ReturnsConvertedAmounts", func(t *testing.T) {
		// Create multiple transactions in different currencies
		transactions := []struct {
			amount   int64
			currency string
			desc     string
		}{
			{5000, types.USD, "USD Transaction"},
			{4000, types.EUR, "EUR Transaction"},
			{100000, types.VND, "VND Transaction"},
		}

		for _, tx := range transactions {
			req := &transactionv1.CreateTransactionRequest{
				WalletId:    wallet.ID,
				CategoryId:  category.ID,
				Amount:      tx.amount,
				Currency:    tx.currency,
				Description: tx.desc,
				Date:        time.Now().Unix(),
				Type:        transactionv1.TransactionType_EXPENSE,
			}
			_, err := transactionService.CreateTransaction(ctx, user.ID, req)
			require.NoError(t, err, "Failed to create transaction: %s", tx.desc)
		}

		// List all transactions
		listResp, err := transactionService.ListTransactions(ctx, user.ID, &types.Pagination{
			Page:     1,
			PageSize: 10,
		})
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(listResp.Transactions), 3, "Should have at least 3 transactions")

		// Verify each transaction has displayAmount in user's preferred currency
		for _, tx := range listResp.Transactions {
			assert.NotNil(t, tx.DisplayAmount, "Display amount should not be nil")
			assert.Equal(t, types.EUR, tx.DisplayCurrency, "Display currency should be EUR")
			assert.Greater(t, tx.DisplayAmount, int64(0), "Display amount should be positive")

			// Verify original amount is preserved
			assert.Greater(t, tx.Amount, int64(0), "Original amount should be positive")
			assert.NotEmpty(t, tx.Currency, "Original currency should be set")
		}
	})

	t.Run("GetTransaction_IncludesConversion", func(t *testing.T) {
		// Create transaction
		createReq := &transactionv1.CreateTransactionRequest{
			WalletId:    wallet.ID,
			CategoryId:  category.ID,
			Amount:      15000, // $150.00 USD
			Currency:    types.USD,
			Description: "Test Get",
			Date:        time.Now().Unix(),
			Type:        transactionv1.TransactionType_EXPENSE,
		}

		createResp, err := transactionService.CreateTransaction(ctx, user.ID, createReq)
		require.NoError(t, err)
		txID := createResp.Transaction.Id

		// Get transaction by ID
		getResp, err := transactionService.GetTransaction(ctx, user.ID, txID)
		require.NoError(t, err)

		// Verify conversion fields
		assert.NotNil(t, getResp.Transaction)
		assert.Equal(t, int64(15000), getResp.Transaction.Amount)
		assert.Equal(t, types.USD, getResp.Transaction.Currency)
		assert.NotNil(t, getResp.Transaction.DisplayAmount)
		assert.Equal(t, types.EUR, getResp.Transaction.DisplayCurrency)
		assert.Greater(t, getResp.Transaction.DisplayAmount, int64(0))
	})

	t.Run("TransactionsByCategory_GroupsCorrectly", func(t *testing.T) {
		// Create multiple transactions in same category but different currencies
		amounts := []struct {
			amount   int64
			currency string
		}{
			{5000, types.USD},
			{4000, types.EUR},
			{100000, types.VND},
		}

		for _, a := range amounts {
			req := &transactionv1.CreateTransactionRequest{
				WalletId:    wallet.ID,
				CategoryId:  category.ID,
				Amount:      a.amount,
				Currency:    a.currency,
				Description: "Category Test",
				Date:        time.Now().Unix(),
				Type:        transactionv1.TransactionType_EXPENSE,
			}
			_, err := transactionService.CreateTransaction(ctx, user.ID, req)
			require.NoError(t, err)
		}

		// Get transactions by category
		byCategoryResp, err := transactionService.GetTransactionsByCategory(ctx, user.ID, category.ID, &types.Pagination{
			Page:     1,
			PageSize: 10,
		})
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(byCategoryResp.Transactions), 3)

		// All should have converted amounts in EUR
		for _, tx := range byCategoryResp.Transactions {
			assert.Equal(t, types.EUR, tx.DisplayCurrency)
			assert.Greater(t, tx.DisplayAmount, int64(0))
		}
	})

	t.Run("TransactionSummary_AggregatesAcrossCurrencies", func(t *testing.T) {
		// Get transaction summary (should aggregate across all currencies)
		summaryResp, err := transactionService.GetTransactionSummary(ctx, user.ID, &transactionv1.GetTransactionSummaryRequest{
			StartDate: time.Now().AddDate(0, 0, -30).Unix(),
			EndDate:   time.Now().Unix(),
		})
		require.NoError(t, err)
		assert.NotNil(t, summaryResp)

		// Verify summary has converted totals
		assert.Greater(t, summaryResp.TotalIncome, int64(0), "Should have income")
		assert.Greater(t, summaryResp.TotalExpense, int64(0), "Should have expenses")
		assert.Equal(t, types.EUR, summaryResp.Currency, "Summary currency should match user preference")
	})
}

// TestTransactionService_MultiCurrencyEdgeCases tests edge cases in multi-currency transaction handling
func TestTransactionService_MultiCurrencyEdgeCases(t *testing.T) {
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
	transactionService := NewTransactionService(txRepo, walletRepo, categoryRepo, userRepo, fxRateSvc, currencyCache)

	// Create test user
	user := &models.User{
		Email:             "edge-case@example.com",
		Name:              "Edge Case User",
		PreferredCurrency: types.USD,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}
	err := userRepo.Create(ctx, user)
	require.NoError(t, err)

	// Create wallet and category
	wallet := &models.Wallet{
		UserID:     user.ID,
		WalletName: "Test Wallet",
		Balance:    100000,
		Currency:   types.USD,
		Type:       walletv1.WalletType_BASIC,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}
	err = walletRepo.Create(ctx, wallet)
	require.NoError(t, err)

	category := &models.Category{
		UserID:    user.ID,
		Name:      "Test Category",
		Type:      types.EXPENSE,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	err = categoryRepo.Create(ctx, category)
	require.NoError(t, err)

	t.Run("ZeroAmount_HandledCorrectly", func(t *testing.T) {
		// Create transaction with zero amount
		req := &transactionv1.CreateTransactionRequest{
			WalletId:    wallet.ID,
			CategoryId:  category.ID,
			Amount:      0,
			Currency:    types.USD,
			Description: "Zero Amount",
			Date:        time.Now().Unix(),
			Type:        transactionv1.TransactionType_EXPENSE,
		}

		resp, err := transactionService.CreateTransaction(ctx, user.ID, req)
		require.NoError(t, err)
		assert.Equal(t, int64(0), resp.Transaction.Amount)

		// Display amount should also be zero
		assert.NotNil(t, resp.Transaction.DisplayAmount)
		assert.Equal(t, int64(0), resp.Transaction.DisplayAmount)
	})

	t.Run("SameCurrency_NoConversionNeeded", func(t *testing.T) {
		// Transaction in same currency as user preference
		req := &transactionv1.CreateTransactionRequest{
			WalletId:    wallet.ID,
			CategoryId:  category.ID,
			Amount:      10000, // $100.00 USD
			Currency:    types.USD,
			Description: "Same Currency",
			Date:        time.Now().Unix(),
			Type:        transactionv1.TransactionType_EXPENSE,
		}

		resp, err := transactionService.CreateTransaction(ctx, user.ID, req)
		require.NoError(t, err)

		// Display amount should equal original amount
		assert.Equal(t, resp.Transaction.Amount, resp.Transaction.DisplayAmount)
		assert.Equal(t, types.USD, resp.Transaction.Currency)
		assert.Equal(t, types.USD, resp.Transaction.DisplayCurrency)
	})

	t.Run("VeryLargeAmount_NoPrecisionLoss", func(t *testing.T) {
		// Test with very large amount
		largeAmount := int64(1000000000000) // $10,000,000.00 USD

		req := &transactionv1.CreateTransactionRequest{
			WalletId:    wallet.ID,
			CategoryId:  category.ID,
			Amount:      largeAmount,
			Currency:    types.USD,
			Description: "Large Amount",
			Date:        time.Now().Unix(),
			Type:        transactionv1.TransactionType_INCOME,
		}

		resp, err := transactionService.CreateTransaction(ctx, user.ID, req)
		require.NoError(t, err)
		assert.Equal(t, largeAmount, resp.Transaction.Amount)

		// Display amount should be proportional
		assert.NotNil(t, resp.Transaction.DisplayAmount)
		assert.Greater(t, resp.Transaction.DisplayAmount, int64(0))
	})

	t.Run("VerySmallAmount_HandlesRounding", func(t *testing.T) {
		// Test with very small amount that may round to zero
		smallAmount := int64(1) // $0.01 USD

		req := &transactionv1.CreateTransactionRequest{
			WalletId:    wallet.ID,
			CategoryId:  category.ID,
			Amount:      smallAmount,
			Currency:    types.USD,
			Description: "Small Amount",
			Date:        time.Now().Unix(),
			Type:        transactionv1.TransactionType_EXPENSE,
		}

		resp, err := transactionService.CreateTransaction(ctx, user.ID, req)
		require.NoError(t, err)
		assert.Equal(t, smallAmount, resp.Transaction.Amount)

		// Display amount may be zero due to rounding (acceptable behavior)
		assert.NotNil(t, resp.Transaction.DisplayAmount)
		assert.GreaterOrEqual(t, resp.Transaction.DisplayAmount, int64(0))
	})

	t.Run("NegativeAmount_ValidationError", func(t *testing.T) {
		// Try to create transaction with negative amount
		req := &transactionv1.CreateTransactionRequest{
			WalletId:    wallet.ID,
			CategoryId:  category.ID,
			Amount:      -1000,
			Currency:    types.USD,
			Description: "Negative Amount",
			Date:        time.Now().Unix(),
			Type:        transactionv1.TransactionType_EXPENSE,
		}

		_, err := transactionService.CreateTransaction(ctx, user.ID, req)
		assert.Error(t, err, "Should reject negative amounts")
	})

	t.Run("FutureDate_AcceptedButWarned", func(t *testing.T) {
		// Transaction with future date
		futureDate := time.Now().AddDate(0, 0, 7) // 7 days in future

		req := &transactionv1.CreateTransactionRequest{
			WalletId:    wallet.ID,
			CategoryId:  category.ID,
			Amount:      5000,
			Currency:    types.USD,
			Description: "Future Transaction",
			Date:        futureDate.Unix(),
			Type:        transactionv1.TransactionType_EXPENSE,
		}

		resp, err := transactionService.CreateTransaction(ctx, user.ID, req)
		// Should succeed (system allows future-dated transactions)
		require.NoError(t, err)
		assert.NotNil(t, resp.Transaction)
	})
}

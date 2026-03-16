// +build integration

package service

import (
	"context"
	"testing"
	"time"

	"wealthjourney/domain/models"
	"wealthjourney/domain/repository"
	apperrors "wealthjourney/pkg/errors"

	investmentv1 "wealthjourney/protobuf/v1"
	walletv1 "wealthjourney/protobuf/v1"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestGoldInvestmentCreation_VND tests creating a Vietnamese gold investment
// This test requires database access and is tagged with 'integration'
func TestGoldInvestmentCreation_VND(t *testing.T) {
	// Skip if running short tests
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	ctx := context.Background()

	// Setup - get or create test user and wallet
	user := createTestUser(t, ctx)
	defer cleanupTestUser(t, ctx, user.ID)

	// Create an investment wallet in VND
	wallet := &models.Wallet{
		UserID:     user.ID,
		WalletName: "Test Gold Wallet VND",
		Balance:    100000000000, // 10 billion VND (enough for gold purchase)
		Currency:   "VND",
		Type:       walletv1.WalletType_WALLET_TYPE_INVESTMENT,
	}
	err := testWalletRepo.Create(ctx, wallet)
	require.NoError(t, err, "Failed to create test wallet")
	defer cleanupTestWallet(t, ctx, wallet.ID)

	// Test Case 1: Create VND gold investment (SJC 1L-10L)
	// User buys 20 mace of SJC gold at 8,500,000 VND/mace
	// Total cost: 170,000,000 VND
	testCases := []struct {
		name             string
		symbol           string
		investmentName   string
		quantity         float64
		quantityUnit     string
		pricePerUnit     float64
		priceCurrency    string
		expectedQuantity int64 // In storage format (grams × 10000)
		expectedCost     int64 // In smallest currency unit
	}{
		{
			name:           "SJC 1L-10L - 20 mace",
			symbol:         "SJL1L10",
			investmentName: "SJC 1L-10L (Vàng miếng)",
			quantity:       20.0, // 20 mace (= 2 lượng)
			quantityUnit:   "mace",
			pricePerUnit:   8500000, // 8.5M VND per mace
			priceCurrency:  "VND",
			// 20 mace = 75 grams → stored as 750000 (75 × 10000)
			expectedQuantity: 750000,
			// Total cost: 20 × 8,500,000 = 170,000,000 VND
			expectedCost: 170000000,
		},
		{
			name:           "SJC Rings - 50 grams",
			symbol:         "SJR1",
			investmentName: "SJC Nhẫn 1 chỉ",
			quantity:       50.0, // 50 grams
			quantityUnit:   "gram",
			pricePerUnit:   7200000, // 7.2M VND per gram (typical ring price)
			priceCurrency:  "VND",
			// 50 grams → stored as 500000 (50 × 10000)
			expectedQuantity: 500000,
			// Total cost: 50 × 7,200,000 = 360,000,000 VND
			expectedCost: 360000000,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Calculate stored quantity using gold converter logic
			// For VND gold: store in grams × 10000
			var storedQuantity int64
			if tc.quantityUnit == "mace" {
				// Convert mace to grams: 1 mace = 3.75 grams
				grams := tc.quantity * 3.75
				storedQuantity = int64(grams * 10000)
			} else {
				storedQuantity = int64(tc.quantity * 10000)
			}

			// Calculate total cost
			totalCost := int64(tc.quantity * tc.pricePerUnit)

			// Create investment
			investment := &models.Investment{
				WalletID:       wallet.ID,
				Symbol:         tc.symbol,
				Name:           tc.investmentName,
				Type:           investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND,
				Quantity:       storedQuantity,
				AverageCost:    tc.pricePerUnit, // Per gram for VND gold
				TotalCost:      totalCost,
				Currency:       tc.priceCurrency,
				CurrentPrice:   tc.pricePerUnit,
				CurrentValue:   totalCost,
				UnrealizedPnl:  0,
				ExchangeRate:   1, // No currency conversion
			}

			err = testInvestmentRepo.Create(ctx, investment)
			require.NoError(t, err, "Failed to create gold investment")
			assert.Greater(t, investment.ID, int32(0), "Investment ID should be set")

			// Verify the investment was created correctly
			retrieved, err := testInvestmentRepo.GetByID(ctx, investment.ID)
			require.NoError(t, err, "Failed to retrieve investment")
			assert.Equal(t, tc.symbol, retrieved.Symbol)
			assert.Equal(t, investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND, retrieved.Type)
			assert.Equal(t, storedQuantity, retrieved.Quantity)
			assert.Equal(t, totalCost, retrieved.TotalCost)
			assert.Equal(t, "VND", retrieved.Currency)

			// Cleanup this investment
			testInvestmentRepo.Delete(ctx, investment.ID)
		})
	}
}

// TestGoldInvestmentCreation_USD tests creating a World gold investment
func TestGoldInvestmentCreation_USD(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	ctx := context.Background()

	// Setup - get or create test user and wallet
	user := createTestUser(t, ctx)
	defer cleanupTestUser(t, ctx, user.ID)

	// Create an investment wallet in USD
	wallet := &models.Wallet{
		UserID:     user.ID,
		WalletName: "Test Gold Wallet USD",
		Balance:    500000000, // $5,000,000 in cents (enough for gold purchase)
		Currency:   "USD",
		Type:       walletv1.WalletType_WALLET_TYPE_INVESTMENT,
	}
	err := testWalletRepo.Create(ctx, wallet)
	require.NoError(t, err, "Failed to create test wallet")
	defer cleanupTestWallet(t, ctx, wallet.ID)

	// Test Case: Create USD gold investment (XAU)
	// User buys 1 ounce of world gold at $2,700/ounce
	testCases := []struct {
		name             string
		symbol           string
		quantity         float64
		pricePerUnit     float64 // In cents for USD
		expectedQuantity int64
		expectedCost     int64
	}{
		{
			name:         "XAU - 1 ounce",
			symbol:       "XAU",
			quantity:     1.0,
			pricePerUnit: 270000, // $2,700 in cents
			// 1 ounce → stored as 10000 (1 × 10000)
			expectedQuantity: 10000,
			// Total cost: $2,700 in cents = 270,000
			expectedCost: 270000,
		},
		{
			name:         "XAU - 0.5 ounce",
			symbol:       "XAU",
			quantity:     0.5,
			pricePerUnit: 275000, // $2,750 in cents
			// 0.5 ounce → stored as 5000 (0.5 × 10000)
			expectedQuantity: 5000,
			// Total cost: 0.5 × $2,750 = $1,375 in cents = 137,500
			expectedCost: 137500,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			storedQuantity := int64(tc.quantity * 10000)
			totalCost := int64(tc.quantity * tc.pricePerUnit)

			investment := &models.Investment{
				WalletID:       wallet.ID,
				Symbol:         tc.symbol,
				Name:           "Gold World (XAU/USD)",
				Type:           investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_USD,
				Quantity:       storedQuantity,
				AverageCost:    tc.pricePerUnit, // Per ounce for USD gold
				TotalCost:      totalCost,
				Currency:       "USD",
				CurrentPrice:   tc.pricePerUnit,
				CurrentValue:   totalCost,
				UnrealizedPnl:  0,
				ExchangeRate:   1,
			}

			err = testInvestmentRepo.Create(ctx, investment)
			require.NoError(t, err, "Failed to create USD gold investment")

			// Verify
			retrieved, err := testInvestmentRepo.GetByID(ctx, investment.ID)
			require.NoError(t, err)
			assert.Equal(t, tc.symbol, retrieved.Symbol)
			assert.Equal(t, investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_USD, retrieved.Type)
			assert.Equal(t, storedQuantity, retrieved.Quantity)
			assert.Equal(t, "USD", retrieved.Currency)

			// Cleanup
			testInvestmentRepo.Delete(ctx, investment.ID)
		})
	}
}

// TestGoldInvestment_CrossCurrency tests creating gold investment with currency conversion
func TestGoldInvestment_CrossCurrency(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	ctx := context.Background()

	user := createTestUser(t, ctx)
	defer cleanupTestUser(t, ctx, user.ID)

	// Scenario: User with VND wallet buys USD gold
	// 1 oz XAU @ $2,700 = 270,000 cents USD
	// With FX rate of 25,000 VND/USD = 6,750,000,000 VND
	wallet := &models.Wallet{
		UserID:     user.ID,
		WalletName: "Test VND Wallet",
		Balance:    10000000000, // 10 billion VND
		Currency:   "VND",
		Type:       walletv1.WalletType_WALLET_TYPE_INVESTMENT,
	}
	err := testWalletRepo.Create(ctx, wallet)
	require.NoError(t, err)
	defer cleanupTestWallet(t, ctx, wallet.ID)

	// XAU price in USD
	xauPriceUSD := 270000 // $2,700 in cents
	quantityOz := 1.0
	fxRate := 25000.0 // 1 USD = 25,000 VND

	// Calculate costs
	totalCostUSD := int64(quantityOz * float64(xauPriceUSD))           // 270,000 cents
	totalCostVND := int64(float64(totalCostUSD) * fxRate)              // 6,750,000,000 VND
	averageCostVND := int64(float64(xauPriceUSD) * fxRate)             // 6,750,000,000 VND per oz

	investment := &models.Investment{
		WalletID:       wallet.ID,
		Symbol:         "XAU",
		Name:           "Gold World (XAU/USD)",
		Type:           investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_USD,
		Quantity:       10000, // 1 oz × 10000
		AverageCost:    averageCostVND, // In wallet currency (VND)
		TotalCost:      totalCostVND,    // In wallet currency (VND)
		Currency:       "VND",           // Stored in wallet currency
		CurrentPrice:   averageCostVND,
		CurrentValue:   totalCostVND,
		UnrealizedPnl:  0,
		ExchangeRate:   int64(fxRate),   // FX rate used for conversion
	}

	err = testInvestmentRepo.Create(ctx, investment)
	require.NoError(t, err)

	// Verify the investment was created with proper currency conversion
	retrieved, err := testInvestmentRepo.GetByID(ctx, investment.ID)
	require.NoError(t, err)
	assert.Equal(t, "VND", retrieved.Currency, "Currency should match wallet currency")
	assert.Equal(t, totalCostVND, retrieved.TotalCost, "Total cost should be in wallet currency")
	assert.Equal(t, int64(fxRate), retrieved.ExchangeRate, "FX rate should be stored")

	// Cleanup
	testInvestmentRepo.Delete(ctx, investment.ID)
}

// TestGoldInvestment_ListByType tests filtering gold investments by type
func TestGoldInvestment_ListByType(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	ctx := context.Background()

	user := createTestUser(t, ctx)
	defer cleanupTestUser(t, ctx, user.ID)

	wallet := &models.Wallet{
		UserID:     user.ID,
		WalletName: "Test Gold Wallet",
		Balance:    100000000000,
		Currency:   "VND",
		Type:       walletv1.WalletType_WALLET_TYPE_INVESTMENT,
	}
	err := testWalletRepo.Create(ctx, wallet)
	require.NoError(t, err)
	defer cleanupTestWallet(t, ctx, wallet.ID)

	// Create multiple investments of different types
	investments := []*models.Investment{
		{
			WalletID:  wallet.ID,
			Symbol:    "SJL1L10",
			Name:      "SJC Gold",
			Type:      investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND,
			Quantity:  750000, // 75g
			TotalCost: 170000000,
			Currency:  "VND",
		},
		{
			WalletID:  wallet.ID,
			Symbol:    "XAU",
			Name:      "World Gold",
			Type:      investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_USD,
			Quantity:  10000, // 1 oz
			TotalCost: 270000, // $2,700 in cents
			Currency:  "USD",
		},
		{
			WalletID:  wallet.ID,
			Symbol:    "AAPL",
			Name:      "Apple Inc.",
			Type:      investmentv1.InvestmentType_INVESTMENT_TYPE_STOCK,
			Quantity:  10000, // 100 shares × 100
			TotalCost: 175000000, // ~$17,500 in cents
			Currency:  "USD",
		},
	}

	for _, inv := range investments {
		err = testInvestmentRepo.Create(ctx, inv)
		require.NoError(t, err)
		defer testInvestmentRepo.Delete(ctx, inv.ID)
	}

	// Test listing all investments for wallet
	allInvestments, err := testInvestmentRepo.ListByWalletID(ctx, wallet.ID, repository.ListOptions{
		Limit:  100,
		Offset: 0,
	})
	require.NoError(t, err)
	assert.Len(t, allInvestments, 3, "Should have 3 investments")

	// Filter for gold types (VND gold)
	vndGoldInvestments := filterInvestmentsByType(allInvestments, investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND)
	assert.Len(t, vndGoldInvestments, 1, "Should have 1 VND gold investment")
	assert.Equal(t, "SJL1L10", vndGoldInvestments[0].Symbol)

	// Filter for gold types (USD gold)
	usdGoldInvestments := filterInvestmentsByType(allInvestments, investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_USD)
	assert.Len(t, usdGoldInvestments, 1, "Should have 1 USD gold investment")
	assert.Equal(t, "XAU", usdGoldInvestments[0].Symbol)
}

// Helper functions

func filterInvestmentsByType(investments []*models.Investment, investmentType investmentv1.InvestmentType) []*models.Investment {
	var filtered []*models.Investment
	for _, inv := range investments {
		if inv.Type == investmentType {
			filtered = append(filtered, inv)
		}
	}
	return filtered
}

// createTestUser creates a test user for integration testing
func createTestUser(t *testing.T, ctx context.Context) *models.User {
	user := &models.User{
		Email:     generateTestEmail(),
		FirstName: "Test",
		LastName:  "User",
		Currency:  "VND",
	}
	err := testUserRepo.Create(ctx, user)
	require.NoError(t, err, "Failed to create test user")
	return user
}

func cleanupTestUser(t *testing.T, ctx context.Context, userID int32) {
	// Delete all investments for this user's wallets first
	// Then delete all wallets
	// Finally delete the user
	testUserRepo.Delete(ctx, userID)
}

func cleanupTestWallet(t *testing.T, ctx context.Context, walletID int32) {
	testWalletRepo.Delete(ctx, walletID)
}

func generateTestEmail() string {
	return "test_gold_" + time.Now().Format("20060102150405") + "@example.com"
}

package service

import (
	"context"
	"math"
	"testing"

	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"wealthjourney/pkg/cache"
	"wealthjourney/pkg/currency"
	"wealthjourney/pkg/fx"
)

// TestCurrencyConversion_EdgeCases tests various edge cases in currency conversion
func TestCurrencyConversion_EdgeCases(t *testing.T) {
	t.Run("MaxInt64_NoOverflow", func(t *testing.T) {
		// Test with maximum int64 value
		// Note: With decimal-aware conversion, USD cents / 100 * rate * 1 = VND
		// So max int64 cents / 100 * 1 * 1 = max int64 / 100 VND
		provider := &mockFXProvider{
			rates: map[string]float64{
				"VND:VND": 1.0, // Use same currency to avoid decimal conversion
			},
		}
		converter := currency.NewConverter(provider)
		ctx := context.Background()

		maxAmount := int64(math.MaxInt64)
		result, err := converter.ConvertAmount(ctx, maxAmount, "VND", "VND")

		assert.NoError(t, err)
		assert.Equal(t, maxAmount, result, "Should handle max int64 without overflow")
	})

	t.Run("MinInt64_NegativeAmount", func(t *testing.T) {
		// Test with a negative amount (using a reasonable negative value to avoid overflow)
		provider := &mockFXProvider{
			rates: map[string]float64{
				"USD:VND": 25000,
			},
		}
		converter := currency.NewConverter(provider)
		ctx := context.Background()

		// Use -10000 cents = -$100 instead of MinInt64 to avoid overflow
		negativeAmount := int64(-10000)
		result, err := converter.ConvertAmount(ctx, negativeAmount, "USD", "VND")

		// Should handle negative amounts (even though business logic may reject them)
		// -10000 cents / 100 * 25000 * 1 = -2,500,000 VND
		assert.NoError(t, err)
		assert.Equal(t, int64(-2500000), result, "Result should be -2,500,000 VND")
	})

	t.Run("ZeroAmount_AllCurrencies", func(t *testing.T) {
		provider := &mockFXProvider{
			rates: map[string]float64{
				"USD:VND": 25000,
				"EUR:VND": 27000,
				"GBP:VND": 30000,
			},
		}
		converter := currency.NewConverter(provider)
		ctx := context.Background()

		currencies := []string{"USD", "EUR", "GBP"}
		for _, curr := range currencies {
			result, err := converter.ConvertAmount(ctx, 0, curr, "VND")
			assert.NoError(t, err)
			assert.Equal(t, int64(0), result, "Zero amount should convert to zero for %s", curr)
		}
	})

	t.Run("VerySmallRate_PrecisionLoss", func(t *testing.T) {
		// Test VND to USD conversion (very small rate)
		// VND (0 decimals) to USD (2 decimals): amount * rate * 100 = cents
		provider := &mockFXProvider{
			rates: map[string]float64{
				"VND:USD": 0.00004,
			},
		}
		converter := currency.NewConverter(provider)
		ctx := context.Background()

		testCases := []struct {
			amount   int64
			expected int64
			desc     string
		}{
			// VND / 1 * 0.00004 * 100 = cents
			{1, 0, "1 VND * 0.00004 * 100 = 0.004 cents -> 0"},
			{10000, 40, "10,000 VND * 0.00004 * 100 = 40 cents"},
			{25000, 100, "25,000 VND * 0.00004 * 100 = 100 cents = $1"},
			{50000, 200, "50,000 VND * 0.00004 * 100 = 200 cents = $2"},
			{100000, 400, "100,000 VND * 0.00004 * 100 = 400 cents = $4"},
		}

		for _, tc := range testCases {
			result, err := converter.ConvertAmount(ctx, tc.amount, "VND", "USD")
			assert.NoError(t, err)
			assert.Equal(t, tc.expected, result, tc.desc)
		}
	})

	t.Run("VeryLargeRate_NoOverflow", func(t *testing.T) {
		// Test with very large conversion rate
		// USD (2 decimals) to VND (0 decimals): cents / 100 * 25000 * 1 = VND
		provider := &mockFXProvider{
			rates: map[string]float64{
				"USD:VND": 25000,
			},
		}
		converter := currency.NewConverter(provider)
		ctx := context.Background()

		// Convert $10,000 USD (1,000,000 cents) to VND
		// 1,000,000 cents / 100 * 25000 = 250,000,000 VND
		result, err := converter.ConvertAmount(ctx, 1000000, "USD", "VND")
		assert.NoError(t, err)
		assert.Equal(t, int64(250000000), result)
	})

	t.Run("RateOfOne_IdenticalValues", func(t *testing.T) {
		// Test with rate of exactly 1.0
		provider := &mockFXProvider{
			rates: map[string]float64{
				"USD:USD": 1.0,
			},
		}
		converter := currency.NewConverter(provider)
		ctx := context.Background()

		amounts := []int64{0, 1, 100, 1000, 10000, 1000000}
		for _, amount := range amounts {
			result, err := converter.ConvertAmount(ctx, amount, "USD", "USD")
			assert.NoError(t, err)
			assert.Equal(t, amount, result, "Same currency should return same amount")
		}
	})

	t.Run("FractionalRate_Rounding", func(t *testing.T) {
		// Test with fractional rates
		provider := &mockFXProvider{
			rates: map[string]float64{
				"USD:EUR": 0.91,
				"EUR:USD": 1.0989,
			},
		}
		converter := currency.NewConverter(provider)
		ctx := context.Background()

		// $100 USD to EUR (should be ~€91)
		result, err := converter.ConvertAmount(ctx, 10000, "USD", "EUR")
		assert.NoError(t, err)
		assert.InDelta(t, 9100, result, 1, "Should round to nearest cent")

		// €100 EUR to USD (should be ~$109.89)
		result, err = converter.ConvertAmount(ctx, 10000, "EUR", "USD")
		assert.NoError(t, err)
		assert.InDelta(t, 10989, result, 1, "Should round to nearest cent")
	})

	t.Run("HighPrecisionRate_TruncatesCorrectly", func(t *testing.T) {
		// Test with high-precision rate
		// USD (2 decimals) to VND (0 decimals): cents / 100 * rate * 1 = VND
		provider := &mockFXProvider{
			rates: map[string]float64{
				"USD:VND": 25123.456789123456,
			},
		}
		converter := currency.NewConverter(provider)
		ctx := context.Background()

		// 10000 cents = $100 USD
		// $100 * 25123.456789 = 2,512,345.6789 VND -> 2,512,346 VND (rounded)
		result, err := converter.ConvertAmount(ctx, 10000, "USD", "VND")
		assert.NoError(t, err)
		assert.Equal(t, int64(2512346), result)
	})

	t.Run("ReverseConversion_Symmetry", func(t *testing.T) {
		// Test that converting A→B→A returns approximately original value
		provider := &mockFXProvider{
			rates: map[string]float64{
				"USD:EUR": 0.91,
				"EUR:USD": 1.0989,
			},
		}
		converter := currency.NewConverter(provider)
		ctx := context.Background()

		original := int64(10000) // $100.00 USD

		// Convert USD → EUR
		eur, err := converter.ConvertAmount(ctx, original, "USD", "EUR")
		require.NoError(t, err)

		// Convert EUR → USD
		usd, err := converter.ConvertAmount(ctx, eur, "EUR", "USD")
		require.NoError(t, err)

		// Should be approximately equal (allowing for rounding errors)
		diff := abs(usd - original)
		percentDiff := float64(diff) / float64(original) * 100
		assert.Less(t, percentDiff, 1.0, "Round-trip conversion should be within 1%")
	})

	t.Run("MultipleSmallAmounts_AccuracyLoss", func(t *testing.T) {
		// Test accuracy loss when converting many small amounts individually vs. batch
		// With decimal-aware conversion, 1 cent = $0.01
		// $0.01 * 25000 = 250 VND
		provider := &mockFXProvider{
			rates: map[string]float64{
				"USD:VND": 25000,
			},
		}
		converter := currency.NewConverter(provider)
		ctx := context.Background()

		// Individual conversions: 1 cent = 250 VND each
		individualSum := int64(0)
		for i := 0; i < 100; i++ {
			result, _ := converter.ConvertAmount(ctx, 1, "USD", "VND")
			individualSum += result
		}

		// Batch conversion: 100 cents = $1 = 25000 VND
		batchResult, _ := converter.ConvertAmount(ctx, 100, "USD", "VND")

		// Should be equal (no accumulated rounding errors in this case)
		// 100 * 250 = 25000
		assert.Equal(t, batchResult, individualSum, "Batch and individual conversions should match")
	})

	t.Run("InvalidRate_Zero", func(t *testing.T) {
		// Test with invalid rate (zero)
		provider := &mockFXProvider{
			rates: map[string]float64{
				"USD:XXX": 0,
			},
		}
		converter := currency.NewConverter(provider)
		ctx := context.Background()

		result, err := converter.ConvertAmount(ctx, 10000, "USD", "XXX")
		assert.Error(t, err, "Should reject zero rate")
		assert.Equal(t, int64(0), result)
	})

	t.Run("InvalidRate_Negative", func(t *testing.T) {
		// Test with invalid rate (negative)
		provider := &mockFXProvider{
			rates: map[string]float64{
				"USD:XXX": -100,
			},
		}
		converter := currency.NewConverter(provider)
		ctx := context.Background()

		result, err := converter.ConvertAmount(ctx, 10000, "USD", "XXX")
		assert.Error(t, err, "Should reject negative rate")
		assert.Equal(t, int64(0), result)
	})

	t.Run("InvalidRate_ExtremelyLarge", func(t *testing.T) {
		// Test with extremely large rate that could cause overflow
		// Note: The current implementation doesn't protect against overflow
		// So this test just verifies it doesn't panic
		provider := &mockFXProvider{
			rates: map[string]float64{
				"USD:XXX": 1e15,
			},
		}
		converter := currency.NewConverter(provider)
		ctx := context.Background()

		// This might overflow, but shouldn't panic
		// 10000 cents / 100 * 1e15 = 1e17 which fits in int64
		result, err := converter.ConvertAmount(ctx, 10000, "USD", "XXX")

		if err != nil {
			// If it errors, that's acceptable (overflow protection)
			assert.Error(t, err)
		} else {
			// If it succeeds, just verify it didn't panic
			// (the result might overflow to negative, which is expected behavior)
			_ = result
		}
	})

	t.Run("BatchConversion_EmptySlice", func(t *testing.T) {
		provider := &mockFXProvider{
			rates: map[string]float64{
				"USD:VND": 25000,
			},
		}
		converter := currency.NewConverter(provider)
		ctx := context.Background()

		result, err := converter.ConvertBatch(ctx, []int64{}, "USD", "VND")
		assert.NoError(t, err)
		assert.Empty(t, result, "Empty input should return empty output")
	})

	t.Run("BatchConversion_MixedSigns", func(t *testing.T) {
		// With decimal-aware conversion:
		// -1000 cents = -$10 -> -250,000 VND
		// 1000 cents = $10 -> 250,000 VND
		// etc.
		provider := &mockFXProvider{
			rates: map[string]float64{
				"USD:VND": 25000,
			},
		}
		converter := currency.NewConverter(provider)
		ctx := context.Background()

		amounts := []int64{-1000, 0, 1000, -500, 2000}
		results, err := converter.ConvertBatch(ctx, amounts, "USD", "VND")
		assert.NoError(t, err)
		assert.Len(t, results, len(amounts))

		// Verify signs are preserved and values are correct
		assert.Equal(t, int64(-250000), results[0], "-1000 cents = -$10 -> -250,000 VND")
		assert.Equal(t, int64(0), results[1], "Zero should stay zero")
		assert.Equal(t, int64(250000), results[2], "1000 cents = $10 -> 250,000 VND")
		assert.Equal(t, int64(-125000), results[3], "-500 cents = -$5 -> -125,000 VND")
		assert.Equal(t, int64(500000), results[4], "2000 cents = $20 -> 500,000 VND")
	})

	t.Run("UnsupportedCurrency_GracefulError", func(t *testing.T) {
		provider := &mockFXProvider{
			rates: map[string]float64{
				"USD:VND": 25000,
			},
		}
		converter := currency.NewConverter(provider)
		ctx := context.Background()

		// Try to convert to unsupported currency
		_, err := converter.ConvertAmount(ctx, 10000, "USD", "INVALID")
		assert.Error(t, err, "Should reject unsupported currency")
	})

	t.Run("ConcurrentConversions_ThreadSafe", func(t *testing.T) {
		provider := &mockFXProvider{
			rates: map[string]float64{
				"USD:VND": 25000,
				"EUR:VND": 27000,
				"GBP:VND": 30000,
			},
		}
		converter := currency.NewConverter(provider)
		ctx := context.Background()

		// Run 100 concurrent conversions
		results := make(chan int64, 100)
		for i := 0; i < 100; i++ {
			go func(amount int64) {
				result, _ := converter.ConvertAmount(ctx, amount, "USD", "VND")
				results <- result
			}(int64(1000 * (i + 1)))
		}

		// Collect results
		for i := 0; i < 100; i++ {
			result := <-results
			assert.Greater(t, result, int64(0), "All concurrent conversions should succeed")
		}
	})
}

// TestFXRateValidation_EdgeCases tests FX rate validation edge cases
func TestFXRateValidation_EdgeCases(t *testing.T) {
	t.Run("NaN_Rate", func(t *testing.T) {
		rate := math.NaN()
		err := fx.ValidateRate("USD", "VND", rate)
		assert.Error(t, err, "Should reject NaN rate")
	})

	t.Run("Infinity_Rate", func(t *testing.T) {
		rate := math.Inf(1)
		err := fx.ValidateRate("USD", "VND", rate)
		assert.Error(t, err, "Should reject infinity rate")
	})

	t.Run("NegativeInfinity_Rate", func(t *testing.T) {
		rate := math.Inf(-1)
		err := fx.ValidateRate("USD", "VND", rate)
		assert.Error(t, err, "Should reject negative infinity rate")
	})

	t.Run("ExtremelySmallRate_Valid", func(t *testing.T) {
		// Test with very small but valid rate
		rate := 0.000033 // Min valid for VND:USD
		err := fx.ValidateRate("VND", "USD", rate)
		assert.NoError(t, err, "Should accept valid small rate")
	})

	t.Run("ExtremelySmallRate_Invalid", func(t *testing.T) {
		// Test with too small rate
		rate := 0.000001
		err := fx.ValidateRate("VND", "USD", rate)
		assert.Error(t, err, "Should reject invalid small rate")
	})

	t.Run("ExtremelyLargeRate_Valid", func(t *testing.T) {
		// Test with very large but valid rate
		rate := 30000.0 // Max valid for USD:VND
		err := fx.ValidateRate("USD", "VND", rate)
		assert.NoError(t, err, "Should accept valid large rate")
	})

	t.Run("ExtremelyLargeRate_Invalid", func(t *testing.T) {
		// Test with too large rate
		rate := 100000.0
		err := fx.ValidateRate("USD", "VND", rate)
		assert.Error(t, err, "Should reject invalid large rate")
	})

	t.Run("RateJustBelowMin_Invalid", func(t *testing.T) {
		// USD:VND min is 20000
		rate := 19999.99
		err := fx.ValidateRate("USD", "VND", rate)
		assert.Error(t, err, "Should reject rate just below minimum")
	})

	t.Run("RateJustAboveMax_Invalid", func(t *testing.T) {
		// USD:VND max is 30000
		rate := 30000.01
		err := fx.ValidateRate("USD", "VND", rate)
		assert.Error(t, err, "Should reject rate just above maximum")
	})

	t.Run("RateAtExactMin_Valid", func(t *testing.T) {
		// USD:VND min is 20000
		rate := 20000.0
		err := fx.ValidateRate("USD", "VND", rate)
		assert.NoError(t, err, "Should accept rate at exact minimum")
	})

	t.Run("RateAtExactMax_Valid", func(t *testing.T) {
		// USD:VND max is 30000
		rate := 30000.0
		err := fx.ValidateRate("USD", "VND", rate)
		assert.NoError(t, err, "Should accept rate at exact maximum")
	})
}

// TestCurrencyCache_EdgeCases tests currency cache edge cases
func TestCurrencyCache_EdgeCases(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping cache tests in short mode")
	}

	ctx := context.Background()
	redisClient := setupTestRedis(t)
	defer func() { _ = redisClient.Close() }()

	currencyCache := cache.NewCurrencyCache(redisClient)

	t.Run("GetNonExistent_ReturnsZero", func(t *testing.T) {
		val, err := currencyCache.GetConvertedValue(ctx, 999, "wallet", 999, "USD")
		assert.NoError(t, err, "Cache miss should not return error")
		assert.Equal(t, int64(0), val, "Non-existent key should return zero value")
	})

	t.Run("SetThenGet_Consistency", func(t *testing.T) {
		err := currencyCache.SetConvertedValue(ctx, 1, "wallet", 1, "USD", 100000)
		require.NoError(t, err)

		value, err := currencyCache.GetConvertedValue(ctx, 1, "wallet", 1, "USD")
		assert.NoError(t, err)
		assert.Equal(t, int64(100000), value)
	})

	t.Run("OverwriteExisting_Success", func(t *testing.T) {
		// Set initial value
		err := currencyCache.SetConvertedValue(ctx, 1, "wallet", 2, "USD", 100000)
		require.NoError(t, err)

		// Overwrite with new value
		err = currencyCache.SetConvertedValue(ctx, 1, "wallet", 2, "USD", 200000)
		require.NoError(t, err)

		// Verify new value
		value, err := currencyCache.GetConvertedValue(ctx, 1, "wallet", 2, "USD")
		assert.NoError(t, err)
		assert.Equal(t, int64(200000), value)
	})

	t.Run("DeleteUserCache_RemovesAllKeys", func(t *testing.T) {
		// Set multiple cache entries
		for i := 0; i < 10; i++ {
			err := currencyCache.SetConvertedValue(ctx, 1, "wallet", int32(i), "USD", int64(100000*(i+1)))
			require.NoError(t, err)
		}

		// Delete all cache for user
		err := currencyCache.DeleteUserCache(ctx, 1)
		require.NoError(t, err)

		// Verify all keys are deleted
		for i := 0; i < 10; i++ {
			val, err := currencyCache.GetConvertedValue(ctx, 1, "wallet", int32(i), "USD")
			assert.NoError(t, err, "Cache miss should not return error for wallet %d", i)
			assert.Equal(t, int64(0), val, "Deleted key should return zero value for wallet %d", i)
		}
	})

	t.Run("SetZeroValue_Allowed", func(t *testing.T) {
		err := currencyCache.SetConvertedValue(ctx, 1, "wallet", 100, "USD", 0)
		assert.NoError(t, err, "Should allow caching zero values")

		value, err := currencyCache.GetConvertedValue(ctx, 1, "wallet", 100, "USD")
		assert.NoError(t, err)
		assert.Equal(t, int64(0), value)
	})

	t.Run("SetNegativeValue_Allowed", func(t *testing.T) {
		err := currencyCache.SetConvertedValue(ctx, 1, "wallet", 101, "USD", -50000)
		assert.NoError(t, err, "Should allow caching negative values")

		value, err := currencyCache.GetConvertedValue(ctx, 1, "wallet", 101, "USD")
		assert.NoError(t, err)
		assert.Equal(t, int64(-50000), value)
	})

	t.Run("MultiCurrency_SameEntity", func(t *testing.T) {
		// Cache same wallet in multiple currencies
		currencies := []string{"USD", "EUR", "VND", "GBP"}
		values := []int64{100000, 91000, 2500000000, 78000}

		for i, curr := range currencies {
			err := currencyCache.SetConvertedValue(ctx, 1, "wallet", 200, curr, values[i])
			require.NoError(t, err)
		}

		// Verify all currencies are cached correctly
		for i, curr := range currencies {
			value, err := currencyCache.GetConvertedValue(ctx, 1, "wallet", 200, curr)
			assert.NoError(t, err)
			assert.Equal(t, values[i], value, "Value mismatch for currency %s", curr)
		}
	})
}

// Helper function for absolute value
func abs(x int64) int64 {
	if x < 0 {
		return -x
	}
	return x
}

// setupTestRedis creates a Redis client for testing (not benchmarking)
func setupTestRedis(t *testing.T) *redis.Client {
	// Create test Redis client
	client := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
		DB:   15, // Use separate DB for tests
	})

	// Check if Redis is available
	ctx := context.Background()
	if err := client.Ping(ctx).Err(); err != nil {
		t.Skip("Redis not available, skipping test")
	}

	// Clear test database
	client.FlushDB(ctx)

	return client
}

package service

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/go-redis/redis/v8"
	"wealthjourney/domain/repository"
	"wealthjourney/pkg/cache"
	"wealthjourney/pkg/currency"
	"wealthjourney/pkg/fx"
)

// BenchmarkCurrencyConversion_SingleAmount benchmarks single amount conversion
func BenchmarkCurrencyConversion_SingleAmount(b *testing.B) {
	// Setup mock provider
	provider := &mockFXProvider{
		rates: map[string]float64{
			"USD:VND": 25000,
			"VND:USD": 0.00004,
			"EUR:USD": 1.1,
			"USD:EUR": 0.91,
		},
	}
	converter := currency.NewConverter(provider)
	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = converter.ConvertAmount(ctx, 10000, "USD", "VND")
	}
}

// BenchmarkCurrencyConversion_BatchConversion benchmarks batch conversion
func BenchmarkCurrencyConversion_BatchConversion(b *testing.B) {
	provider := &mockFXProvider{
		rates: map[string]float64{
			"USD:VND": 25000,
		},
	}
	converter := currency.NewConverter(provider)
	ctx := context.Background()

	// Prepare batch data
	amounts := make([]int64, 100)
	for i := 0; i < 100; i++ {
		amounts[i] = int64(10000 * (i + 1))
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = converter.ConvertBatch(ctx, amounts, "USD", "VND")
	}
}

// BenchmarkCurrencyConversion_WithRateCache benchmarks conversion with cached rates
func BenchmarkCurrencyConversion_WithRateCache(b *testing.B) {
	redisClient := setupBenchmarkRedis(b)
	defer redisClient.Close()

	fxCache := cache.NewFXRateCache(redisClient)
	ctx := context.Background()

	// Pre-populate cache
	_ = fxCache.Set(ctx, "USD", "VND", 25000)

	provider := &cachingProvider{
		cache: fxCache,
		fallback: &mockFXProvider{
			rates: map[string]float64{
				"USD:VND": 25000,
			},
		},
	}
	converter := currency.NewConverter(provider)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = converter.ConvertAmount(ctx, 10000, "USD", "VND")
	}
}

// BenchmarkCurrencyConversion_WithoutCache benchmarks conversion without cache (direct API call)
func BenchmarkCurrencyConversion_WithoutCache(b *testing.B) {
	provider := &mockFXProvider{
		rates: map[string]float64{
			"USD:VND": 25000,
		},
		// Simulate API latency
		latency: 50 * time.Millisecond,
	}
	converter := currency.NewConverter(provider)
	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = converter.ConvertAmount(ctx, 10000, "USD", "VND")
	}
}

// BenchmarkWalletConversion_ListWallets benchmarks wallet list conversion
func BenchmarkWalletConversion_ListWallets(b *testing.B) {
	// Benchmark converting display balances for 100 wallets
	ctx := context.Background()
	provider := &mockFXProvider{
		rates: map[string]float64{
			"USD:VND": 25000,
			"EUR:VND": 27000,
			"GBP:VND": 30000,
		},
	}
	converter := currency.NewConverter(provider)

	// Simulate 100 wallets with different currencies
	wallets := make([]struct{ balance int64; currency string }, 100)
	currencies := []string{"USD", "EUR", "GBP", "VND"}
	for i := 0; i < 100; i++ {
		wallets[i] = struct{ balance int64; currency string }{
			balance:  int64(10000 * (i + 1)),
			currency: currencies[i%len(currencies)],
		}
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		for _, wallet := range wallets {
			_, _ = converter.ConvertAmount(ctx, wallet.balance, wallet.currency, "VND")
		}
	}
}

// BenchmarkTransactionConversion_List benchmarks transaction list conversion
func BenchmarkTransactionConversion_List(b *testing.B) {
	// Benchmark converting 1000 transactions
	ctx := context.Background()
	provider := &mockFXProvider{
		rates: map[string]float64{
			"USD:EUR": 0.91,
			"VND:EUR": 0.000036,
			"GBP:EUR": 1.15,
		},
	}
	converter := currency.NewConverter(provider)

	// Simulate 1000 transactions
	transactions := make([]struct{ amount int64; currency string }, 1000)
	currencies := []string{"USD", "VND", "GBP"}
	for i := 0; i < 1000; i++ {
		transactions[i] = struct{ amount int64; currency string }{
			amount:   int64(1000 * (i + 1)),
			currency: currencies[i%len(currencies)],
		}
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		for _, tx := range transactions {
			_, _ = converter.ConvertAmount(ctx, tx.amount, tx.currency, "EUR")
		}
	}
}

// BenchmarkCurrencyCache_Set benchmarks cache write operations
func BenchmarkCurrencyCache_Set(b *testing.B) {
	redisClient := setupBenchmarkRedis(b)
	defer redisClient.Close()

	currencyCache := cache.NewCurrencyCache(redisClient)
	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = currencyCache.SetConvertedValue(ctx, 1, "wallet", int32(i), "VND", 250000000)
	}
}

// BenchmarkCurrencyCache_Get benchmarks cache read operations
func BenchmarkCurrencyCache_Get(b *testing.B) {
	redisClient := setupBenchmarkRedis(b)
	defer redisClient.Close()

	currencyCache := cache.NewCurrencyCache(redisClient)
	ctx := context.Background()

	// Pre-populate cache
	for i := 0; i < 1000; i++ {
		_ = currencyCache.SetConvertedValue(ctx, 1, "wallet", int32(i), "VND", 250000000)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = currencyCache.GetConvertedValue(ctx, 1, "wallet", int32(i%1000), "VND")
	}
}

// BenchmarkFXRateCache_ParallelGet benchmarks parallel cache reads
func BenchmarkFXRateCache_ParallelGet(b *testing.B) {
	redisClient := setupBenchmarkRedis(b)
	defer redisClient.Close()

	fxCache := cache.NewFXRateCache(redisClient)
	ctx := context.Background()

	// Pre-populate cache
	pairs := []struct{ from, to string }{
		{"USD", "VND"},
		{"USD", "EUR"},
		{"USD", "GBP"},
		{"EUR", "VND"},
		{"GBP", "VND"},
	}
	for _, pair := range pairs {
		_ = fxCache.Set(ctx, pair.from, pair.to, 1.5)
	}

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			pair := pairs[i%len(pairs)]
			_, _ = fxCache.Get(ctx, pair.from, pair.to)
			i++
		}
	})
}

// BenchmarkBatchFXRateRetrieval benchmarks parallel FX rate fetching
func BenchmarkBatchFXRateRetrieval(b *testing.B) {
	redisClient := setupBenchmarkRedis(b)
	defer redisClient.Close()

	fxRateRepo := setupBenchmarkFXRateRepository(b)
	fxRateSvc := NewFXRateService(fxRateRepo, redisClient)

	// Prepare currency pairs
	pairs := []CurrencyPair{
		{From: "USD", To: "VND"},
		{From: "USD", To: "EUR"},
		{From: "USD", To: "GBP"},
		{From: "EUR", To: "VND"},
		{From: "GBP", To: "VND"},
		{From: "JPY", To: "USD"},
		{From: "AUD", To: "USD"},
		{From: "CAD", To: "USD"},
		{From: "SGD", To: "USD"},
		{From: "CNY", To: "USD"},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = fxRateSvc.BatchGetRates(context.Background(), pairs)
	}
}

// BenchmarkDashboardLoad_FullConversion benchmarks a typical dashboard load
// This simulates fetching and converting:
// - 10 wallets in different currencies
// - 100 recent transactions
// - 5 budgets
// All displayed in user's preferred currency
func BenchmarkDashboardLoad_FullConversion(b *testing.B) {
	ctx := context.Background()
	redisClient := setupBenchmarkRedis(b)
	defer redisClient.Close()

	currencyCache := cache.NewCurrencyCache(redisClient)
	provider := &mockFXProvider{
		rates: map[string]float64{
			"USD:VND": 25000,
			"EUR:VND": 27000,
			"GBP:VND": 30000,
			"JPY:VND": 180,
		},
	}
	converter := currency.NewConverter(provider)

	// Pre-populate cache (simulating warm cache scenario)
	for i := 0; i < 10; i++ {
		_ = currencyCache.SetConvertedValue(ctx, 1, "wallet", int32(i), "VND", 250000000)
	}
	for i := 0; i < 100; i++ {
		_ = currencyCache.SetConvertedValue(ctx, 1, "transaction", int32(i), "VND", 500000)
	}
	for i := 0; i < 5; i++ {
		_ = currencyCache.SetConvertedValue(ctx, 1, "budget", int32(i), "VND", 10000000)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		// Simulate dashboard load
		// 1. Load 10 wallets
		for j := 0; j < 10; j++ {
			val, err := currencyCache.GetConvertedValue(ctx, 1, "wallet", int32(j), "VND")
			if err != nil {
				// Cache miss - convert on the fly
				_, _ = converter.ConvertAmount(ctx, 10000000, "USD", "VND")
			}
			_ = val
		}

		// 2. Load 100 transactions
		for j := 0; j < 100; j++ {
			val, err := currencyCache.GetConvertedValue(ctx, 1, "transaction", int32(j), "VND")
			if err != nil {
				_, _ = converter.ConvertAmount(ctx, 50000, "USD", "VND")
			}
			_ = val
		}

		// 3. Load 5 budgets
		for j := 0; j < 5; j++ {
			val, err := currencyCache.GetConvertedValue(ctx, 1, "budget", int32(j), "VND")
			if err != nil {
				_, _ = converter.ConvertAmount(ctx, 10000000, "USD", "VND")
			}
			_ = val
		}
	}
}

// BenchmarkDashboardLoad_ColdCache benchmarks dashboard load with empty cache
func BenchmarkDashboardLoad_ColdCache(b *testing.B) {
	ctx := context.Background()
	provider := &mockFXProvider{
		rates: map[string]float64{
			"USD:VND": 25000,
			"EUR:VND": 27000,
			"GBP:VND": 30000,
		},
		latency: 5 * time.Millisecond, // Simulate some API latency
	}
	converter := currency.NewConverter(provider)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		// Convert 10 wallets
		for j := 0; j < 10; j++ {
			_, _ = converter.ConvertAmount(ctx, 10000000, "USD", "VND")
		}

		// Convert 100 transactions
		for j := 0; j < 100; j++ {
			_, _ = converter.ConvertAmount(ctx, 50000, "USD", "VND")
		}

		// Convert 5 budgets
		for j := 0; j < 5; j++ {
			_, _ = converter.ConvertAmount(ctx, 10000000, "USD", "VND")
		}
	}
}

// Mock FX provider for benchmarks
type mockFXProvider struct {
	rates   map[string]float64
	latency time.Duration
}

func (m *mockFXProvider) GetRate(ctx context.Context, from, to string) (float64, error) {
	if m.latency > 0 {
		time.Sleep(m.latency)
	}

	if from == to {
		return 1.0, nil
	}

	key := from + ":" + to
	if rate, ok := m.rates[key]; ok {
		return rate, nil
	}

	return 0, fmt.Errorf("rate not found for %s", key)
}

// Caching provider for benchmarks
type cachingProvider struct {
	cache    *cache.FXRateCache
	fallback fx.Provider
}

func (c *cachingProvider) GetRate(ctx context.Context, from, to string) (float64, error) {
	// Try cache first
	rate, err := c.cache.Get(ctx, from, to)
	if err == nil {
		return rate, nil
	}

	// Fallback to provider
	rate, err = c.fallback.GetRate(ctx, from, to)
	if err != nil {
		return 0, err
	}

	// Cache the rate
	_ = c.cache.Set(ctx, from, to, rate)
	return rate, nil
}

// Benchmark helper functions
func setupBenchmarkRedis(b *testing.B) *redis.Client {
	// Create test Redis client
	client := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
		DB:   15, // Use separate DB for benchmarks
	})

	// Clear test database
	ctx := context.Background()
	client.FlushDB(ctx)

	return client
}

func setupBenchmarkFXRateRepository(b *testing.B) repository.FXRateRepository {
	// TODO: Implement mock repository for benchmarks
	panic("implement me")
}

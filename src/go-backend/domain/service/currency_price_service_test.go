package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"wealthjourney/pkg/cache"
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// newMiniredisClient starts a miniredis server and returns a connected
// *redis.Client. The server and client are closed automatically at the end
// of the test.
func newMiniredisClient(t *testing.T) (*redis.Client, *miniredis.Miniredis) {
	t.Helper()
	mr, err := miniredis.Run()
	require.NoError(t, err, "failed to start miniredis")

	client := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() {
		_ = client.Close()
		mr.Close()
	})
	return client, mr
}

// sampleCurrencyPrices returns a small set of realistic-looking currency
// prices used across multiple tests.
func sampleCurrencyPrices() []*CachedCurrencyPrice {
	return []*CachedCurrencyPrice{
		{
			TypeCode:   "USD",
			Name:       "US Dollar",
			Buy:        25_000,
			Sell:       25_300,
			ChangeBuy:  100,
			ChangeSell: 100,
			Currency:   "VND",
			UpdateTime: time.Now().Truncate(time.Second),
		},
		{
			TypeCode:   "EUR",
			Name:       "Euro",
			Buy:        27_000,
			Sell:       27_500,
			ChangeBuy:  -50,
			ChangeSell: -50,
			Currency:   "VND",
			UpdateTime: time.Now().Truncate(time.Second),
		},
	}
}

// newCurrencyPriceServiceForTest is the test constructor that injects a
// WaterfallCurrencyFetcher and a CurrencyPriceCache directly so tests
// are fully independent of external APIs and real Redis.
func newCurrencyPriceServiceForTest(
	waterfall *WaterfallCurrencyFetcher,
	currCache *cache.CurrencyPriceCache,
) CurrencyPriceService {
	return &currencyPriceService{
		waterfall: waterfall,
		cache:     currCache,
	}
}

// ---------------------------------------------------------------------------
// TestCurrencyPriceService_FetchAllPrices_AggregateCache
// ---------------------------------------------------------------------------

// TestCurrencyPriceService_AggregateCache_Hit verifies that when the
// aggregate cache already holds data, no external fetcher is called.
func TestCurrencyPriceService_AggregateCache_Hit(t *testing.T) {
	ctx := context.Background()
	client, _ := newMiniredisClient(t)
	currCache := cache.NewCurrencyPriceCache(client)

	// Pre-populate aggregate cache
	cached := []*cache.CachedCurrencyPrice{
		{TypeCode: "USD", Name: "US Dollar", Buy: 25_000, Sell: 25_300, Currency: "VND", UpdateTime: time.Now().Unix()},
	}
	require.NoError(t, currCache.SetAll(ctx, cached, cache.AllCurrencyPricesCacheTTL))

	// Build a waterfall whose fetchers should never be called
	primary := &mockCurrencyPriceFetcher{}
	health := &mockHealthTracker{}
	waterfall := NewWaterfallCurrencyFetcher([]CurrencyPriceFetcher{primary}, health)

	svc := newCurrencyPriceServiceForTest(waterfall, currCache)
	got, err := svc.FetchAllPrices(ctx)

	require.NoError(t, err)
	require.Len(t, got, 1)
	assert.Equal(t, "USD", got[0].TypeCode)
	assert.Equal(t, int64(25_000), got[0].Buy)

	// Fetcher must never have been invoked — cache hit should short-circuit
	primary.AssertNotCalled(t, "FetchCurrencyPrices", mock.Anything)
}

// ---------------------------------------------------------------------------
// TestCurrencyPriceService_Primary_Succeeds
// ---------------------------------------------------------------------------

// TestCurrencyPriceService_PrimarySucceeds verifies that when the primary
// source returns data, it is returned directly and both caches are populated.
func TestCurrencyPriceService_PrimarySucceeds(t *testing.T) {
	ctx := context.Background()
	client, _ := newMiniredisClient(t)
	currCache := cache.NewCurrencyPriceCache(client)

	want := sampleCurrencyPrices()

	primary := &mockCurrencyPriceFetcher{}
	health := &mockHealthTracker{}

	primary.On("Source").Return(SourceVangSaiGon)
	primary.On("FetchCurrencyPrices", mock.Anything).Return(want, nil)
	health.On("IsHealthy", mock.Anything, SourceVangSaiGon).Return(true)

	waterfall := NewWaterfallCurrencyFetcher([]CurrencyPriceFetcher{primary}, health)
	svc := newCurrencyPriceServiceForTest(waterfall, currCache)

	got, err := svc.FetchAllPrices(ctx)

	require.NoError(t, err)
	require.Len(t, got, len(want))
	assert.Equal(t, want[0].TypeCode, got[0].TypeCode)
	assert.Equal(t, want[0].Buy, got[0].Buy)

	// Give background goroutines a moment to write caches
	time.Sleep(50 * time.Millisecond)

	// Aggregate cache should now contain the data
	cachedAll, err := currCache.GetAll(ctx)
	require.NoError(t, err)
	require.NotNil(t, cachedAll, "aggregate cache should have been populated")

	// Emergency cache should also have been written
	emergency, err := currCache.GetEmergency(ctx)
	require.NoError(t, err)
	require.NotNil(t, emergency, "emergency cache should have been populated")
}

// ---------------------------------------------------------------------------
// TestCurrencyPriceService_PrimaryFails_FallsBackToSecondary
// ---------------------------------------------------------------------------

// TestCurrencyPriceService_PrimaryFails_FallsBackToSecondary verifies that
// when the primary source fails the waterfall tries the secondary source.
func TestCurrencyPriceService_PrimaryFails_FallsBackToSecondary(t *testing.T) {
	ctx := context.Background()
	client, _ := newMiniredisClient(t)
	currCache := cache.NewCurrencyPriceCache(client)

	want := sampleCurrencyPrices()
	fetchErr := errors.New("vangsaigon unavailable")

	primary := &mockCurrencyPriceFetcher{}
	secondary := &mockCurrencyPriceFetcher{}
	health := &mockHealthTracker{}

	primary.On("Source").Return(SourceVangSaiGon)
	primary.On("FetchCurrencyPrices", mock.Anything).Return(nil, fetchErr)
	health.On("IsHealthy", mock.Anything, SourceVangSaiGon).Return(true)
	health.On("MarkUnhealthy", mock.Anything, SourceVangSaiGon).Return(nil)

	secondary.On("Source").Return(SourceVangToday)
	secondary.On("FetchCurrencyPrices", mock.Anything).Return(want, nil)
	health.On("IsHealthy", mock.Anything, SourceVangToday).Return(true)

	waterfall := NewWaterfallCurrencyFetcher(
		[]CurrencyPriceFetcher{primary, secondary},
		health,
	)
	svc := newCurrencyPriceServiceForTest(waterfall, currCache)

	got, err := svc.FetchAllPrices(ctx)

	require.NoError(t, err)
	require.Len(t, got, len(want))
	assert.Equal(t, want[0].TypeCode, got[0].TypeCode)

	// Secondary must have been called
	secondary.AssertCalled(t, "FetchCurrencyPrices", mock.Anything)
}

// ---------------------------------------------------------------------------
// TestCurrencyPriceService_AllSourcesFail_EmergencyCacheServed
// ---------------------------------------------------------------------------

// TestCurrencyPriceService_AllSourcesFail_EmergencyCacheServed verifies that
// when all waterfall sources fail, the service falls back to the emergency
// cache and returns its stale data with no error.
func TestCurrencyPriceService_AllSourcesFail_EmergencyCacheServed(t *testing.T) {
	ctx := context.Background()
	client, _ := newMiniredisClient(t)
	currCache := cache.NewCurrencyPriceCache(client)

	stale := []*cache.CachedCurrencyPrice{
		{TypeCode: "USD", Name: "US Dollar", Buy: 24_800, Sell: 25_100, Currency: "VND", UpdateTime: time.Now().Add(-30 * time.Minute).Unix()},
	}
	require.NoError(t, currCache.SetEmergency(ctx, stale))

	primary := &mockCurrencyPriceFetcher{}
	secondary := &mockCurrencyPriceFetcher{}
	health := &mockHealthTracker{}

	primary.On("Source").Return(SourceVangSaiGon)
	primary.On("FetchCurrencyPrices", mock.Anything).Return(nil, errors.New("source A down"))
	health.On("IsHealthy", mock.Anything, SourceVangSaiGon).Return(true)
	health.On("MarkUnhealthy", mock.Anything, SourceVangSaiGon).Return(nil)

	secondary.On("Source").Return(SourceVangToday)
	secondary.On("FetchCurrencyPrices", mock.Anything).Return(nil, errors.New("source B down"))
	health.On("IsHealthy", mock.Anything, SourceVangToday).Return(true)
	health.On("MarkUnhealthy", mock.Anything, SourceVangToday).Return(nil)

	waterfall := NewWaterfallCurrencyFetcher(
		[]CurrencyPriceFetcher{primary, secondary},
		health,
	)
	svc := newCurrencyPriceServiceForTest(waterfall, currCache)

	got, err := svc.FetchAllPrices(ctx)

	require.NoError(t, err, "stale emergency data should be returned without error")
	require.Len(t, got, 1)
	assert.Equal(t, "USD", got[0].TypeCode)
	assert.Equal(t, int64(24_800), got[0].Buy)
}

// ---------------------------------------------------------------------------
// TestCurrencyPriceService_AllSourcesFail_EmergencyExpired_ReturnsError
// ---------------------------------------------------------------------------

// TestCurrencyPriceService_AllSourcesFail_EmergencyExpired_ReturnsError
// verifies that when all live sources fail AND the emergency cache is empty
// (expired or never written), the service returns an error.
func TestCurrencyPriceService_AllSourcesFail_EmergencyExpired_ReturnsError(t *testing.T) {
	ctx := context.Background()
	client, _ := newMiniredisClient(t)
	// Empty cache — no emergency data
	currCache := cache.NewCurrencyPriceCache(client)

	primary := &mockCurrencyPriceFetcher{}
	secondary := &mockCurrencyPriceFetcher{}
	health := &mockHealthTracker{}

	primary.On("Source").Return(SourceVangSaiGon)
	primary.On("FetchCurrencyPrices", mock.Anything).Return(nil, errors.New("source A down"))
	health.On("IsHealthy", mock.Anything, SourceVangSaiGon).Return(true)
	health.On("MarkUnhealthy", mock.Anything, SourceVangSaiGon).Return(nil)

	secondary.On("Source").Return(SourceVangToday)
	secondary.On("FetchCurrencyPrices", mock.Anything).Return(nil, errors.New("source B down"))
	health.On("IsHealthy", mock.Anything, SourceVangToday).Return(true)
	health.On("MarkUnhealthy", mock.Anything, SourceVangToday).Return(nil)

	waterfall := NewWaterfallCurrencyFetcher(
		[]CurrencyPriceFetcher{primary, secondary},
		health,
	)
	svc := newCurrencyPriceServiceForTest(waterfall, currCache)

	got, err := svc.FetchAllPrices(ctx)

	assert.Error(t, err, "should return error when all sources fail and no emergency cache")
	assert.Nil(t, got)
}

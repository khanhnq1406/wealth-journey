package service

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"wealthjourney/pkg/cache"
)

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

// sampleGoldPrices returns a small set of realistic gold prices used across
// multiple tests.
func sampleGoldPrices() []*CachedGoldPrice {
	return []*CachedGoldPrice{
		{
			TypeCode:   "SJC1L",
			Name:       "SJC 1 luong",
			Buy:        85_000_000,
			Sell:       87_000_000,
			ChangeBuy:  500_000,
			ChangeSell: 500_000,
			Currency:   "VND",
			UpdateTime: time.Now().Truncate(time.Second),
		},
		{
			TypeCode:   "XAUUSD",
			Name:       "Gold USD",
			Buy:        230_000,
			Sell:       231_000,
			ChangeBuy:  100,
			ChangeSell: 100,
			Currency:   "USD",
			UpdateTime: time.Now().Truncate(time.Second),
		},
	}
}

// newGoldPriceServiceForTest is the test constructor that injects a
// WaterfallGoldFetcher and a GoldPriceCache directly so tests are fully
// independent of external APIs and real Redis.
func newGoldPriceServiceForTest(
	waterfall *WaterfallGoldFetcher,
	goldCache *cache.GoldPriceCache,
) GoldPriceService {
	return &goldPriceService{
		waterfall: waterfall,
		cache:     goldCache,
	}
}

// ---------------------------------------------------------------------------
// TestGoldPriceService_FetchAllPrices_AggregateCache_Hit
// ---------------------------------------------------------------------------

// TestGoldPriceService_AggregateCache_Hit verifies that when the aggregate
// cache already holds data, no external fetcher is called.
func TestGoldPriceService_AggregateCache_Hit(t *testing.T) {
	ctx := context.Background()
	client, _ := newMiniredisClient(t)
	goldCache := cache.NewGoldPriceCache(client)

	// Pre-populate aggregate cache
	cached := []*cache.CachedGoldPrice{
		{TypeCode: "SJC1L", Name: "SJC 1 luong", Buy: 85_000_000, Sell: 87_000_000, Currency: "VND", UpdateTime: time.Now().Unix()},
	}
	require.NoError(t, goldCache.SetAll(ctx, cached, cache.AllGoldPricesCacheTTL))

	// Build a waterfall whose fetchers should never be called.
	primary := &mockGoldPriceFetcher{}
	health := &mockHealthTracker{}
	waterfall := NewWaterfallGoldFetcher([]GoldPriceFetcher{primary}, health)

	svc := newGoldPriceServiceForTest(waterfall, goldCache)
	got, err := svc.FetchAllPrices(ctx)

	require.NoError(t, err)
	require.Len(t, got, 1)
	assert.Equal(t, "SJC1L", got[0].TypeCode)
	assert.Equal(t, int64(85_000_000), got[0].Buy)

	// Fetcher must never have been invoked — cache hit should short-circuit.
	primary.AssertNotCalled(t, "FetchGoldPrices", mock.Anything)
}

// ---------------------------------------------------------------------------
// TestGoldPriceService_PrimarySucceeds
// ---------------------------------------------------------------------------

// TestGoldPriceService_PrimarySucceeds verifies that when the primary source
// returns data, it is returned directly and both caches are populated.
func TestGoldPriceService_PrimarySucceeds(t *testing.T) {
	ctx := context.Background()
	client, _ := newMiniredisClient(t)
	goldCache := cache.NewGoldPriceCache(client)

	want := sampleGoldPrices()

	primary := &mockGoldPriceFetcher{}
	health := &mockHealthTracker{}

	primary.On("Source").Return(SourceVangSaiGon)
	primary.On("FetchGoldPrices", mock.Anything).Return(want, nil)
	health.On("IsHealthy", mock.Anything, SourceVangSaiGon).Return(true)

	waterfall := NewWaterfallGoldFetcher([]GoldPriceFetcher{primary}, health)
	svc := newGoldPriceServiceForTest(waterfall, goldCache)

	got, err := svc.FetchAllPrices(ctx)

	require.NoError(t, err)
	require.Len(t, got, len(want))
	assert.Equal(t, want[0].TypeCode, got[0].TypeCode)
	assert.Equal(t, want[0].Buy, got[0].Buy)

	// Give background goroutines a moment to write caches.
	time.Sleep(50 * time.Millisecond)

	// Aggregate cache should now contain the data.
	cachedAll, err := goldCache.GetAll(ctx)
	require.NoError(t, err)
	require.NotNil(t, cachedAll, "aggregate cache should have been populated")

	// Emergency cache should also have been written.
	emergency, err := goldCache.GetEmergency(ctx)
	require.NoError(t, err)
	require.NotNil(t, emergency, "emergency cache should have been populated")
}

// ---------------------------------------------------------------------------
// TestGoldPriceService_PrimaryFails_FallsBackToSecondary
// ---------------------------------------------------------------------------

// TestGoldPriceService_PrimaryFails_FallsBackToSecondary verifies that when
// the primary source fails, the waterfall tries the secondary source, and the
// primary source is marked unhealthy.
func TestGoldPriceService_PrimaryFails_FallsBackToSecondary(t *testing.T) {
	ctx := context.Background()
	client, _ := newMiniredisClient(t)
	goldCache := cache.NewGoldPriceCache(client)

	want := sampleGoldPrices()
	fetchErr := errors.New("primary source unavailable")

	primary := &mockGoldPriceFetcher{}
	secondary := &mockGoldPriceFetcher{}
	health := &mockHealthTracker{}

	primary.On("Source").Return(SourceVangSaiGon)
	primary.On("FetchGoldPrices", mock.Anything).Return(nil, fetchErr)
	health.On("IsHealthy", mock.Anything, SourceVangSaiGon).Return(true)
	health.On("MarkUnhealthy", mock.Anything, SourceVangSaiGon).Return(nil)

	secondary.On("Source").Return(SourceVangToday)
	secondary.On("FetchGoldPrices", mock.Anything).Return(want, nil)
	health.On("IsHealthy", mock.Anything, SourceVangToday).Return(true)

	waterfall := NewWaterfallGoldFetcher(
		[]GoldPriceFetcher{primary, secondary},
		health,
	)
	svc := newGoldPriceServiceForTest(waterfall, goldCache)

	got, err := svc.FetchAllPrices(ctx)

	require.NoError(t, err)
	require.Len(t, got, len(want))
	assert.Equal(t, want[0].TypeCode, got[0].TypeCode)

	// Primary must have been marked unhealthy.
	health.AssertCalled(t, "MarkUnhealthy", mock.Anything, SourceVangSaiGon)

	// Secondary must have been called.
	secondary.AssertCalled(t, "FetchGoldPrices", mock.Anything)
}

// ---------------------------------------------------------------------------
// TestGoldPriceService_AllSourcesFail_EmergencyCacheServed
// ---------------------------------------------------------------------------

// TestGoldPriceService_AllSourcesFail_EmergencyCacheServed verifies that when
// all waterfall sources fail, the service falls back to the emergency cache
// and returns stale data without an error.
func TestGoldPriceService_AllSourcesFail_EmergencyCacheServed(t *testing.T) {
	ctx := context.Background()
	client, _ := newMiniredisClient(t)
	goldCache := cache.NewGoldPriceCache(client)

	stale := []*cache.CachedGoldPrice{
		{TypeCode: "SJC1L", Name: "SJC 1 luong", Buy: 84_000_000, Sell: 86_000_000, Currency: "VND", UpdateTime: time.Now().Add(-30 * time.Minute).Unix()},
	}
	require.NoError(t, goldCache.SetEmergency(ctx, stale))

	primary := &mockGoldPriceFetcher{}
	secondary := &mockGoldPriceFetcher{}
	health := &mockHealthTracker{}

	primary.On("Source").Return(SourceVangSaiGon)
	primary.On("FetchGoldPrices", mock.Anything).Return(nil, errors.New("source A down"))
	health.On("IsHealthy", mock.Anything, SourceVangSaiGon).Return(true)
	health.On("MarkUnhealthy", mock.Anything, SourceVangSaiGon).Return(nil)

	secondary.On("Source").Return(SourceVangToday)
	secondary.On("FetchGoldPrices", mock.Anything).Return(nil, errors.New("source B down"))
	health.On("IsHealthy", mock.Anything, SourceVangToday).Return(true)
	health.On("MarkUnhealthy", mock.Anything, SourceVangToday).Return(nil)

	waterfall := NewWaterfallGoldFetcher(
		[]GoldPriceFetcher{primary, secondary},
		health,
	)
	svc := newGoldPriceServiceForTest(waterfall, goldCache)

	got, err := svc.FetchAllPrices(ctx)

	require.NoError(t, err, "stale emergency data should be returned without error")
	require.Len(t, got, 1)
	assert.Equal(t, "SJC1L", got[0].TypeCode)
	assert.Equal(t, int64(84_000_000), got[0].Buy)
}

// ---------------------------------------------------------------------------
// TestGoldPriceService_AllSourcesFail_EmergencyExpired_ReturnsError
// ---------------------------------------------------------------------------

// TestGoldPriceService_AllSourcesFail_EmergencyExpired_ReturnsError verifies
// that when all live sources fail AND the emergency cache is empty (expired or
// never written), the service returns an error.
func TestGoldPriceService_AllSourcesFail_EmergencyExpired_ReturnsError(t *testing.T) {
	ctx := context.Background()
	client, _ := newMiniredisClient(t)
	// Empty cache — no emergency data
	goldCache := cache.NewGoldPriceCache(client)

	primary := &mockGoldPriceFetcher{}
	secondary := &mockGoldPriceFetcher{}
	health := &mockHealthTracker{}

	primary.On("Source").Return(SourceVangSaiGon)
	primary.On("FetchGoldPrices", mock.Anything).Return(nil, errors.New("source A down"))
	health.On("IsHealthy", mock.Anything, SourceVangSaiGon).Return(true)
	health.On("MarkUnhealthy", mock.Anything, SourceVangSaiGon).Return(nil)

	secondary.On("Source").Return(SourceVangToday)
	secondary.On("FetchGoldPrices", mock.Anything).Return(nil, errors.New("source B down"))
	health.On("IsHealthy", mock.Anything, SourceVangToday).Return(true)
	health.On("MarkUnhealthy", mock.Anything, SourceVangToday).Return(nil)

	waterfall := NewWaterfallGoldFetcher(
		[]GoldPriceFetcher{primary, secondary},
		health,
	)
	svc := newGoldPriceServiceForTest(waterfall, goldCache)

	got, err := svc.FetchAllPrices(ctx)

	assert.Error(t, err, "should return error when all sources fail and no emergency cache")
	assert.Nil(t, got)
}

// ---------------------------------------------------------------------------
// TestGoldPriceService_UnhealthySourceSkipped
// ---------------------------------------------------------------------------

// TestGoldPriceService_UnhealthySourceSkipped verifies that on a subsequent
// request a source that was previously marked unhealthy is skipped and the
// next healthy source is tried directly.
func TestGoldPriceService_UnhealthySourceSkipped(t *testing.T) {
	ctx := context.Background()
	client, _ := newMiniredisClient(t)
	goldCache := cache.NewGoldPriceCache(client)

	want := sampleGoldPrices()

	primary := &mockGoldPriceFetcher{}
	secondary := &mockGoldPriceFetcher{}
	health := &mockHealthTracker{}

	// Primary is marked unhealthy — must be skipped.
	primary.On("Source").Return(SourceVangSaiGon)
	health.On("IsHealthy", mock.Anything, SourceVangSaiGon).Return(false)

	// Secondary is healthy and returns data.
	secondary.On("Source").Return(SourceVangToday)
	secondary.On("FetchGoldPrices", mock.Anything).Return(want, nil)
	health.On("IsHealthy", mock.Anything, SourceVangToday).Return(true)

	waterfall := NewWaterfallGoldFetcher(
		[]GoldPriceFetcher{primary, secondary},
		health,
	)
	svc := newGoldPriceServiceForTest(waterfall, goldCache)

	got, err := svc.FetchAllPrices(ctx)

	require.NoError(t, err)
	require.Len(t, got, len(want))
	// Primary was skipped.
	primary.AssertNotCalled(t, "FetchGoldPrices", mock.Anything)
	// Secondary was called.
	secondary.AssertCalled(t, "FetchGoldPrices", mock.Anything)
}

// ---------------------------------------------------------------------------
// TestGoldPriceService_FetchPriceForSymbol_CacheHit
// ---------------------------------------------------------------------------

// TestGoldPriceService_FetchPriceForSymbol_CacheHit verifies that
// FetchPriceForSymbol returns the cached per-symbol price on cache hit
// without calling any waterfall fetcher.
func TestGoldPriceService_FetchPriceForSymbol_CacheHit(t *testing.T) {
	ctx := context.Background()
	client, _ := newMiniredisClient(t)
	goldCache := cache.NewGoldPriceCache(client)

	// Pre-populate the per-symbol cache entry.
	cached := &cache.CachedGoldPrice{
		TypeCode:   "SJC1L",
		Name:       "SJC 1 luong",
		Buy:        85_000_000,
		Sell:       87_000_000,
		ChangeBuy:  500_000,
		ChangeSell: 500_000,
		Currency:   "VND",
		UpdateTime: time.Now().Unix(),
	}
	require.NoError(t, goldCache.Set(ctx, "SJC1L", cached, cache.GoldPriceCacheTTL))

	primary := &mockGoldPriceFetcher{}
	health := &mockHealthTracker{}
	waterfall := NewWaterfallGoldFetcher([]GoldPriceFetcher{primary}, health)

	svc := newGoldPriceServiceForTest(waterfall, goldCache)
	got, err := svc.FetchPriceForSymbol(ctx, "SJC1L")

	require.NoError(t, err)
	require.NotNil(t, got)
	assert.Equal(t, "SJC1L", got.TypeCode)
	assert.Equal(t, int64(85_000_000), got.Buy)

	// Waterfall should not have been called on cache hit.
	primary.AssertNotCalled(t, "FetchGoldPrices", mock.Anything)
}

// ---------------------------------------------------------------------------
// TestGoldPriceService_FetchPriceForSymbol_WaterfallFetch
// ---------------------------------------------------------------------------

// TestGoldPriceService_FetchPriceForSymbol_WaterfallFetch verifies that on a
// cache miss, FetchPriceForSymbol calls the waterfall, caches the result, and
// returns the matching symbol.
func TestGoldPriceService_FetchPriceForSymbol_WaterfallFetch(t *testing.T) {
	ctx := context.Background()
	client, _ := newMiniredisClient(t)
	goldCache := cache.NewGoldPriceCache(client)

	allPrices := sampleGoldPrices() // first entry is SJC1L

	primary := &mockGoldPriceFetcher{}
	health := &mockHealthTracker{}

	primary.On("Source").Return(SourceVangSaiGon)
	primary.On("FetchGoldPrices", mock.Anything).Return(allPrices, nil)
	health.On("IsHealthy", mock.Anything, SourceVangSaiGon).Return(true)

	waterfall := NewWaterfallGoldFetcher([]GoldPriceFetcher{primary}, health)
	svc := newGoldPriceServiceForTest(waterfall, goldCache)

	got, err := svc.FetchPriceForSymbol(ctx, "SJC1L")

	require.NoError(t, err)
	require.NotNil(t, got)
	assert.Equal(t, "SJC1L", got.TypeCode)
	assert.Equal(t, allPrices[0].Buy, got.Buy)
}

// ---------------------------------------------------------------------------
// TestGoldPriceService_FetchPriceForSymbol_SymbolOnlyInThirdSource
// ---------------------------------------------------------------------------

// TestGoldPriceService_FetchPriceForSymbol_SymbolOnlyInThirdSource verifies
// that FetchPriceForSymbol finds a symbol that exists only in the third source
// (e.g. BTMC_24K from BTMC API) when the first successful source (vang.today)
// does not carry that symbol.
func TestGoldPriceService_FetchPriceForSymbol_SymbolOnlyInThirdSource(t *testing.T) {
	ctx := context.Background()
	client, _ := newMiniredisClient(t)
	goldCache := cache.NewGoldPriceCache(client)

	// primary (vangsaigon) fails
	// secondary (vangtoday) succeeds but does NOT contain BTMC_24K
	// tertiary (btmc) succeeds and contains BTMC_24K
	vangSaiGonPrices := []*CachedGoldPrice{} // unused — primary will fail
	vangTodayPrices := []*CachedGoldPrice{
		{TypeCode: "SJC", Buy: 85_000_000, Sell: 87_000_000, Currency: "VND"},
	}
	btmcPrices := []*CachedGoldPrice{
		{TypeCode: "BTMC_24K", Name: "Bao Tin 24K", Buy: 82_000_000, Sell: 84_000_000, Currency: "VND"},
	}
	_ = vangSaiGonPrices

	primary := &mockGoldPriceFetcher{}
	secondary := &mockGoldPriceFetcher{}
	tertiary := &mockGoldPriceFetcher{}
	health := &mockHealthTracker{}

	primary.On("Source").Return(SourceVangSaiGon)
	primary.On("FetchGoldPrices", mock.Anything).Return(nil, errors.New("timeout"))
	health.On("IsHealthy", mock.Anything, SourceVangSaiGon).Return(true)
	health.On("MarkUnhealthy", mock.Anything, SourceVangSaiGon).Return(nil)

	secondary.On("Source").Return(SourceVangToday)
	secondary.On("FetchGoldPrices", mock.Anything).Return(vangTodayPrices, nil)
	health.On("IsHealthy", mock.Anything, SourceVangToday).Return(true)

	tertiary.On("Source").Return(SourceBTMC)
	tertiary.On("FetchGoldPrices", mock.Anything).Return(btmcPrices, nil)
	health.On("IsHealthy", mock.Anything, SourceBTMC).Return(true)

	waterfall := NewWaterfallGoldFetcher([]GoldPriceFetcher{primary, secondary, tertiary}, health)
	svc := newGoldPriceServiceForTest(waterfall, goldCache)

	got, err := svc.FetchPriceForSymbol(ctx, "BTMC_24K")

	require.NoError(t, err, "BTMC_24K should be found in tertiary source")
	require.NotNil(t, got)
	assert.Equal(t, "BTMC_24K", got.TypeCode)
	assert.Equal(t, int64(82_000_000), got.Buy)
}

// ---------------------------------------------------------------------------
// TestGoldPriceService_FetchPriceForSymbol_SymbolNotFound
// ---------------------------------------------------------------------------

// TestGoldPriceService_FetchPriceForSymbol_SymbolNotFound verifies that when
// the waterfall returns prices but the requested symbol is not present, the
// service returns an error.
func TestGoldPriceService_FetchPriceForSymbol_SymbolNotFound(t *testing.T) {
	ctx := context.Background()
	client, _ := newMiniredisClient(t)
	goldCache := cache.NewGoldPriceCache(client)

	allPrices := sampleGoldPrices() // SJC1L and XAUUSD

	primary := &mockGoldPriceFetcher{}
	health := &mockHealthTracker{}

	primary.On("Source").Return(SourceVangSaiGon)
	primary.On("FetchGoldPrices", mock.Anything).Return(allPrices, nil)
	health.On("IsHealthy", mock.Anything, SourceVangSaiGon).Return(true)

	waterfall := NewWaterfallGoldFetcher([]GoldPriceFetcher{primary}, health)
	svc := newGoldPriceServiceForTest(waterfall, goldCache)

	got, err := svc.FetchPriceForSymbol(ctx, "NONEXISTENT")

	assert.Error(t, err)
	assert.Nil(t, got)
}

// ---------------------------------------------------------------------------
// TestGoldPriceService_FetchPriceForSymbol_AliasFromVangToday
// ---------------------------------------------------------------------------

// TestGoldPriceService_FetchPriceForSymbol_AliasFromVangToday verifies the
// end-to-end alias lookup path: vangsaigon is down, vang.today returns
// "VNGSJC" for SJC gold, FetchPriceForSymbol("SJC") should find it via
// the aliasToCanonical map applied inside FetchGoldPricesAllSources.
func TestGoldPriceService_FetchPriceForSymbol_AliasFromVangToday(t *testing.T) {
	ctx := context.Background()
	client, _ := newMiniredisClient(t)
	goldCache := cache.NewGoldPriceCache(client)

	// vangsaigon fails — simulates the scenario observed in production logs.
	vangsaigonFetcher := &mockGoldFetcher{
		source: SourceVangSaiGon,
		err:    fmt.Errorf("vangsaigon: connection refused"),
	}
	// vang.today returns "VNGSJC" — the alias for canonical "SJC".
	vangtodayFetcher := &mockGoldFetcher{
		source: SourceVangToday,
		prices: []*CachedGoldPrice{
			{TypeCode: "VNGSJC", Name: "VN Gold SJC", Buy: 172_000_000, Sell: 175_000_000, Currency: "VND"},
		},
	}

	health := &alwaysHealthy{}
	waterfall := NewWaterfallGoldFetcher([]GoldPriceFetcher{vangsaigonFetcher, vangtodayFetcher}, health)
	svc := newGoldPriceServiceForTest(waterfall, goldCache)

	got, err := svc.FetchPriceForSymbol(ctx, "SJC")

	require.NoError(t, err, "FetchPriceForSymbol('SJC') should succeed via VNGSJC alias")
	require.NotNil(t, got)
	assert.Equal(t, "SJC", got.TypeCode, "TypeCode must be normalized to canonical 'SJC'")
	assert.Equal(t, int64(172_000_000), got.Buy, "Buy price must be preserved from vang.today source")
}

// ---------------------------------------------------------------------------
// TestGoldPriceService_FetchPriceForSymbol_AllSourcesFail_EmergencyFallback
// ---------------------------------------------------------------------------

// TestGoldPriceService_FetchPriceForSymbol_AllSourcesFail_EmergencyFallback
// verifies that when the waterfall fails, FetchPriceForSymbol can serve the
// symbol from the emergency cache.
func TestGoldPriceService_FetchPriceForSymbol_AllSourcesFail_EmergencyFallback(t *testing.T) {
	ctx := context.Background()
	client, _ := newMiniredisClient(t)
	goldCache := cache.NewGoldPriceCache(client)

	// Seed the emergency cache with stale data.
	stale := []*cache.CachedGoldPrice{
		{TypeCode: "SJC1L", Name: "SJC 1 luong", Buy: 83_000_000, Sell: 85_000_000, Currency: "VND", UpdateTime: time.Now().Add(-45 * time.Minute).Unix()},
	}
	require.NoError(t, goldCache.SetEmergency(ctx, stale))

	primary := &mockGoldPriceFetcher{}
	health := &mockHealthTracker{}

	primary.On("Source").Return(SourceVangSaiGon)
	primary.On("FetchGoldPrices", mock.Anything).Return(nil, errors.New("source down"))
	health.On("IsHealthy", mock.Anything, SourceVangSaiGon).Return(true)
	health.On("MarkUnhealthy", mock.Anything, SourceVangSaiGon).Return(nil)

	waterfall := NewWaterfallGoldFetcher([]GoldPriceFetcher{primary}, health)
	svc := newGoldPriceServiceForTest(waterfall, goldCache)

	got, err := svc.FetchPriceForSymbol(ctx, "SJC1L")

	require.NoError(t, err, "should return emergency cache data without error")
	require.NotNil(t, got)
	assert.Equal(t, "SJC1L", got.TypeCode)
	assert.Equal(t, int64(83_000_000), got.Buy)
}

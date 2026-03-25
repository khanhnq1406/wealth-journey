package service

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// ---------------------------------------------------------------------------
// Mock GoldPriceFetcher
// ---------------------------------------------------------------------------

type mockGoldPriceFetcher struct {
	mock.Mock
}

func (m *mockGoldPriceFetcher) FetchGoldPrices(ctx context.Context) ([]*CachedGoldPrice, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*CachedGoldPrice), args.Error(1)
}

func (m *mockGoldPriceFetcher) Source() PriceSource {
	return args_source(m.Called())
}

func args_source(args mock.Arguments) PriceSource {
	return args.Get(0).(PriceSource)
}

// ---------------------------------------------------------------------------
// Mock CurrencyPriceFetcher
// ---------------------------------------------------------------------------

type mockCurrencyPriceFetcher struct {
	mock.Mock
}

func (m *mockCurrencyPriceFetcher) FetchCurrencyPrices(ctx context.Context) ([]*CachedCurrencyPrice, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*CachedCurrencyPrice), args.Error(1)
}

func (m *mockCurrencyPriceFetcher) Source() PriceSource {
	return args_source(m.Called())
}

// ---------------------------------------------------------------------------
// Mock SourceHealthTracker
// ---------------------------------------------------------------------------

type mockHealthTracker struct {
	mock.Mock
}

func (m *mockHealthTracker) IsHealthy(ctx context.Context, source PriceSource) bool {
	args := m.Called(ctx, source)
	return args.Bool(0)
}

func (m *mockHealthTracker) MarkUnhealthy(ctx context.Context, source PriceSource) error {
	args := m.Called(ctx, source)
	return args.Error(0)
}

// ---------------------------------------------------------------------------
// WaterfallGoldFetcher tests
// ---------------------------------------------------------------------------

func TestWaterfallGoldFetcher_PrimarySucceeds(t *testing.T) {
	ctx := context.Background()

	primary := &mockGoldPriceFetcher{}
	secondary := &mockGoldPriceFetcher{}
	health := &mockHealthTracker{}

	want := []*CachedGoldPrice{{TypeCode: "SJC", Buy: 100_000_000}}

	primary.On("Source").Return(SourceVangSaiGon)
	primary.On("FetchGoldPrices", mock.Anything).Return(want, nil)
	health.On("IsHealthy", mock.Anything, SourceVangSaiGon).Return(true)

	fetcher := NewWaterfallGoldFetcher([]GoldPriceFetcher{primary, secondary}, health)
	got, err := fetcher.FetchGoldPrices(ctx)

	assert.NoError(t, err)
	assert.Equal(t, want, got)
	// Secondary should never have been called.
	secondary.AssertNotCalled(t, "FetchGoldPrices", mock.Anything)
}

func TestWaterfallGoldFetcher_PrimaryFailsFallsBackToSecondary(t *testing.T) {
	ctx := context.Background()

	primary := &mockGoldPriceFetcher{}
	secondary := &mockGoldPriceFetcher{}
	health := &mockHealthTracker{}

	want := []*CachedGoldPrice{{TypeCode: "SJC", Buy: 99_000_000}}
	fetchErr := errors.New("primary source unavailable")

	primary.On("Source").Return(SourceVangSaiGon)
	primary.On("FetchGoldPrices", mock.Anything).Return(nil, fetchErr)
	health.On("IsHealthy", mock.Anything, SourceVangSaiGon).Return(true)
	health.On("MarkUnhealthy", mock.Anything, SourceVangSaiGon).Return(nil)

	secondary.On("Source").Return(SourceVangToday)
	secondary.On("FetchGoldPrices", mock.Anything).Return(want, nil)
	health.On("IsHealthy", mock.Anything, SourceVangToday).Return(true)

	fetcher := NewWaterfallGoldFetcher([]GoldPriceFetcher{primary, secondary}, health)
	got, err := fetcher.FetchGoldPrices(ctx)

	assert.NoError(t, err)
	assert.Equal(t, want, got)
	secondary.AssertCalled(t, "FetchGoldPrices", mock.Anything)
}

func TestWaterfallGoldFetcher_AllSourcesFail(t *testing.T) {
	ctx := context.Background()

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

	fetcher := NewWaterfallGoldFetcher([]GoldPriceFetcher{primary, secondary}, health)
	got, err := fetcher.FetchGoldPrices(ctx)

	assert.Error(t, err)
	assert.Nil(t, got)
	// Both sources must have been tried.
	primary.AssertCalled(t, "FetchGoldPrices", mock.Anything)
	secondary.AssertCalled(t, "FetchGoldPrices", mock.Anything)
}

func TestWaterfallGoldFetcher_UnhealthySourceSkipped(t *testing.T) {
	ctx := context.Background()

	primary := &mockGoldPriceFetcher{}
	secondary := &mockGoldPriceFetcher{}
	health := &mockHealthTracker{}

	want := []*CachedGoldPrice{{TypeCode: "SJC", Buy: 98_000_000}}

	// Primary is marked unhealthy — must be skipped.
	primary.On("Source").Return(SourceVangSaiGon)
	health.On("IsHealthy", mock.Anything, SourceVangSaiGon).Return(false)

	secondary.On("Source").Return(SourceVangToday)
	secondary.On("FetchGoldPrices", mock.Anything).Return(want, nil)
	health.On("IsHealthy", mock.Anything, SourceVangToday).Return(true)

	fetcher := NewWaterfallGoldFetcher([]GoldPriceFetcher{primary, secondary}, health)
	got, err := fetcher.FetchGoldPrices(ctx)

	assert.NoError(t, err)
	assert.Equal(t, want, got)
	primary.AssertNotCalled(t, "FetchGoldPrices", mock.Anything)
	secondary.AssertCalled(t, "FetchGoldPrices", mock.Anything)
}

func TestWaterfallGoldFetcher_LastSourceAlwaysTried(t *testing.T) {
	// Even when the only source is marked unhealthy, it must still be tried
	// so that the waterfall never silently returns nothing.
	ctx := context.Background()

	onlySource := &mockGoldPriceFetcher{}
	health := &mockHealthTracker{}

	want := []*CachedGoldPrice{{TypeCode: "SJC", Buy: 97_000_000}}

	onlySource.On("Source").Return(SourceVangSaiGon)
	// IsHealthy returns false, but since it is the last source it must be tried.
	health.On("IsHealthy", mock.Anything, SourceVangSaiGon).Return(false)
	onlySource.On("FetchGoldPrices", mock.Anything).Return(want, nil)

	fetcher := NewWaterfallGoldFetcher([]GoldPriceFetcher{onlySource}, health)
	got, err := fetcher.FetchGoldPrices(ctx)

	assert.NoError(t, err)
	assert.Equal(t, want, got)
	onlySource.AssertCalled(t, "FetchGoldPrices", mock.Anything)
}

// ---------------------------------------------------------------------------
// WaterfallCurrencyFetcher tests
// ---------------------------------------------------------------------------

func TestWaterfallCurrencyFetcher_PrimarySucceeds(t *testing.T) {
	ctx := context.Background()

	primary := &mockCurrencyPriceFetcher{}
	health := &mockHealthTracker{}

	want := []*CachedCurrencyPrice{{TypeCode: "USD", Buy: 25_000}}

	primary.On("Source").Return(SourceVangSaiGon)
	primary.On("FetchCurrencyPrices", mock.Anything).Return(want, nil)
	health.On("IsHealthy", mock.Anything, SourceVangSaiGon).Return(true)

	fetcher := NewWaterfallCurrencyFetcher([]CurrencyPriceFetcher{primary}, health)
	got, err := fetcher.FetchCurrencyPrices(ctx)

	assert.NoError(t, err)
	assert.Equal(t, want, got)
}

func TestWaterfallCurrencyFetcher_PrimaryFailsFallsBackToSecondary(t *testing.T) {
	ctx := context.Background()

	primary := &mockCurrencyPriceFetcher{}
	secondary := &mockCurrencyPriceFetcher{}
	health := &mockHealthTracker{}

	want := []*CachedCurrencyPrice{{TypeCode: "USD", Buy: 24_500}}
	fetchErr := errors.New("primary source unavailable")

	primary.On("Source").Return(SourceVangSaiGon)
	primary.On("FetchCurrencyPrices", mock.Anything).Return(nil, fetchErr)
	health.On("IsHealthy", mock.Anything, SourceVangSaiGon).Return(true)
	health.On("MarkUnhealthy", mock.Anything, SourceVangSaiGon).Return(nil)

	secondary.On("Source").Return(SourceVangToday)
	secondary.On("FetchCurrencyPrices", mock.Anything).Return(want, nil)
	health.On("IsHealthy", mock.Anything, SourceVangToday).Return(true)

	fetcher := NewWaterfallCurrencyFetcher([]CurrencyPriceFetcher{primary, secondary}, health)
	got, err := fetcher.FetchCurrencyPrices(ctx)

	assert.NoError(t, err)
	assert.Equal(t, want, got)
}

func TestWaterfallCurrencyFetcher_AllSourcesFail(t *testing.T) {
	ctx := context.Background()

	primary := &mockCurrencyPriceFetcher{}
	health := &mockHealthTracker{}

	primary.On("Source").Return(SourceVangSaiGon)
	primary.On("FetchCurrencyPrices", mock.Anything).Return(nil, errors.New("down"))
	health.On("IsHealthy", mock.Anything, SourceVangSaiGon).Return(true)
	health.On("MarkUnhealthy", mock.Anything, SourceVangSaiGon).Return(nil)

	fetcher := NewWaterfallCurrencyFetcher([]CurrencyPriceFetcher{primary}, health)
	got, err := fetcher.FetchCurrencyPrices(ctx)

	assert.Error(t, err)
	assert.Nil(t, got)
}

// ---------------------------------------------------------------------------
// Simple stub helpers for alias-normalization tests
// ---------------------------------------------------------------------------

// mockGoldFetcher is a simple (non-testify/mock) stub for GoldPriceFetcher.
type mockGoldFetcher struct {
	source PriceSource
	prices []*CachedGoldPrice
	err    error
}

func (m *mockGoldFetcher) FetchGoldPrices(_ context.Context) ([]*CachedGoldPrice, error) {
	return m.prices, m.err
}

func (m *mockGoldFetcher) Source() PriceSource {
	return m.source
}

// alwaysHealthy is a SourceHealthTracker that always reports sources as healthy.
type alwaysHealthy struct{}

func (a *alwaysHealthy) IsHealthy(_ context.Context, _ PriceSource) bool { return true }
func (a *alwaysHealthy) MarkUnhealthy(_ context.Context, _ PriceSource) error {
	return nil
}

// ---------------------------------------------------------------------------
// Alias normalization tests
// ---------------------------------------------------------------------------

func TestWaterfallGoldFetcher_AllSources_AliasNormalization(t *testing.T) {
	// vang.today returns "VNGSJC" for SJC gold (a known alias for canonical "SJC")
	vangtodayFetcher := &mockGoldFetcher{
		source: SourceVangToday,
		prices: []*CachedGoldPrice{
			{TypeCode: "VNGSJC", Name: "VN Gold SJC", Buy: 172_000_000, Sell: 175_000_000, Currency: "VND"},
		},
	}

	health := &alwaysHealthy{}
	wf := NewWaterfallGoldFetcher([]GoldPriceFetcher{vangtodayFetcher}, health)

	prices, err := wf.FetchGoldPricesAllSources(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// VNGSJC should be normalized to canonical "SJC"
	var found bool
	for _, p := range prices {
		if p.TypeCode == "SJC" {
			found = true
			if p.Buy != 172_000_000 {
				t.Errorf("SJC Buy: expected 172000000, got %d", p.Buy)
			}
		}
	}
	if !found {
		t.Error("expected canonical TypeCode 'SJC' in merged prices, got none")
	}
}

func TestWaterfallGoldFetcher_AllSources_NonAliasUnchanged(t *testing.T) {
	// DOHNL has no alias — it should pass through unchanged
	vangtodayFetcher := &mockGoldFetcher{
		source: SourceVangToday,
		prices: []*CachedGoldPrice{
			{TypeCode: "DOHNL", Name: "DOJI Hanoi", Buy: 170_000_000, Sell: 172_000_000, Currency: "VND"},
		},
	}

	health := &alwaysHealthy{}
	wf := NewWaterfallGoldFetcher([]GoldPriceFetcher{vangtodayFetcher}, health)

	prices, err := wf.FetchGoldPricesAllSources(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(prices) != 1 || prices[0].TypeCode != "DOHNL" {
		t.Errorf("expected DOHNL unchanged, got %+v", prices)
	}
}

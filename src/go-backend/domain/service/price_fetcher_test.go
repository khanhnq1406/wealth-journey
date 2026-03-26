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

func TestWaterfallGoldFetcher_AllSources_SJ9999AliasNormalization(t *testing.T) {
	// vang.today returns "SJ9999" for SJC Ring gold (canonical "Vàng nhẫn SJC").
	// FetchGoldPricesAllSources must normalize "SJ9999" to "Vàng nhẫn SJC".
	vangtodayFetcher := &mockGoldFetcher{
		source: SourceVangToday,
		prices: []*CachedGoldPrice{
			{TypeCode: "SJ9999", Name: "SJC Ring", Buy: 170_300_000, Sell: 173_300_000, Currency: "VND"},
		},
	}

	health := &alwaysHealthy{}
	wf := NewWaterfallGoldFetcher([]GoldPriceFetcher{vangtodayFetcher}, health)

	prices, err := wf.FetchGoldPricesAllSources(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var found bool
	for _, p := range prices {
		if p.TypeCode == "Vàng nhẫn SJC" {
			found = true
			if p.Buy != 170_300_000 {
				t.Errorf("Vàng nhẫn SJC Buy: expected 170300000, got %d", p.Buy)
			}
		}
	}
	if !found {
		t.Errorf("expected canonical TypeCode 'Vàng nhẫn SJC' in merged prices; got %v", prices)
	}
}

func TestWaterfallGoldFetcher_AllSources_SJL1L10AliasNormalization(t *testing.T) {
	// vang.today returns "SJL1L10" for SJC 9999 gold (canonical "SJC").
	// FetchGoldPricesAllSources must normalize "SJL1L10" to "SJC".
	vangtodayFetcher := &mockGoldFetcher{
		source: SourceVangToday,
		prices: []*CachedGoldPrice{
			{TypeCode: "SJL1L10", Name: "SJC 9999", Buy: 170_500_000, Sell: 173_500_000, Currency: "VND"},
		},
	}

	health := &alwaysHealthy{}
	wf := NewWaterfallGoldFetcher([]GoldPriceFetcher{vangtodayFetcher}, health)

	prices, err := wf.FetchGoldPricesAllSources(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var found bool
	for _, p := range prices {
		if p.TypeCode == "SJC" {
			found = true
			if p.Buy != 170_500_000 {
				t.Errorf("SJC Buy: expected 170500000, got %d", p.Buy)
			}
		}
	}
	if !found {
		t.Errorf("expected canonical TypeCode 'SJC' in merged prices; got %v", prices)
	}
}

// TestWaterfallGoldFetcher_AllSources_MihongFallback verifies that when
// vangsaigon + vang.today + BTMC all fail, the Mihong source provides Mihong_999.
func TestWaterfallGoldFetcher_AllSources_MihongFallback(t *testing.T) {
	failFetcher := func(src PriceSource) *mockGoldFetcher {
		return &mockGoldFetcher{
			source: src,
			err:    errors.New("source down"),
		}
	}
	mihongFetcher := &mockGoldFetcher{
		source: SourceMihong,
		prices: []*CachedGoldPrice{
			{TypeCode: "Mihong_999", Name: "Mi Hồng 999", Buy: 171_500_000, Sell: 175_000_000, Currency: "VND"},
		},
	}

	fetchers := []GoldPriceFetcher{
		failFetcher(SourceVangSaiGon),
		failFetcher(SourceVangToday),
		failFetcher(SourceBTMC),
		mihongFetcher,
	}
	waterfall := NewWaterfallGoldFetcher(fetchers, &alwaysHealthy{})

	allPrices, err := waterfall.FetchGoldPricesAllSources(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	found := false
	for _, p := range allPrices {
		if p.TypeCode == "Mihong_999" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected Mihong_999 in all-sources result, got none")
	}
}

func TestWaterfallGoldFetcher_AllSources_MIHONG999AliasNormalization(t *testing.T) {
	// vang.today uppercases all TypeCodes, so "Mihong_999" becomes "MIHONG_999".
	// FetchGoldPricesAllSources must normalize "MIHONG_999" back to the canonical
	// "Mihong_999" so that FetchPriceForSymbol("Mihong_999") finds it.
	vangtodayFetcher := &mockGoldFetcher{
		source: SourceVangToday,
		prices: []*CachedGoldPrice{
			{TypeCode: "MIHONG_999", Name: "Mi Hong 999", Buy: 172_000_000, Sell: 175_000_000, Currency: "VND"},
		},
	}

	health := &alwaysHealthy{}
	wf := NewWaterfallGoldFetcher([]GoldPriceFetcher{vangtodayFetcher}, health)

	prices, err := wf.FetchGoldPricesAllSources(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var found bool
	for _, p := range prices {
		if p.TypeCode == "Mihong_999" {
			found = true
			if p.Buy != 172_000_000 {
				t.Errorf("Mihong_999 Buy: expected 172000000, got %d", p.Buy)
			}
		}
	}
	if !found {
		t.Error("expected canonical TypeCode 'Mihong_999' in merged prices after alias normalization")
	}
}

// TestWaterfallGoldFetcher_FetchGoldPrices_NormalizesAlias verifies that the
// single-source waterfall path normalizes vang.today alias codes to canonical
// codes via gold.AliasToCanonical.
func TestWaterfallGoldFetcher_FetchGoldPrices_NormalizesAlias(t *testing.T) {
	aliasPrices := []*CachedGoldPrice{
		{TypeCode: "VNGSJC", Name: "vng sjc", Buy: 85_000_000, Sell: 86_000_000, Currency: "VND"},
		{TypeCode: "DOHN", Name: "doji hn", Buy: 84_000_000, Sell: 85_000_000, Currency: "VND"},
		{TypeCode: "XAUUSD", Name: "xau", Buy: 290000, Sell: 290100, Currency: "USD"},
	}

	f := &mockGoldFetcher{source: SourceVangToday, prices: aliasPrices}
	healthy := &alwaysHealthy{}
	w := NewWaterfallGoldFetcher([]GoldPriceFetcher{f}, healthy)

	prices, err := w.FetchGoldPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(prices) != 3 {
		t.Fatalf("expected 3 prices, got %d", len(prices))
	}

	byCode := make(map[string]*CachedGoldPrice)
	for _, p := range prices {
		byCode[p.TypeCode] = p
	}
	if _, ok := byCode["SJC"]; !ok {
		t.Error("VNGSJC should normalize to SJC")
	}
	if _, ok := byCode["Doji"]; !ok {
		t.Error("DOHN should normalize to Doji")
	}
	if _, ok := byCode["XAUUSD"]; !ok {
		t.Error("XAUUSD should pass through unchanged")
	}
	if _, ok := byCode["VNGSJC"]; ok {
		t.Error("original alias VNGSJC should not appear in output")
	}
	if _, ok := byCode["DOHN"]; ok {
		t.Error("original alias DOHN should not appear in output")
	}
}

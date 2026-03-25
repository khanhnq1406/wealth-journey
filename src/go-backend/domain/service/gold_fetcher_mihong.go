package service

import (
	"context"
	"fmt"
	"time"

	"wealthjourney/pkg/mihong"
)

// fetchMihongFn is the function signature for calling the mihong client.
// It allows tests to inject a stub without a real HTTP connection.
type fetchMihongFn func(ctx context.Context) ([]*mihong.GoldPrice, error)

// mihongGoldFetcher implements GoldPriceFetcher backed by the Mihong API.
type mihongGoldFetcher struct {
	fetchGoldPrices fetchMihongFn
}

// NewMihongGoldFetcher constructs a GoldPriceFetcher that calls the Mihong API
// via mihong.Client. No API key required — the Mihong API is public.
func NewMihongGoldFetcher(timeout time.Duration) GoldPriceFetcher {
	client := mihong.NewClient(timeout)
	return &mihongGoldFetcher{
		fetchGoldPrices: client.FetchGoldPrices,
	}
}

// newMihongGoldFetcherWithStub is an internal constructor for tests that
// replaces the real HTTP call with an in-memory function.
func newMihongGoldFetcherWithStub(fn fetchMihongFn) *mihongGoldFetcher {
	return &mihongGoldFetcher{fetchGoldPrices: fn}
}

// Source returns the source identifier for this fetcher.
func (f *mihongGoldFetcher) Source() PriceSource {
	return SourceMihong
}

// FetchGoldPrices calls the Mihong API and maps GoldPrice entries to
// []*CachedGoldPrice. The mihong.Client already multiplies raw prices ×10
// (mace→lượng), so this adapter performs a direct field copy.
//
// Note: Mihong API does not provide buy/sell change data; ChangeBuy and
// ChangeSell are always 0.
func (f *mihongGoldFetcher) FetchGoldPrices(ctx context.Context) ([]*CachedGoldPrice, error) {
	mihongPrices, err := f.fetchGoldPrices(ctx)
	if err != nil {
		return nil, fmt.Errorf("fetch from mihong: %w", err)
	}

	prices := make([]*CachedGoldPrice, 0, len(mihongPrices))
	for _, gp := range mihongPrices {
		prices = append(prices, &CachedGoldPrice{
			TypeCode:   gp.TypeCode,
			Name:       gp.Name,
			Buy:        gp.Buy,
			Sell:       gp.Sell,
			ChangeBuy:  0, // Mihong API does not provide change data
			ChangeSell: 0,
			Currency:   gp.Currency,
			UpdateTime: gp.UpdateTime,
		})
	}

	return prices, nil
}

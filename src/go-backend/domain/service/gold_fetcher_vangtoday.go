package service

import (
	"context"
	"fmt"
	"time"

	"wealthjourney/pkg/vangtoday"
)

// fetchVangTodayFn is the function signature for calling the vangtoday client.
// It allows tests to inject a stub without a real HTTP connection.
type fetchVangTodayFn func(ctx context.Context) (*vangtoday.PricesResponse, error)

// vangTodayGoldFetcher implements GoldPriceFetcher backed by vang.today.
type vangTodayGoldFetcher struct {
	fetchPrices fetchVangTodayFn
}

// NewVangTodayGoldFetcher constructs a GoldPriceFetcher that calls the
// vang.today API via vangtoday.Client.
func NewVangTodayGoldFetcher(timeout time.Duration) GoldPriceFetcher {
	client := vangtoday.NewClient(timeout)
	return &vangTodayGoldFetcher{
		fetchPrices: client.FetchPrices,
	}
}

// newVangTodayGoldFetcherWithStub is an internal constructor for tests that
// replaces the real HTTP call with an in-memory function.
func newVangTodayGoldFetcherWithStub(fn fetchVangTodayFn) *vangTodayGoldFetcher {
	return &vangTodayGoldFetcher{fetchPrices: fn}
}

// Source returns the source identifier for this fetcher.
func (f *vangTodayGoldFetcher) Source() PriceSource {
	return SourceVangToday
}

// FetchGoldPrices calls the vang.today API and maps the normalized GoldPrice
// entries to []*CachedGoldPrice.
//
// The vangtoday.Client already normalizes prices:
//   - VND gold: Buy/Sell multiplied by 1000 (smallest VND unit)
//   - USD gold (XAU): Buy/Sell multiplied by 100 (cents)
//
// The adapter performs a direct field copy — no additional normalization needed.
func (f *vangTodayGoldFetcher) FetchGoldPrices(ctx context.Context) ([]*CachedGoldPrice, error) {
	resp, err := f.fetchPrices(ctx)
	if err != nil {
		return nil, fmt.Errorf("fetch from vangtoday: %w", err)
	}

	prices := make([]*CachedGoldPrice, 0, len(resp.GoldPrices))

	for _, gp := range resp.GoldPrices {
		prices = append(prices, &CachedGoldPrice{
			TypeCode:   gp.TypeCode,
			Name:       gp.Name,
			Buy:        gp.Buy,
			Sell:       gp.Sell,
			ChangeBuy:  gp.ChangeBuy,
			ChangeSell: gp.ChangeSell,
			Currency:   gp.Currency,
			UpdateTime: gp.UpdateTime,
		})
	}

	return prices, nil
}

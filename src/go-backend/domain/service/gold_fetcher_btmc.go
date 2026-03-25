package service

import (
	"context"
	"fmt"
	"time"

	"wealthjourney/pkg/btmc"
)

// fetchBTMCFn is the function signature for calling the btmc client.
// It allows tests to inject a stub without a real HTTP connection.
type fetchBTMCFn func(ctx context.Context) ([]*btmc.GoldPrice, error)

// btmcGoldFetcher implements GoldPriceFetcher backed by the BTMC API.
type btmcGoldFetcher struct {
	fetchGoldPrices fetchBTMCFn
}

// NewBTMCGoldFetcher constructs a GoldPriceFetcher that calls the BTMC API
// via btmc.Client.
//
// Returns an error if apiKey is empty (btmc.NewClient enforces this).
func NewBTMCGoldFetcher(timeout time.Duration, apiKey string) (GoldPriceFetcher, error) {
	client, err := btmc.NewClient(timeout, apiKey)
	if err != nil {
		return nil, fmt.Errorf("btmc gold fetcher: %w", err)
	}
	return &btmcGoldFetcher{
		fetchGoldPrices: client.FetchGoldPrices,
	}, nil
}

// newBTMCGoldFetcherWithStub is an internal constructor for tests that
// replaces the real HTTP call with an in-memory function.
func newBTMCGoldFetcherWithStub(fn fetchBTMCFn) *btmcGoldFetcher {
	return &btmcGoldFetcher{fetchGoldPrices: fn}
}

// Source returns the source identifier for this fetcher.
func (f *btmcGoldFetcher) Source() PriceSource {
	return SourceBTMC
}

// FetchGoldPrices calls the BTMC API and maps the normalized GoldPrice entries
// to []*CachedGoldPrice.
//
// The btmc.Client already normalizes prices (Buy/Sell multiplied by 1000 to
// reach the smallest VND unit). This adapter performs a direct field copy.
//
// Note: BTMC does not provide price change data, so ChangeBuy and ChangeSell
// are always set to 0.
func (f *btmcGoldFetcher) FetchGoldPrices(ctx context.Context) ([]*CachedGoldPrice, error) {
	btmcPrices, err := f.fetchGoldPrices(ctx)
	if err != nil {
		return nil, fmt.Errorf("fetch from btmc: %w", err)
	}

	prices := make([]*CachedGoldPrice, 0, len(btmcPrices))

	for _, gp := range btmcPrices {
		prices = append(prices, &CachedGoldPrice{
			TypeCode:   gp.TypeCode,
			Name:       gp.Name,
			Buy:        gp.Buy,
			Sell:       gp.Sell,
			ChangeBuy:  0, // BTMC API does not provide change data
			ChangeSell: 0,
			Currency:   gp.Currency,
			UpdateTime: gp.UpdateTime,
		})
	}

	return prices, nil
}

package service

import (
	"context"
	"fmt"
	"time"

	"wealthjourney/pkg/vangtoday"
)

// vangTodayCurrencyFetcher implements CurrencyPriceFetcher backed by vang.today.
type vangTodayCurrencyFetcher struct {
	fetchPrices fetchVangTodayFn
}

// NewVangTodayCurrencyFetcher constructs a CurrencyPriceFetcher that calls the
// vang.today API via vangtoday.Client.
func NewVangTodayCurrencyFetcher(timeout time.Duration) CurrencyPriceFetcher {
	client := vangtoday.NewClient(timeout)
	return &vangTodayCurrencyFetcher{
		fetchPrices: client.FetchPrices,
	}
}

// newVangTodayCurrencyFetcherWithStub is an internal constructor for tests that
// replaces the real HTTP call with an in-memory function.
func newVangTodayCurrencyFetcherWithStub(fn fetchVangTodayFn) *vangTodayCurrencyFetcher {
	return &vangTodayCurrencyFetcher{fetchPrices: fn}
}

// Source returns the source identifier for this fetcher.
func (f *vangTodayCurrencyFetcher) Source() PriceSource {
	return SourceVangToday
}

// FetchCurrencyPrices calls the vang.today API and maps the normalized
// CurrencyPrice entries to []*CachedCurrencyPrice.
//
// The vangtoday.Client returns raw VND values for currency prices (no
// multiplication applied), so this adapter performs a direct field copy.
// CachedCurrencyPrice.ChangeBuy and ChangeSell are set to 0 because the
// vangtoday.CurrencyPrice type does not carry change data.
func (f *vangTodayCurrencyFetcher) FetchCurrencyPrices(ctx context.Context) ([]*CachedCurrencyPrice, error) {
	resp, err := f.fetchPrices(ctx)
	if err != nil {
		return nil, fmt.Errorf("fetch from vangtoday: %w", err)
	}

	prices := make([]*CachedCurrencyPrice, 0, len(resp.CurrencyPrices))

	for _, cp := range resp.CurrencyPrices {
		prices = append(prices, &CachedCurrencyPrice{
			TypeCode:   cp.TypeCode,
			Name:       cp.Name,
			Buy:        cp.Buy,
			Sell:       cp.Sell,
			ChangeBuy:  0, // vang.today does not provide currency change data
			ChangeSell: 0,
			Currency:   cp.Currency,
			UpdateTime: cp.UpdateTime,
		})
	}

	return prices, nil
}

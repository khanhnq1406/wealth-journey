package service

import (
	"context"
	"fmt"
	"time"

	"wealthjourney/pkg/vietcombank"
)

// fetchVietcombankFn is the function signature for calling the vietcombank client.
type fetchVietcombankFn func(ctx context.Context) ([]*vietcombank.CurrencyPrice, error)

// vietcombankCurrencyFetcher implements CurrencyPriceFetcher backed by the
// Vietcombank public exchange-rate API.
type vietcombankCurrencyFetcher struct {
	fetchPrices fetchVietcombankFn
}

// NewVietcombankCurrencyFetcher constructs a CurrencyPriceFetcher that calls the
// Vietcombank public exchange-rate API via vietcombank.Client.
func NewVietcombankCurrencyFetcher(client *vietcombank.Client) CurrencyPriceFetcher {
	return &vietcombankCurrencyFetcher{
		fetchPrices: client.FetchCurrencyPrices,
	}
}

// newVietcombankCurrencyFetcherWithStub is an internal constructor for tests that
// replaces the real HTTP call with an in-memory function.
func newVietcombankCurrencyFetcherWithStub(fn fetchVietcombankFn) *vietcombankCurrencyFetcher {
	return &vietcombankCurrencyFetcher{fetchPrices: fn}
}

// Source returns the source identifier for this fetcher.
func (f *vietcombankCurrencyFetcher) Source() PriceSource {
	return SourceVietcombank
}

// FetchCurrencyPrices calls the Vietcombank API and normalizes the currency
// prices into []*CachedCurrencyPrice.
//
// Normalization rules:
//   - TypeCode is preserved as-is from the client (already suffixed with _VCB,
//     e.g. "USD_VCB", "EUR_VCB").
//   - Name is preserved from the client output (e.g. "USD Vietcombank").
//   - Buy and Sell are raw VND values — no multiplication needed.
//   - Currency is preserved from the client output (always "VND").
//   - ChangeBuy and ChangeSell are always 0: the Vietcombank API does not
//     provide change/delta data.
//   - UpdateTime is set to the current time at fetch.
func (f *vietcombankCurrencyFetcher) FetchCurrencyPrices(ctx context.Context) ([]*CachedCurrencyPrice, error) {
	prices, err := f.fetchPrices(ctx)
	if err != nil {
		return nil, fmt.Errorf("fetch from vietcombank: %w", err)
	}

	result := make([]*CachedCurrencyPrice, 0, len(prices))
	for _, p := range prices {
		result = append(result, &CachedCurrencyPrice{
			TypeCode:   p.TypeCode, // Already suffixed with _VCB by the client
			Name:       p.Name,
			Buy:        p.Buy,
			Sell:       p.Sell,
			ChangeBuy:  0, // Vietcombank API does not provide change data
			ChangeSell: 0,
			Currency:   p.Currency,
			UpdateTime: time.Now(),
		})
	}

	return result, nil
}

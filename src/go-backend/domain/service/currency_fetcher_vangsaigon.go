package service

import (
	"context"
	"fmt"
	"time"

	"wealthjourney/pkg/vnprice"
)

// vangSaiGonCurrencyFetcher implements CurrencyPriceFetcher backed by vangsaigon.vn.
type vangSaiGonCurrencyFetcher struct {
	fetchPrices fetchPricesFn
}

// NewVangSaiGonCurrencyFetcher constructs a CurrencyPriceFetcher that calls the
// vangsaigon.vn API via vnprice.Client.
func NewVangSaiGonCurrencyFetcher(timeout time.Duration) CurrencyPriceFetcher {
	client := vnprice.NewClient(timeout)
	return &vangSaiGonCurrencyFetcher{
		fetchPrices: client.FetchPrices,
	}
}

// newVangSaiGonCurrencyFetcherWithStub is an internal constructor for tests that
// replaces the real HTTP call with an in-memory function.
func newVangSaiGonCurrencyFetcherWithStub(fn fetchPricesFn) *vangSaiGonCurrencyFetcher {
	return &vangSaiGonCurrencyFetcher{fetchPrices: fn}
}

// Source returns the source identifier for this fetcher.
func (f *vangSaiGonCurrencyFetcher) Source() PriceSource {
	return SourceVangSaiGon
}

// FetchCurrencyPrices calls the vangsaigon API and normalizes the currency prices
// into []*CachedCurrencyPrice.
//
// Normalization rules (extracted from currencyPriceService.FetchAllPrices):
//   - Currency prices from vangsaigon are already in raw VND — no multiplication needed.
//   - TypeCode maps to apiPrice.Code (original API name, e.g. "USD", "USD Internalbank")
//   - Name maps to apiPrice.Name (display name, e.g. "USD Tự Do", "USD Vietcombank")
//   - Currency is always "VND"
func (f *vangSaiGonCurrencyFetcher) FetchCurrencyPrices(ctx context.Context) ([]*CachedCurrencyPrice, error) {
	pricesResp, err := f.fetchPrices(ctx)
	if err != nil {
		return nil, fmt.Errorf("fetch from vangsaigon: %w", err)
	}

	prices := make([]*CachedCurrencyPrice, 0, len(pricesResp.CurrencyPrices))

	for _, apiPrice := range pricesResp.CurrencyPrices {
		// Currency prices from vangsaigon are already in raw VND — no multiplication needed.
		prices = append(prices, &CachedCurrencyPrice{
			TypeCode:   apiPrice.Code,
			Name:       apiPrice.Name,
			Buy:        int64(apiPrice.Buy),
			Sell:       int64(apiPrice.Sell),
			ChangeBuy:  int64(apiPrice.BuyChange),
			ChangeSell: int64(apiPrice.SellChange),
			Currency:   "VND",
			UpdateTime: apiPrice.UpdateAt,
		})
	}

	return prices, nil
}

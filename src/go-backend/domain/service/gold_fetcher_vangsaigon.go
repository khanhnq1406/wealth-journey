package service

import (
	"context"
	"fmt"
	"time"

	"wealthjourney/pkg/vnprice"
)

// fetchPricesFn is the function signature used to call the vnprice client.
// It allows tests to inject a stub without a real HTTP client.
type fetchPricesFn func(ctx context.Context) (*vnprice.PricesResponse, error)

// vangSaiGonGoldFetcher implements GoldPriceFetcher backed by vangsaigon.vn.
type vangSaiGonGoldFetcher struct {
	fetchPrices fetchPricesFn
}

// NewVangSaiGonGoldFetcher constructs a GoldPriceFetcher that calls the
// vangsaigon.vn API via vnprice.Client.
func NewVangSaiGonGoldFetcher(timeout time.Duration) GoldPriceFetcher {
	client := vnprice.NewClient(timeout)
	return &vangSaiGonGoldFetcher{
		fetchPrices: client.FetchPrices,
	}
}

// newVangSaiGonGoldFetcherWithStub is an internal constructor for tests that
// replaces the real HTTP call with an in-memory function.
func newVangSaiGonGoldFetcherWithStub(fn fetchPricesFn) *vangSaiGonGoldFetcher {
	return &vangSaiGonGoldFetcher{fetchPrices: fn}
}

// Source returns the source identifier for this fetcher.
func (f *vangSaiGonGoldFetcher) Source() PriceSource {
	return SourceVangSaiGon
}

// FetchGoldPrices calls the vangsaigon API and normalizes the gold prices
// into []*CachedGoldPrice.
//
// Normalization rules (extracted from goldPriceService.FetchAllPrices):
//   - VND prices: multiply raw float value by 1000
//   - USD prices: multiply raw float value by 100 (convert to cents)
func (f *vangSaiGonGoldFetcher) FetchGoldPrices(ctx context.Context) ([]*CachedGoldPrice, error) {
	pricesResp, err := f.fetchPrices(ctx)
	if err != nil {
		return nil, fmt.Errorf("fetch from vangsaigon: %w", err)
	}

	prices := make([]*CachedGoldPrice, 0, len(pricesResp.GoldPrices))

	for _, apiPrice := range pricesResp.GoldPrices {
		var buy, sell, changeBuy, changeSell int64

		if apiPrice.Currency == "USD" {
			buy = int64(apiPrice.Buy * 100)
			sell = int64(apiPrice.Sell * 100)
			changeBuy = int64(apiPrice.BuyChange * 100)
			changeSell = int64(apiPrice.SellChange * 100)
		} else {
			buy = int64(apiPrice.Buy * 1000)
			sell = int64(apiPrice.Sell * 1000)
			changeBuy = int64(apiPrice.BuyChange * 1000)
			changeSell = int64(apiPrice.SellChange * 1000)
		}

		prices = append(prices, &CachedGoldPrice{
			TypeCode:   apiPrice.Name,
			Name:       apiPrice.Name,
			Buy:        buy,
			Sell:       sell,
			ChangeBuy:  changeBuy,
			ChangeSell: changeSell,
			Currency:   apiPrice.Currency,
			UpdateTime: apiPrice.UpdateAt,
		})
	}

	return prices, nil
}

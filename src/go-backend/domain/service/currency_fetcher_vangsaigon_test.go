package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"wealthjourney/pkg/vnprice"
)

// ---------------------------------------------------------------------------
// Compile-time interface check
// ---------------------------------------------------------------------------

var _ CurrencyPriceFetcher = (*vangSaiGonCurrencyFetcher)(nil)

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

// stubVnpriceClientForCurrency is a test double for the currency fetcher.
type stubVnpriceClientForCurrency struct {
	resp *vnprice.PricesResponse
	err  error
}

func (s *stubVnpriceClientForCurrency) fetchPrices(ctx context.Context) (*vnprice.PricesResponse, error) {
	return s.resp, s.err
}

// ---------------------------------------------------------------------------
// TestVangSaiGonCurrencyFetcher_Source
// ---------------------------------------------------------------------------

func TestVangSaiGonCurrencyFetcher_Source(t *testing.T) {
	f := NewVangSaiGonCurrencyFetcher(5 * time.Second)
	assert.Equal(t, SourceVangSaiGon, f.Source())
}

// ---------------------------------------------------------------------------
// TestVangSaiGonCurrencyFetcher_FetchCurrencyPrices_Success
// ---------------------------------------------------------------------------

func TestVangSaiGonCurrencyFetcher_FetchCurrencyPrices_Success(t *testing.T) {
	now := time.Now().Truncate(time.Second)

	stub := &stubVnpriceClientForCurrency{
		resp: &vnprice.PricesResponse{
			CurrencyPrices: []vnprice.CurrencyPrice{
				{
					Code:       "USD",
					Name:       "USD Tự Do",
					Buy:        25300.0,
					Sell:       25400.0,
					BuyChange:  100.0,
					SellChange: 50.0,
					Currency:   "VND",
					UpdateAt:   now,
				},
			},
		},
	}

	f := newVangSaiGonCurrencyFetcherWithStub(stub.fetchPrices)
	prices, err := f.FetchCurrencyPrices(context.Background())

	require.NoError(t, err)
	require.Len(t, prices, 1)

	p := prices[0]
	assert.Equal(t, "USD", p.TypeCode)
	assert.Equal(t, "USD Tự Do", p.Name)
	assert.Equal(t, int64(25300), p.Buy)      // raw VND, no multiplication
	assert.Equal(t, int64(25400), p.Sell)
	assert.Equal(t, int64(100), p.ChangeBuy)
	assert.Equal(t, int64(50), p.ChangeSell)
	assert.Equal(t, "VND", p.Currency)
	assert.Equal(t, now, p.UpdateTime)
}

// ---------------------------------------------------------------------------
// TestVangSaiGonCurrencyFetcher_FetchCurrencyPrices_Error
// ---------------------------------------------------------------------------

func TestVangSaiGonCurrencyFetcher_FetchCurrencyPrices_Error(t *testing.T) {
	stub := &stubVnpriceClientForCurrency{
		err: errors.New("timeout"),
	}

	f := newVangSaiGonCurrencyFetcherWithStub(stub.fetchPrices)
	prices, err := f.FetchCurrencyPrices(context.Background())

	assert.Error(t, err)
	assert.Nil(t, prices)
	assert.Contains(t, err.Error(), "fetch from vangsaigon")
}

// ---------------------------------------------------------------------------
// TestVangSaiGonCurrencyFetcher_FetchCurrencyPrices_MultipleEntries
// ---------------------------------------------------------------------------

func TestVangSaiGonCurrencyFetcher_FetchCurrencyPrices_MultipleEntries(t *testing.T) {
	now := time.Now().Truncate(time.Second)

	stub := &stubVnpriceClientForCurrency{
		resp: &vnprice.PricesResponse{
			CurrencyPrices: []vnprice.CurrencyPrice{
				{Code: "USD", Name: "USD Tự Do", Buy: 25300, Sell: 25400, Currency: "VND", UpdateAt: now},
				{Code: "USD Internalbank", Name: "USD Vietcombank", Buy: 25200, Sell: 25350, Currency: "VND", UpdateAt: now},
				{Code: "EUR", Name: "EUR", Buy: 27000, Sell: 27200, Currency: "VND", UpdateAt: now},
			},
		},
	}

	f := newVangSaiGonCurrencyFetcherWithStub(stub.fetchPrices)
	prices, err := f.FetchCurrencyPrices(context.Background())

	require.NoError(t, err)
	assert.Len(t, prices, 3)

	// All prices are raw VND — no multiplication
	assert.Equal(t, int64(25300), prices[0].Buy)
	assert.Equal(t, "VND", prices[0].Currency)
	assert.Equal(t, "USD", prices[0].TypeCode)

	assert.Equal(t, int64(25200), prices[1].Buy)
	assert.Equal(t, "USD Internalbank", prices[1].TypeCode)
	assert.Equal(t, "USD Vietcombank", prices[1].Name)

	assert.Equal(t, int64(27000), prices[2].Buy)
	assert.Equal(t, "EUR", prices[2].TypeCode)
}

// ---------------------------------------------------------------------------
// TestVangSaiGonCurrencyFetcher_FetchCurrencyPrices_EmptyList
// ---------------------------------------------------------------------------

func TestVangSaiGonCurrencyFetcher_FetchCurrencyPrices_EmptyList(t *testing.T) {
	stub := &stubVnpriceClientForCurrency{
		resp: &vnprice.PricesResponse{
			CurrencyPrices: []vnprice.CurrencyPrice{},
		},
	}

	f := newVangSaiGonCurrencyFetcherWithStub(stub.fetchPrices)
	prices, err := f.FetchCurrencyPrices(context.Background())

	require.NoError(t, err)
	assert.Empty(t, prices)
}

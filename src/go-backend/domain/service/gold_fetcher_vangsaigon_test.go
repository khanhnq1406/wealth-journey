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

var _ GoldPriceFetcher = (*vangSaiGonGoldFetcher)(nil)

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

// stubVnpriceClient is a test double for vnprice.Client that replaces the
// real HTTP call with an in-memory stub.
type stubVnpriceClientForGold struct {
	resp *vnprice.PricesResponse
	err  error
}

// fetchPricesForGold satisfies the fetchPricesFn signature used by the
// gold fetcher under test.
func (s *stubVnpriceClientForGold) fetchPrices(ctx context.Context) (*vnprice.PricesResponse, error) {
	return s.resp, s.err
}

// ---------------------------------------------------------------------------
// TestVangSaiGonGoldFetcher_Source
// ---------------------------------------------------------------------------

func TestVangSaiGonGoldFetcher_Source(t *testing.T) {
	f := NewVangSaiGonGoldFetcher(5 * time.Second)
	assert.Equal(t, SourceVangSaiGon, f.Source())
}

// ---------------------------------------------------------------------------
// TestVangSaiGonGoldFetcher_FetchGoldPrices_VND
// ---------------------------------------------------------------------------

func TestVangSaiGonGoldFetcher_FetchGoldPrices_VND(t *testing.T) {
	now := time.Now().Truncate(time.Second)

	stub := &stubVnpriceClientForGold{
		resp: &vnprice.PricesResponse{
			GoldPrices: []vnprice.GoldPrice{
				{
					Name:       "SJC1L",
					Buy:        85.0, // 85 (VND thousands)
					Sell:       86.5,
					BuyChange:  0.5,
					SellChange: 0.3,
					Currency:   "VND",
					UpdateAt:   now,
				},
			},
		},
	}

	f := newVangSaiGonGoldFetcherWithStub(stub.fetchPrices)
	prices, err := f.FetchGoldPrices(context.Background())

	require.NoError(t, err)
	require.Len(t, prices, 1)

	p := prices[0]
	assert.Equal(t, "SJC1L", p.TypeCode)
	assert.Equal(t, "SJC1L", p.Name)
	assert.Equal(t, int64(85*1000), p.Buy)
	assert.Equal(t, int64(86500), p.Sell)        // 86.5 * 1000
	assert.Equal(t, int64(500), p.ChangeBuy)     // 0.5 * 1000
	assert.Equal(t, int64(300), p.ChangeSell)    // 0.3 * 1000
	assert.Equal(t, "VND", p.Currency)
	assert.Equal(t, now, p.UpdateTime)
}

// ---------------------------------------------------------------------------
// TestVangSaiGonGoldFetcher_FetchGoldPrices_USD
// ---------------------------------------------------------------------------

func TestVangSaiGonGoldFetcher_FetchGoldPrices_USD(t *testing.T) {
	now := time.Now().Truncate(time.Second)

	stub := &stubVnpriceClientForGold{
		resp: &vnprice.PricesResponse{
			GoldPrices: []vnprice.GoldPrice{
				{
					Name:       "XAUUSD",
					Buy:        2345.50,
					Sell:       2346.00,
					BuyChange:  5.25,
					SellChange: 5.00,
					Currency:   "USD",
					UpdateAt:   now,
				},
			},
		},
	}

	f := newVangSaiGonGoldFetcherWithStub(stub.fetchPrices)
	prices, err := f.FetchGoldPrices(context.Background())

	require.NoError(t, err)
	require.Len(t, prices, 1)

	p := prices[0]
	assert.Equal(t, "XAUUSD", p.TypeCode)
	assert.Equal(t, "XAUUSD", p.Name)
	assert.Equal(t, int64(234550), p.Buy)     // 2345.50 * 100
	assert.Equal(t, int64(234600), p.Sell)    // 2346.00 * 100
	assert.Equal(t, int64(525), p.ChangeBuy)  // 5.25 * 100
	assert.Equal(t, int64(500), p.ChangeSell) // 5.00 * 100
	assert.Equal(t, "USD", p.Currency)
	assert.Equal(t, now, p.UpdateTime)
}

// ---------------------------------------------------------------------------
// TestVangSaiGonGoldFetcher_FetchGoldPrices_Error
// ---------------------------------------------------------------------------

func TestVangSaiGonGoldFetcher_FetchGoldPrices_Error(t *testing.T) {
	stub := &stubVnpriceClientForGold{
		err: errors.New("connection refused"),
	}

	f := newVangSaiGonGoldFetcherWithStub(stub.fetchPrices)
	prices, err := f.FetchGoldPrices(context.Background())

	assert.Error(t, err)
	assert.Nil(t, prices)
	assert.Contains(t, err.Error(), "fetch from vangsaigon")
}

// ---------------------------------------------------------------------------
// TestVangSaiGonGoldFetcher_FetchGoldPrices_MultipleEntries
// ---------------------------------------------------------------------------

func TestVangSaiGonGoldFetcher_FetchGoldPrices_MultipleEntries(t *testing.T) {
	now := time.Now().Truncate(time.Second)

	stub := &stubVnpriceClientForGold{
		resp: &vnprice.PricesResponse{
			GoldPrices: []vnprice.GoldPrice{
				{Name: "SJC1L", Buy: 85.0, Sell: 86.5, Currency: "VND", UpdateAt: now},
				{Name: "XAUUSD", Buy: 2300.0, Sell: 2301.0, Currency: "USD", UpdateAt: now},
				{Name: "DOJI", Buy: 84.0, Sell: 85.0, Currency: "VND", UpdateAt: now},
			},
		},
	}

	f := newVangSaiGonGoldFetcherWithStub(stub.fetchPrices)
	prices, err := f.FetchGoldPrices(context.Background())

	require.NoError(t, err)
	assert.Len(t, prices, 3)

	// VND entry
	assert.Equal(t, int64(85*1000), prices[0].Buy)
	assert.Equal(t, "VND", prices[0].Currency)

	// USD entry
	assert.Equal(t, int64(2300*100), prices[1].Buy)
	assert.Equal(t, "USD", prices[1].Currency)

	// Second VND entry
	assert.Equal(t, int64(84*1000), prices[2].Buy)
	assert.Equal(t, "VND", prices[2].Currency)
}

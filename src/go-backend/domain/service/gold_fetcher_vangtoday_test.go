package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"wealthjourney/pkg/vangtoday"
)

// ---------------------------------------------------------------------------
// Compile-time interface check
// ---------------------------------------------------------------------------

var _ GoldPriceFetcher = (*vangTodayGoldFetcher)(nil)

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

// stubVangTodayClientForGold is a test double that replaces the real HTTP call.
type stubVangTodayClientForGold struct {
	resp *vangtoday.PricesResponse
	err  error
}

func (s *stubVangTodayClientForGold) fetchPrices(ctx context.Context) (*vangtoday.PricesResponse, error) {
	return s.resp, s.err
}

// ---------------------------------------------------------------------------
// TestVangTodayGoldFetcher_Source
// ---------------------------------------------------------------------------

func TestVangTodayGoldFetcher_Source(t *testing.T) {
	f := NewVangTodayGoldFetcher(5 * time.Second)
	assert.Equal(t, SourceVangToday, f.Source())
}

// ---------------------------------------------------------------------------
// TestVangTodayGoldFetcher_FetchGoldPrices_VND
// ---------------------------------------------------------------------------

func TestVangTodayGoldFetcher_FetchGoldPrices_VND(t *testing.T) {
	now := time.Now().Truncate(time.Second)

	stub := &stubVangTodayClientForGold{
		resp: &vangtoday.PricesResponse{
			GoldPrices: []*vangtoday.GoldPrice{
				{
					TypeCode:   "SJC",
					Name:       "SJC",
					Buy:        85_000_000, // already normalized by vangtoday client (VND*1000)
					Sell:       86_500_000,
					ChangeBuy:  500_000,
					ChangeSell: 300_000,
					Currency:   "VND",
					UpdateTime: now,
				},
			},
		},
	}

	f := newVangTodayGoldFetcherWithStub(stub.fetchPrices)
	prices, err := f.FetchGoldPrices(context.Background())

	require.NoError(t, err)
	require.Len(t, prices, 1)

	p := prices[0]
	assert.Equal(t, "SJC", p.TypeCode)
	assert.Equal(t, "SJC", p.Name)
	assert.Equal(t, int64(85_000_000), p.Buy)
	assert.Equal(t, int64(86_500_000), p.Sell)
	assert.Equal(t, int64(500_000), p.ChangeBuy)
	assert.Equal(t, int64(300_000), p.ChangeSell)
	assert.Equal(t, "VND", p.Currency)
	assert.Equal(t, now, p.UpdateTime)
}

// ---------------------------------------------------------------------------
// TestVangTodayGoldFetcher_FetchGoldPrices_USD
// ---------------------------------------------------------------------------

func TestVangTodayGoldFetcher_FetchGoldPrices_USD(t *testing.T) {
	now := time.Now().Truncate(time.Second)

	stub := &stubVangTodayClientForGold{
		resp: &vangtoday.PricesResponse{
			GoldPrices: []*vangtoday.GoldPrice{
				{
					TypeCode:   "XAU",
					Name:       "XAU",
					Buy:        234550, // already in cents (USD*100)
					Sell:       234600,
					ChangeBuy:  525,
					ChangeSell: 500,
					Currency:   "USD",
					UpdateTime: now,
				},
			},
		},
	}

	f := newVangTodayGoldFetcherWithStub(stub.fetchPrices)
	prices, err := f.FetchGoldPrices(context.Background())

	require.NoError(t, err)
	require.Len(t, prices, 1)

	p := prices[0]
	assert.Equal(t, "XAU", p.TypeCode)
	assert.Equal(t, "XAU", p.Name)
	assert.Equal(t, int64(234550), p.Buy)
	assert.Equal(t, int64(234600), p.Sell)
	assert.Equal(t, int64(525), p.ChangeBuy)
	assert.Equal(t, int64(500), p.ChangeSell)
	assert.Equal(t, "USD", p.Currency)
	assert.Equal(t, now, p.UpdateTime)
}

// ---------------------------------------------------------------------------
// TestVangTodayGoldFetcher_FetchGoldPrices_Error
// ---------------------------------------------------------------------------

func TestVangTodayGoldFetcher_FetchGoldPrices_Error(t *testing.T) {
	stub := &stubVangTodayClientForGold{
		err: errors.New("vangtoday: connection refused"),
	}

	f := newVangTodayGoldFetcherWithStub(stub.fetchPrices)
	prices, err := f.FetchGoldPrices(context.Background())

	assert.Error(t, err)
	assert.Nil(t, prices)
	assert.Contains(t, err.Error(), "fetch from vangtoday")
}

// ---------------------------------------------------------------------------
// TestVangTodayGoldFetcher_FetchGoldPrices_MultipleEntries
// ---------------------------------------------------------------------------

func TestVangTodayGoldFetcher_FetchGoldPrices_MultipleEntries(t *testing.T) {
	now := time.Now().Truncate(time.Second)

	stub := &stubVangTodayClientForGold{
		resp: &vangtoday.PricesResponse{
			GoldPrices: []*vangtoday.GoldPrice{
				{TypeCode: "SJC", Name: "SJC", Buy: 85_000_000, Sell: 86_000_000, Currency: "VND", UpdateTime: now},
				{TypeCode: "XAU", Name: "XAU", Buy: 230000, Sell: 230100, Currency: "USD", UpdateTime: now},
				{TypeCode: "DOJI", Name: "DOJI", Buy: 84_000_000, Sell: 85_000_000, Currency: "VND", UpdateTime: now},
			},
		},
	}

	f := newVangTodayGoldFetcherWithStub(stub.fetchPrices)
	prices, err := f.FetchGoldPrices(context.Background())

	require.NoError(t, err)
	assert.Len(t, prices, 3)

	assert.Equal(t, int64(85_000_000), prices[0].Buy)
	assert.Equal(t, "VND", prices[0].Currency)

	assert.Equal(t, int64(230000), prices[1].Buy)
	assert.Equal(t, "USD", prices[1].Currency)

	assert.Equal(t, int64(84_000_000), prices[2].Buy)
	assert.Equal(t, "VND", prices[2].Currency)
}

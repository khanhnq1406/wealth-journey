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

var _ CurrencyPriceFetcher = (*vangTodayCurrencyFetcher)(nil)

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

// stubVangTodayClientForCurrency is a test double for the vangtoday client.
type stubVangTodayClientForCurrency struct {
	resp *vangtoday.PricesResponse
	err  error
}

func (s *stubVangTodayClientForCurrency) fetchPrices(ctx context.Context) (*vangtoday.PricesResponse, error) {
	return s.resp, s.err
}

// ---------------------------------------------------------------------------
// TestVangTodayCurrencyFetcher_Source
// ---------------------------------------------------------------------------

func TestVangTodayCurrencyFetcher_Source(t *testing.T) {
	f := NewVangTodayCurrencyFetcher(5 * time.Second)
	assert.Equal(t, SourceVangToday, f.Source())
}

// ---------------------------------------------------------------------------
// TestVangTodayCurrencyFetcher_FetchCurrencyPrices_Success
// ---------------------------------------------------------------------------

func TestVangTodayCurrencyFetcher_FetchCurrencyPrices_Success(t *testing.T) {
	now := time.Now().Truncate(time.Second)

	stub := &stubVangTodayClientForCurrency{
		resp: &vangtoday.PricesResponse{
			CurrencyPrices: []*vangtoday.CurrencyPrice{
				{
					TypeCode:   "USD",
					Name:       "USD",
					Buy:        25300,
					Sell:       25450,
					Currency:   "VND",
					UpdateTime: now,
				},
			},
		},
	}

	f := newVangTodayCurrencyFetcherWithStub(stub.fetchPrices)
	prices, err := f.FetchCurrencyPrices(context.Background())

	require.NoError(t, err)
	require.Len(t, prices, 1)

	p := prices[0]
	assert.Equal(t, "USD", p.TypeCode)
	assert.Equal(t, "USD", p.Name)
	assert.Equal(t, int64(25300), p.Buy)
	assert.Equal(t, int64(25450), p.Sell)
	assert.Equal(t, "VND", p.Currency)
	assert.Equal(t, now, p.UpdateTime)
}

// ---------------------------------------------------------------------------
// TestVangTodayCurrencyFetcher_FetchCurrencyPrices_Error
// ---------------------------------------------------------------------------

func TestVangTodayCurrencyFetcher_FetchCurrencyPrices_Error(t *testing.T) {
	stub := &stubVangTodayClientForCurrency{
		err: errors.New("vangtoday: connection refused"),
	}

	f := newVangTodayCurrencyFetcherWithStub(stub.fetchPrices)
	prices, err := f.FetchCurrencyPrices(context.Background())

	assert.Error(t, err)
	assert.Nil(t, prices)
	assert.Contains(t, err.Error(), "fetch from vangtoday")
}

// ---------------------------------------------------------------------------
// TestVangTodayCurrencyFetcher_FetchCurrencyPrices_MultipleEntries
// ---------------------------------------------------------------------------

func TestVangTodayCurrencyFetcher_FetchCurrencyPrices_MultipleEntries(t *testing.T) {
	now := time.Now().Truncate(time.Second)

	stub := &stubVangTodayClientForCurrency{
		resp: &vangtoday.PricesResponse{
			CurrencyPrices: []*vangtoday.CurrencyPrice{
				{TypeCode: "USD", Name: "USD", Buy: 25300, Sell: 25450, Currency: "VND", UpdateTime: now},
				{TypeCode: "EUR", Name: "EUR", Buy: 27000, Sell: 27200, Currency: "VND", UpdateTime: now},
				{TypeCode: "JPY", Name: "JPY", Buy: 165, Sell: 170, Currency: "VND", UpdateTime: now},
			},
		},
	}

	f := newVangTodayCurrencyFetcherWithStub(stub.fetchPrices)
	prices, err := f.FetchCurrencyPrices(context.Background())

	require.NoError(t, err)
	assert.Len(t, prices, 3)

	assert.Equal(t, "USD", prices[0].TypeCode)
	assert.Equal(t, int64(25300), prices[0].Buy)

	assert.Equal(t, "EUR", prices[1].TypeCode)
	assert.Equal(t, int64(27000), prices[1].Buy)

	assert.Equal(t, "JPY", prices[2].TypeCode)
	assert.Equal(t, int64(165), prices[2].Buy)
}

package service

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"wealthjourney/pkg/vietcombank"
)

// ---------------------------------------------------------------------------
// Compile-time interface check
// ---------------------------------------------------------------------------

var _ CurrencyPriceFetcher = (*vietcombankCurrencyFetcher)(nil)

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

// stubVietcombankClient is a test double for the vietcombank client.
type stubVietcombankClient struct {
	prices []*vietcombank.CurrencyPrice
	err    error
}

func (s *stubVietcombankClient) fetchPrices(ctx context.Context) ([]*vietcombank.CurrencyPrice, error) {
	return s.prices, s.err
}

// ---------------------------------------------------------------------------
// TestVietcombankCurrencyFetcher_Source
// ---------------------------------------------------------------------------

func TestVietcombankCurrencyFetcher_Source(t *testing.T) {
	f := newVietcombankCurrencyFetcherWithStub(func(ctx context.Context) ([]*vietcombank.CurrencyPrice, error) {
		return nil, nil
	})
	assert.Equal(t, SourceVietcombank, f.Source())
}

// ---------------------------------------------------------------------------
// TestVietcombankCurrencyFetcher_FetchCurrencyPrices_Success
// ---------------------------------------------------------------------------

func TestVietcombankCurrencyFetcher_FetchCurrencyPrices_Success(t *testing.T) {
	stub := &stubVietcombankClient{
		prices: []*vietcombank.CurrencyPrice{
			{
				TypeCode: "USD_VCB",
				Name:     "USD Vietcombank",
				Buy:      25450,
				Sell:     25650,
				Currency: "VND",
			},
		},
	}

	f := newVietcombankCurrencyFetcherWithStub(stub.fetchPrices)
	prices, err := f.FetchCurrencyPrices(context.Background())

	require.NoError(t, err)
	require.Len(t, prices, 1)

	p := prices[0]
	assert.Equal(t, "USD_VCB", p.TypeCode)
	assert.Equal(t, "USD Vietcombank", p.Name)
	assert.Equal(t, int64(25450), p.Buy)
	assert.Equal(t, int64(25650), p.Sell)
	assert.Equal(t, "VND", p.Currency)
}

// ---------------------------------------------------------------------------
// TestVietcombankCurrencyFetcher_FetchCurrencyPrices_ChangeBuyChangeSellAlwaysZero
// ---------------------------------------------------------------------------

func TestVietcombankCurrencyFetcher_FetchCurrencyPrices_ChangeBuyChangeSellAlwaysZero(t *testing.T) {
	stub := &stubVietcombankClient{
		prices: []*vietcombank.CurrencyPrice{
			{
				TypeCode: "EUR_VCB",
				Name:     "EUR Vietcombank",
				Buy:      27000,
				Sell:     27200,
				Currency: "VND",
			},
		},
	}

	f := newVietcombankCurrencyFetcherWithStub(stub.fetchPrices)
	prices, err := f.FetchCurrencyPrices(context.Background())

	require.NoError(t, err)
	require.Len(t, prices, 1)

	p := prices[0]
	assert.Equal(t, int64(0), p.ChangeBuy, "VCB API does not provide change data; ChangeBuy must always be 0")
	assert.Equal(t, int64(0), p.ChangeSell, "VCB API does not provide change data; ChangeSell must always be 0")
}

// ---------------------------------------------------------------------------
// TestVietcombankCurrencyFetcher_FetchCurrencyPrices_CurrencyPreserved
// ---------------------------------------------------------------------------

func TestVietcombankCurrencyFetcher_FetchCurrencyPrices_CurrencyPreserved(t *testing.T) {
	stub := &stubVietcombankClient{
		prices: []*vietcombank.CurrencyPrice{
			{
				TypeCode: "USD_VCB",
				Name:     "USD Vietcombank",
				Buy:      25450,
				Sell:     25650,
				Currency: "VND",
			},
		},
	}

	f := newVietcombankCurrencyFetcherWithStub(stub.fetchPrices)
	prices, err := f.FetchCurrencyPrices(context.Background())

	require.NoError(t, err)
	require.Len(t, prices, 1)
	assert.Equal(t, "VND", prices[0].Currency, "Currency from client output must be preserved as-is")
}

// ---------------------------------------------------------------------------
// TestVietcombankCurrencyFetcher_FetchCurrencyPrices_EmptyResult
// ---------------------------------------------------------------------------

func TestVietcombankCurrencyFetcher_FetchCurrencyPrices_EmptyResult(t *testing.T) {
	stub := &stubVietcombankClient{
		prices: []*vietcombank.CurrencyPrice{},
	}

	f := newVietcombankCurrencyFetcherWithStub(stub.fetchPrices)
	prices, err := f.FetchCurrencyPrices(context.Background())

	require.NoError(t, err)
	assert.Empty(t, prices)
}

// ---------------------------------------------------------------------------
// TestVietcombankCurrencyFetcher_FetchCurrencyPrices_Error
// ---------------------------------------------------------------------------

func TestVietcombankCurrencyFetcher_FetchCurrencyPrices_Error(t *testing.T) {
	stub := &stubVietcombankClient{
		err: errors.New("connection refused"),
	}

	f := newVietcombankCurrencyFetcherWithStub(stub.fetchPrices)
	prices, err := f.FetchCurrencyPrices(context.Background())

	assert.Error(t, err)
	assert.Nil(t, prices)
	assert.Contains(t, err.Error(), "fetch from vietcombank")
}

// ---------------------------------------------------------------------------
// TestVietcombankCurrencyFetcher_FetchCurrencyPrices_MultipleEntries
// ---------------------------------------------------------------------------

func TestVietcombankCurrencyFetcher_FetchCurrencyPrices_MultipleEntries(t *testing.T) {
	stub := &stubVietcombankClient{
		prices: []*vietcombank.CurrencyPrice{
			{TypeCode: "USD_VCB", Name: "USD Vietcombank", Buy: 25450, Sell: 25650, Currency: "VND"},
			{TypeCode: "EUR_VCB", Name: "EUR Vietcombank", Buy: 27000, Sell: 27200, Currency: "VND"},
			{TypeCode: "JPY_VCB", Name: "JPY Vietcombank", Buy: 165, Sell: 170, Currency: "VND"},
		},
	}

	f := newVietcombankCurrencyFetcherWithStub(stub.fetchPrices)
	prices, err := f.FetchCurrencyPrices(context.Background())

	require.NoError(t, err)
	assert.Len(t, prices, 3)

	assert.Equal(t, "USD_VCB", prices[0].TypeCode)
	assert.Equal(t, int64(25450), prices[0].Buy)

	assert.Equal(t, "EUR_VCB", prices[1].TypeCode)
	assert.Equal(t, int64(27000), prices[1].Buy)

	assert.Equal(t, "JPY_VCB", prices[2].TypeCode)
	assert.Equal(t, int64(165), prices[2].Buy)
}
